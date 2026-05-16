import { SignJWT, importPKCS8 } from "jose";
import { buildRfc822Message } from "@/lib/mime-rfc822";

/**
 * Google Workspace: send mail via Gmail API using a **dedicated** service account
 * with domain-wide delegation to impersonate `GMAIL_SEND_AS_EMAIL`.
 *
 * Workspace Admin → Security → API controls → Domain-wide delegation:
 * add this service account's **numeric Client ID** (GCP → IAM → service account) with OAuth scope:
 *   https://www.googleapis.com/auth/gmail.send
 *
 * In the JWT sent to Google, **`iss` must be the service account email** (`...@...iam.gserviceaccount.com`),
 * not the numeric Client ID. The numeric ID is only for the Admin Console delegation entry.
 *
 * Env vars are **separate from Firebase Admin** — use the mail service account JSON / PEM for `GMAIL_*`.
 */

const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";

function stripBom(s: string): string {
  return s.replace(/^\uFEFF/, "").replace(/[\u200B-\u200D\uFEFF]/g, "");
}

function stripOuterQuotes(s: string): string {
  const t = stripBom(s).trim();
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) return t.slice(1, -1).trim();
  if (t.length >= 2 && t.startsWith("'") && t.endsWith("'")) return t.slice(1, -1).trim();
  return t;
}

function pemPrivateKey(): string | null {
  const raw = process.env.GMAIL_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!raw?.trim()) return null;
  return stripOuterQuotes(raw).replace(/\\n/g, "\n");
}

function isServiceAccountClientEmail(email: string): boolean {
  return (
    /^[a-z0-9-]+@[a-z0-9-]+\.iam\.gserviceaccount\.com$/i.test(email) ||
    /^[a-z0-9-]+@[a-z0-9-]+\.developer\.gserviceaccount\.com$/i.test(email)
  );
}

export type ParsedWorkspaceMailEnv =
  | { ok: true; clientEmail: string; privateKeyPem: string; sendAsEmail: string }
  | { ok: false; error: string };

export function parseWorkspaceMailEnv(): ParsedWorkspaceMailEnv {
  const rawIss = process.env.GMAIL_SERVICE_ACCOUNT_EMAIL;
  const rawSub = process.env.GMAIL_SEND_AS_EMAIL;
  const privateKeyPem = pemPrivateKey();
  if (!rawIss?.trim() || !privateKeyPem || !rawSub?.trim()) {
    return {
      ok: false,
      error:
        "Missing GMAIL_SERVICE_ACCOUNT_EMAIL, GMAIL_SERVICE_ACCOUNT_PRIVATE_KEY, or GMAIL_SEND_AS_EMAIL (these are not the Firebase Admin variables).",
    };
  }

  const clientEmail = stripOuterQuotes(rawIss).trim().replace(/\s+/g, "");
  const sendAsEmail = stripOuterQuotes(rawSub).trim().toLowerCase();

  if (/\s/.test(stripOuterQuotes(rawSub).trim())) {
    return { ok: false, error: "GMAIL_SEND_AS_EMAIL must be a single email with no spaces." };
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(sendAsEmail)) {
    return { ok: false, error: "GMAIL_SEND_AS_EMAIL does not look like a valid email address." };
  }
  if (sendAsEmail.endsWith("@gmail.com")) {
    return {
      ok: false,
      error:
        "GMAIL_SEND_AS_EMAIL must be a Google Workspace user in your company domain (not a personal @gmail.com address).",
    };
  }

  if (!isServiceAccountClientEmail(clientEmail)) {
    return {
      ok: false,
      error:
        `GMAIL_SERVICE_ACCOUNT_EMAIL must be the service account **email** from the JSON key (*@*.iam.gserviceaccount.com). It must not be the numeric Client ID, OAuth client id (*.apps.googleusercontent.com), or your own mailbox. Got: "${clientEmail.slice(0, 56)}${clientEmail.length > 56 ? "…" : ""}".`,
    };
  }

  return { ok: true, clientEmail, privateKeyPem, sendAsEmail };
}

export type GmailDelegationSendResult = { ok: true } | { ok: false; error: string };

async function mintDelegatedAccessToken(parsed: {
  clientEmail: string;
  privateKeyPem: string;
  sendAsEmail: string;
}): Promise<{ token: string } | { error: string }> {
  let key: CryptoKey;
  try {
    key = await importPKCS8(parsed.privateKeyPem, "RS256");
  } catch {
    return {
      error:
        "GMAIL_SERVICE_ACCOUNT_PRIVATE_KEY is not valid PKCS#8 PEM (expect -----BEGIN PRIVATE KEY-----). If you see -----BEGIN RSA PRIVATE KEY-----, convert with: openssl pkcs8 -topk8 -nocrypt -in key.pem -out key.pkcs8.pem. In .env use \\n for newlines inside one quoted line.",
    };
  }

  const now = Math.floor(Date.now() / 1000);
  const exp = now + 3600;
  let assertion: string;
  try {
    assertion = await new SignJWT({ scope: GMAIL_SEND_SCOPE })
      .setProtectedHeader({ alg: "RS256", typ: "JWT" })
      .setIssuer(parsed.clientEmail)
      .setSubject(parsed.sendAsEmail)
      .setAudience("https://oauth2.googleapis.com/token")
      .setIssuedAt(now)
      .setExpirationTime(exp)
      .sign(key);
  } catch {
    return { error: "Failed to sign JWT for Workspace delegation." };
  }

  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const rawText = await res.text();
  if (!res.ok) {
    let hint = rawText.slice(0, 500);
    try {
      const j = JSON.parse(rawText) as { error?: string; error_description?: string };
      hint = j.error_description || j.error || hint;
    } catch {
      /* keep hint */
    }

    const invalidEmailHint =
      /invalid email or user id/i.test(hint) || /invalid email/i.test(hint)
        ? " Google returns this when `iss` is not exactly the service account email from the JSON key, or `sub` (GMAIL_SEND_AS_EMAIL) is not a real Workspace user in your domain. In Admin → Domain-wide delegation, authorize the service account’s **numeric** Client ID (GCP → IAM → that service account → Unique id) with scope " + GMAIL_SEND_SCOPE + ". In GCP, open the same service account → Details → enable domain-wide delegation for the key. Also confirm GMAIL_SEND_AS_EMAIL has no hidden characters (re-type it in .env)."
        : "";

    return {
      error: `OAuth token request failed (${res.status}): ${hint}.${invalidEmailHint}`,
    };
  }
  let json: { access_token?: string };
  try {
    json = JSON.parse(rawText) as { access_token?: string };
  } catch {
    return { error: "OAuth token response was not JSON." };
  }
  if (!json.access_token) return { error: "OAuth token response had no access_token." };
  return { token: json.access_token };
}

/** @deprecated Prefer mint path via sendGmailViaWorkspaceDelegationDetailed; kept for compatibility. */
export async function getGmailDelegatedAccessToken(): Promise<string | null> {
  const parsed = parseWorkspaceMailEnv();
  if (!parsed.ok) return null;
  const r = await mintDelegatedAccessToken(parsed);
  return "token" in r ? r.token : null;
}

export async function sendGmailViaWorkspaceDelegation(input: {
  to: string;
  subject: string;
  textBody: string;
  htmlBody?: string;
}): Promise<boolean> {
  const r = await sendGmailViaWorkspaceDelegationDetailed(input);
  return r.ok;
}

export async function sendGmailViaWorkspaceDelegationDetailed(input: {
  to: string;
  subject: string;
  textBody: string;
  htmlBody?: string;
}): Promise<GmailDelegationSendResult> {
  const parsed = parseWorkspaceMailEnv();
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const tokenR = await mintDelegatedAccessToken(parsed);
  if ("error" in tokenR) return { ok: false, error: tokenR.error };

  const raw = buildRfc822Message(input.to, parsed.sendAsEmail, input.subject, input.textBody, input.htmlBody);
  const enc = Buffer.from(raw).toString("base64url");
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { authorization: `Bearer ${tokenR.token}`, "content-type": "application/json" },
    body: JSON.stringify({ raw: enc }),
  });
  const errBody = await res.text();
  if (!res.ok) {
    let msg = errBody.slice(0, 400);
    try {
      const j = JSON.parse(errBody) as { error?: { message?: string; errors?: { message?: string }[] } };
      msg = j.error?.message || j.error?.errors?.[0]?.message || msg;
    } catch {
      /* keep */
    }
    return {
      ok: false,
      error: `Gmail API messages/send ${res.status}: ${msg}. From address must match GMAIL_SEND_AS_EMAIL (${parsed.sendAsEmail}).`,
    };
  }
  return { ok: true };
}

export function isGmailWorkspaceDelegationConfigured(): boolean {
  return parseWorkspaceMailEnv().ok;
}
