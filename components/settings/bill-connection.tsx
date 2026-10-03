"use client";

// The BILL (bill.com) connection card in Settings.
//
// IT IS SHAPED BY WHAT BILL ACTUALLY NEEDS, which is not what the OAuth cards
// need. There is no "Connect" link to send somebody to: the studio types the
// login it uses at BILL, picks which company, and then does a 2-step challenge
// whose remembered device is what lets a payment go through later. Four states,
// and each one says what it is waiting for rather than leaving somebody to
// discover it at the moment they try to pay a vendor.
import { useState, useTransition } from "react";
import {
  confirmBillMfa,
  connectBill,
  disconnectBill,
  findBillOrgs,
  startBillMfa,
} from "@/app/(app)/settings/bill-actions";
import { Button } from "@/components/ui/button";
import { StatusTag } from "@/components/status-tag";
import { toast } from "@/components/ui/toast";

export type BillConnectionView = {
  username: string;
  orgName: string | null;
  /** Null until a 2-step challenge has been completed, which paying requires. */
  mfaTrustedAt: string | null;
};

type Org = { orgId: string; orgName: string };

const field =
  "w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-sm text-text outline-none transition focus:border-accent";
const label = "mb-1 block text-xs font-semibold uppercase tracking-wide text-text-faint";

export function BillConnection({
  configured,
  sandbox,
  connection,
  canEdit,
}: {
  /** False when the developer key or the credential key is missing. */
  configured: boolean;
  /** True when this deployment talks to BILL's sandbox rather than real books. */
  sandbox: boolean;
  connection: BillConnectionView | null;
  canEdit: boolean;
}) {
  const [pending, start] = useTransition();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [orgs, setOrgs] = useState<Org[] | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState("");

  function lookUp() {
    start(async () => {
      const res = await findBillOrgs(username, password);
      if ("error" in res) {
        toast(res.error, "error");
        return;
      }
      // One company is the normal case, so it is chosen rather than offered.
      if (res.orgs.length === 1) {
        await save(res.orgs[0]);
        return;
      }
      setOrgs(res.orgs);
    });
  }

  async function save(org: Org) {
    const res = await connectBill(username, password, org.orgId, org.orgName);
    if ("error" in res) {
      toast(res.error, "error");
      return;
    }
    // The password is dropped from the form the moment it is stored, so it is
    // not sitting in a React state tree for the rest of the session.
    setPassword("");
    setOrgs(null);
    toast(
      res.trusted
        ? "BILL is connected."
        : "BILL is connected. One more step before it can pay a bill.",
      "success"
    );
  }

  function sendCode() {
    start(async () => {
      const res = await startBillMfa();
      if ("error" in res) {
        toast(res.error, "error");
        return;
      }
      setChallengeId(res.challengeId);
      toast("BILL is sending you a code. Enter it below.", "success");
    });
  }

  function confirmCode() {
    start(async () => {
      const res = await confirmBillMfa(challengeId ?? "", code);
      if ("error" in res) {
        toast(res.error, "error");
        return;
      }
      setChallengeId(null);
      setCode("");
      toast("This device is remembered. BILL can now pay a bill.", "success");
    });
  }

  const trusted = Boolean(connection?.mfaTrustedAt);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] text-sm font-bold"
          style={{ backgroundColor: "var(--h-green-bg)", color: "var(--h-green)" }}
        >
          BILL
        </span>
        <div>
          <div className="text-sm font-semibold text-text">BILL</div>
          <div className="text-xs text-text-faint">
            Add a vendor and a bill from the budget, and pay it, without
            retyping any of it into BILL. Your bank details stay with BILL, and
            your vendors give their payment details to BILL rather than to us.
          </div>
        </div>
      </div>

      {!configured ? (
        <p className="rounded-[10px] bg-yellow-bg px-3 py-2 text-sm font-medium text-text">
          BILL is not set up on this deployment yet. It needs a developer key
          and a credential key before a login can be stored.
        </p>
      ) : connection ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-border px-3 py-2.5">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-text">
                {connection.orgName || connection.username}
              </div>
              {connection.orgName && (
                <div className="truncate text-xs text-text-faint">{connection.username}</div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <StatusTag hue={trusted ? "green" : "amber"}>
                {trusted ? "Connected" : "Needs one more step"}
              </StatusTag>
              {canEdit && (
                <Button
                  size="sm"
                  variant="danger"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const res = await disconnectBill();
                      if ("error" in res) toast(res.error, "error");
                      else toast("BILL disconnected.", "success");
                    })
                  }
                >
                  {pending ? "..." : "Disconnect"}
                </Button>
              )}
            </div>
          </div>

          {/* The 2-step challenge. Stated as the thing standing between this
              connection and paying a bill, rather than discovered later. */}
          {canEdit && !trusted && (
            <div className="space-y-2 rounded-[12px] border border-border bg-surface-2 p-3">
              <p className="text-xs leading-relaxed text-text-muted">
                BILL requires a 2-step code before it will let anything pay a
                bill. Confirm one once and this studio stays able to pay; until
                then the connection can only read.
              </p>
              {challengeId === null ? (
                <Button size="sm" disabled={pending} onClick={sendCode}>
                  {pending ? "..." : "Send me a code"}
                </Button>
              ) : (
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-[140px]">
                    <label className={label} htmlFor="bill-code">
                      Code from BILL
                    </label>
                    <input
                      id="bill-code"
                      className={field}
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      autoComplete="one-time-code"
                      inputMode="numeric"
                    />
                  </div>
                  <Button size="sm" disabled={pending || !code.trim()} onClick={confirmCode}>
                    {pending ? "..." : "Confirm"}
                  </Button>
                  <button
                    type="button"
                    className="text-xs font-semibold text-text-faint underline"
                    onClick={sendCode}
                    disabled={pending}
                  >
                    Send another
                  </button>
                </div>
              )}
              <p className="text-xs text-text-faint">
                These codes expire within a few minutes, so enter it straight
                away rather than coming back to it.
              </p>
            </div>
          )}
        </>
      ) : !canEdit ? (
        <p className="rounded-[10px] border border-border bg-surface-2 px-3 py-2 text-xs text-text-muted">
          BILL is not connected. Studio admins can connect it.
        </p>
      ) : orgs ? (
        <div className="space-y-2 rounded-[12px] border border-border bg-surface-2 p-3">
          <p className="text-xs font-semibold text-text">
            That login reaches more than one company. Which one pays your
            vendors?
          </p>
          {orgs.map((o) => (
            <Button
              key={o.orgId}
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={() => start(() => save(o))}
            >
              {o.orgName || o.orgId}
            </Button>
          ))}
        </div>
      ) : (
        <div className="space-y-3 rounded-[12px] border border-border bg-surface-2 p-3">
          {/* SAID OUT LOUD, because it is a password rather than an OAuth
              hand-off and somebody is entitled to know why we are asking and
              what happens to it. */}
          <p className="text-xs leading-relaxed text-text-muted">
            BILL does not offer a connect button the way Gmail or Figma do: its
            API signs in with your BILL email and password, so that is what it
            needs. The password is encrypted before it is stored, under a key
            that is not kept in our database, and only studio admins can see or
            change this connection.
          </p>
          {sandbox && (
            <p className="rounded-[10px] bg-yellow-bg px-3 py-2 text-xs font-medium text-text">
              This deployment is pointed at BILL&apos;s sandbox, so use a
              sandbox login. Nothing here touches real money.
            </p>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className={label} htmlFor="bill-user">
                BILL email
              </label>
              <input
                id="bill-user"
                className={field}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="off"
                inputMode="email"
              />
            </div>
            <div>
              <label className={label} htmlFor="bill-pass">
                BILL password
              </label>
              <input
                id="bill-pass"
                type="password"
                className={field}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>
          <Button
            size="sm"
            disabled={pending || !username.trim() || !password}
            onClick={lookUp}
          >
            {pending ? "Checking with BILL..." : "Connect BILL"}
          </Button>
        </div>
      )}
    </div>
  );
}
