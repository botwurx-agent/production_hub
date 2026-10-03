// Encrypting the BILL credentials at rest.
//
// WHY THIS EXISTS. Every other connector in this app stores an OAuth token: a
// thing the provider issued us, scoped to what we asked for, revocable from
// their side. BILL has no OAuth, so a connection is the studio's own username
// and password. Storing that in plain text would mean a database dump is a
// dump of somebody's banking login, which is not a trade worth making for a
// convenience.
//
// WHAT IT BUYS AND WHAT IT DOES NOT. The key lives in the deployment's
// environment and never in the database, so reading a stored password needs
// BOTH, and they are held in different places by different systems. That
// defeats a database leak, which is the realistic failure. It does NOT defeat
// a compromise of the running server, which can read the environment: nothing
// short of a hardware module or the customer re-typing the password every time
// would, and neither is on the table. Say it that way rather than calling this
// "secure".
//
// AES-256-GCM, so the ciphertext is authenticated: a tampered row fails to
// decrypt rather than decrypting to something else.
//
// NOT "server-only", deliberately, the same call as lib/contact.ts and
// lib/invoice-draft.ts: this is a trust boundary and a trust boundary that
// cannot be unit tested is worth less. It must never be imported from a client
// component, and the key is read from a non-NEXT_PUBLIC variable, so such an
// import would get undefined and throw rather than ship a key to a browser.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
// A version tag on every value, because the one certainty about an encryption
// scheme is that it gets replaced, and a stored blob that cannot say which
// scheme made it has to be guessed at.
const V = "v1";

export class BillCryptoError extends Error {}

/**
 * The key, as 32 bytes. 64 hex characters in BILL_CRED_KEY
 * (`openssl rand -hex 32`).
 *
 * THROWS WHEN UNSET, rather than falling back to a default or to no
 * encryption. A missing key means there is nowhere safe to put a credential,
 * and the honest response to that is to refuse the connection, not to store
 * the password in the clear and hope somebody notices.
 */
export function billCredKey(): Buffer {
  const raw = (process.env.BILL_CRED_KEY ?? "").trim();
  if (!raw) {
    throw new BillCryptoError(
      "BILL_CRED_KEY is not set, so there is nowhere safe to keep a BILL password."
    );
  }
  if (!/^[0-9a-fA-F]{64}$/.test(raw)) {
    throw new BillCryptoError(
      "BILL_CRED_KEY must be 64 hex characters (32 bytes). Generate one with: openssl rand -hex 32"
    );
  }
  return Buffer.from(raw, "hex");
}

/** Whether a credential could be stored at all. Checked before offering the form. */
export function billCryptoReady(): boolean {
  try {
    billCredKey();
    return true;
  } catch {
    return false;
  }
}

/** `v1:<iv>:<tag>:<ciphertext>`, each part base64. */
export function encryptSecret(plain: string, key = billCredKey()): string {
  if (typeof plain !== "string" || plain === "") {
    throw new BillCryptoError("Nothing to encrypt.");
  }
  // A fresh 12-byte nonce per value. GCM's security collapses if one is
  // reused under the same key, so it is never derived from anything.
  const iv = randomBytes(12);
  const c = createCipheriv(ALGO, key, iv);
  const out = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [V, iv.toString("base64"), c.getAuthTag().toString("base64"), out.toString("base64")].join(":");
}

export function decryptSecret(stored: string, key = billCredKey()): string {
  const parts = typeof stored === "string" ? stored.split(":") : [];
  if (parts.length !== 4 || parts[0] !== V) {
    throw new BillCryptoError("This stored credential is not in a shape this version can read.");
  }
  const [, ivB64, tagB64, dataB64] = parts;
  try {
    const d = createDecipheriv(ALGO, key, Buffer.from(ivB64, "base64"));
    d.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([d.update(Buffer.from(dataB64, "base64")), d.final()]).toString("utf8");
  } catch {
    // One message for a wrong key and for a tampered row alike: we cannot tell
    // them apart, and guessing which in a message would be the same mistake
    // the FreshBooks error messages kept making.
    throw new BillCryptoError(
      "This stored credential could not be read. Either BILL_CRED_KEY has changed or the row was altered; reconnect BILL to replace it."
    );
  }
}
