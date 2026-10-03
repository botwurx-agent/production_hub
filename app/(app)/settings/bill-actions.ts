"use server";

// Connecting a studio's BILL (bill.com) account, in Settings.
//
// THE WHOLE FLOW, and why it is two steps rather than one. BILL has no OAuth,
// so step one takes the login and stores it; step two does a 2-step challenge
// whose remembered id is what later lets a payment be submitted with nobody
// present. A connection without step two can read, and cannot pay, and the
// card says so rather than failing at the moment somebody tries to pay a
// vendor.
//
// ADMINS ONLY, enforced here AND by RLS on the table. This credential can move
// money, so it does not follow the other connectors' per-user rule.
//
// NOTHING SECRET IS EVER RETURNED. These actions hand back a status, an org
// name, or a sentence BILL said. The password goes one way.
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { reportError } from "@/lib/log";
import { allow } from "@/lib/rate-limit";
import {
  BillError,
  billConfigured,
  billEnv,
  billLogin,
  billMfaChallenge,
  billMfaValidate,
  encryptSecret,
  listBillOrgs,
  type BillOrg,
} from "@/lib/bill";
import { billSessionForStudio } from "@/lib/bill";

type Fail = { error: string };
const BAD_INPUT = "Enter the email and password you use to sign in to BILL.";

/**
 * Admin check. A collaborator's synthesised context carries role `member`, so
 * this refuses them twice over, and they cannot reach Settings anyway.
 */
async function requireAdmin() {
  const ctx = await requireStudioContext();
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return { ctx: null, error: "Only studio admins can change the BILL connection." as const };
  }
  return { ctx, error: null };
}

/**
 * BILL limits Login and ListOrgs to 200 an hour per developer key, SHARED
 * across every studio using this integration, so a retry loop in one studio's
 * Settings would spend another studio's budget. Best-effort and in-memory, the
 * same honest limitation as everywhere else it is used here.
 */
function limited(key: string): string | null {
  const ok = allow(`bill:${key}`, 10, 60_000);
  return ok
    ? null
    : "Too many attempts in a row. Wait a minute and try again, because BILL limits how often we may sign in.";
}

/** One readable sentence, whatever went wrong. */
function readable(e: unknown, where: string): string {
  if (e instanceof BillError) return e.message;
  reportError(where, e);
  return e instanceof Error && e.message
    ? e.message
    : "Something went wrong reaching BILL.";
}

/**
 * Step one, part one: which company is this login for? Asked first so nobody
 * has to find a twenty-character organization id, and so the stored row can
 * carry the company name for the card.
 */
export async function findBillOrgs(
  username: string,
  password: string
): Promise<{ orgs: BillOrg[] } | Fail> {
  const { ctx, error } = await requireAdmin();
  if (!ctx) return { error };
  if (!billConfigured()) {
    return { error: "BILL is not set up on this deployment yet." };
  }
  const user = (username ?? "").trim();
  if (!user || !password) return { error: BAD_INPUT };

  const over = limited(ctx.studio.id);
  if (over) return { error: over };

  try {
    const orgs = await listBillOrgs(user, password);
    if (!orgs.length) {
      return {
        error:
          "That login worked but BILL lists no organizations on it, so there is nothing to connect.",
      };
    }
    return { orgs };
  } catch (e) {
    return { error: readable(e, "findBillOrgs") };
  }
}

/**
 * Step one, part two: store it. The login is PROVEN FIRST by signing in with
 * exactly what will be stored, so a typo is caught here rather than surfacing
 * later as a failed payment.
 */
export async function connectBill(
  username: string,
  password: string,
  orgId: string,
  orgName: string | null
): Promise<{ ok: true; trusted: boolean } | Fail> {
  const { ctx, error } = await requireAdmin();
  if (!ctx) return { error };
  if (!billConfigured()) {
    return { error: "BILL is not set up on this deployment yet." };
  }
  const user = (username ?? "").trim();
  const org = (orgId ?? "").trim();
  if (!user || !password || !org) return { error: BAD_INPUT };

  const over = limited(ctx.studio.id);
  if (over) return { error: over };

  // A device id per studio, not per sign-in, because BILL remembers the pair
  // of (remembered id, device) and a new device each time would make every
  // session untrusted.
  const device = `studio-flows-${randomUUID()}`;

  try {
    const session = await billLogin({ username: user, password, orgId: org });

    const supabase = createClient();
    const { error: writeError } = await supabase.from("bill_connections").upsert(
      {
        studio_id: ctx.studio.id,
        username: user,
        org_id: org,
        org_name: (orgName ?? "").trim() || null,
        password_cipher: encryptSecret(password),
        // A fresh connection has no remembered device, so paying needs the
        // challenge below even if an older connection once had one.
        remember_me_cipher: null,
        mfa_trusted_at: null,
        device_id: device,
        created_by: ctx.userId,
        last_ok_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "studio_id" }
    );
    if (writeError) {
      reportError("connectBill/upsert", writeError);
      return { error: "BILL accepted the sign-in but saving it here failed. Try again." };
    }

    revalidatePath("/settings");
    return { ok: true, trusted: session.trusted };
  } catch (e) {
    return { error: readable(e, "connectBill") };
  }
}

/**
 * Step two, part one: ask BILL to send the code. Its own press, because this
 * sends a text message and a button that fires one on every page load is a
 * button nobody presses.
 */
export async function startBillMfa(): Promise<{ challengeId: string } | Fail> {
  const { ctx, error } = await requireAdmin();
  if (!ctx) return { error };
  const over = limited(ctx.studio.id);
  if (over) return { error: over };

  try {
    const supabase = createClient();
    const signed = await billSessionForStudio(supabase, ctx.studio.id);
    if (!signed) return { error: "BILL is not connected yet." };
    const challengeId = await billMfaChallenge(signed.session);
    return { challengeId };
  } catch (e) {
    return { error: readable(e, "startBillMfa") };
  }
}

/**
 * Step two, part two: validate the code and keep what it returns. The
 * remembered id is a standing credential, so it is encrypted exactly like the
 * password rather than stored as it arrives.
 */
export async function confirmBillMfa(
  challengeId: string,
  code: string
): Promise<{ ok: true } | Fail> {
  const { ctx, error } = await requireAdmin();
  if (!ctx) return { error };
  const id = (challengeId ?? "").trim();
  const entered = (code ?? "").trim();
  if (!id || !entered) return { error: "Enter the code BILL sent you." };

  const over = limited(ctx.studio.id);
  if (over) return { error: over };

  try {
    const supabase = createClient();
    const signed = await billSessionForStudio(supabase, ctx.studio.id);
    if (!signed) return { error: "BILL is not connected yet." };

    const rememberMeId = await billMfaValidate(signed.session, {
      challengeId: id,
      code: entered,
      device: signed.conn.device_id,
    });

    const { error: writeError } = await supabase
      .from("bill_connections")
      .update({
        remember_me_cipher: encryptSecret(rememberMeId),
        mfa_trusted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("studio_id", ctx.studio.id);
    if (writeError) {
      reportError("confirmBillMfa/update", writeError);
      return {
        error:
          "BILL accepted the code but saving it here failed, so this will have to be done again.",
      };
    }

    revalidatePath("/settings");
    return { ok: true };
  } catch (e) {
    return { error: readable(e, "confirmBillMfa") };
  }
}

/**
 * Forget the credential. Deliberately a plain delete rather than a flag: the
 * point of disconnecting a password is that we stop holding it.
 */
export async function disconnectBill(): Promise<{ ok: true } | Fail> {
  const { ctx, error } = await requireAdmin();
  if (!ctx) return { error };
  const supabase = createClient();
  const { error: writeError } = await supabase
    .from("bill_connections")
    .delete()
    .eq("studio_id", ctx.studio.id);
  if (writeError) {
    reportError("disconnectBill", writeError);
    return { error: "Could not disconnect BILL. Try again." };
  }
  revalidatePath("/settings");
  return { ok: true };
}

/** Which BILL this deployment talks to, so the card can say when it is a sandbox. */
export async function billEnvironment(): Promise<BillEnvName> {
  return billEnv();
}

type BillEnvName = "sandbox" | "production";
