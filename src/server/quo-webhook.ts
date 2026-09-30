import { createHmac, timingSafeEqual } from "crypto";
import { getSignFlowStore } from "@/lib/db";
import { DEFAULT_FIRM_ID } from "@/lib/firm-scope";
import { isSmsStopKeyword } from "@/lib/phone";
import { stopRemindersByPhone } from "@/server/signing-workflow";

export type QuoMessageReceivedPayload = {
  id?: string;
  type?: string;
  data?: {
    object?: {
      id?: string;
      from?: string;
      to?: string | string[];
      direction?: string;
      body?: string;
      text?: string;
      content?: string;
      status?: string;
    };
  };
};

function getEnvSigningKey(): string | null {
  return process.env.QUO_WEBHOOK_SECRET?.trim() || process.env.QUO_WEBHOOK_KEY?.trim() || null;
}

/** All signing secrets to try (firm-specific + env). Wrong firm secret must not block env secret. */
async function resolveSigningKeys(firmId?: string): Promise<string[]> {
  const keys: string[] = [];
  const add = (raw: string | null | undefined) => {
    const t = raw?.trim();
    if (t && !keys.includes(t)) keys.push(t);
  };

  const firmIds = firmId ? [firmId] : [DEFAULT_FIRM_ID];
  for (const id of firmIds) {
    try {
      const secrets = await getSignFlowStore().getFirmSecrets(id);
      add(secrets?.quoWebhookSecret);
    } catch {
      /* Firestore unavailable — still try env */
    }
  }
  add(getEnvSigningKey());
  return keys;
}

function hmacKeyCandidates(secret: string): Buffer[] {
  const keys: Buffer[] = [];
  const seen = new Set<string>();
  const add = (buf: Buffer) => {
    const id = buf.toString("hex");
    if (!seen.has(id) && buf.length > 0) {
      seen.add(id);
      keys.push(buf);
    }
  };

  const withoutPrefix = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  try {
    add(Buffer.from(withoutPrefix, "base64"));
  } catch {
    /* ignore */
  }
  if (withoutPrefix !== secret) {
    try {
      add(Buffer.from(secret, "base64"));
    } catch {
      /* ignore */
    }
  }
  add(Buffer.from(secret, "utf8"));
  return keys;
}

function openPhoneSignatureHeader(req: Request): string | null {
  return req.headers.get("openphone-signature") ?? req.headers.get("OpenPhone-Signature");
}

function hasSvixWebhookHeaders(req: Request): boolean {
  return Boolean(
    req.headers.get("webhook-id")?.trim() &&
      req.headers.get("webhook-timestamp")?.trim() &&
      req.headers.get("webhook-signature")?.trim(),
  );
}

function timingSafeEqualBase64(a: string, b: string): boolean {
  try {
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ab.length !== bb.length) return false;
    return timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

/**
 * Legacy Quo / OpenPhone webhooks (`apiVersion` v2/v3): `openphone-signature: hmac;1;{ms};{sig}`
 * Signed payload = `{timestamp}.{rawBody}` (timestamp is milliseconds).
 */
function verifyLegacyOpenPhoneWithSecret(secret: string, signatureHeader: string, rawBody: string): boolean {
  const parts = signatureHeader.split(";");
  if (parts.length < 4 || parts[0] !== "hmac" || parts[1] !== "1") return false;

  const timestamp = parts[2] ?? "";
  const provided = parts.slice(3).join(";");
  const tsNum = Number(timestamp);
  if (!Number.isFinite(tsNum)) return false;

  const tsSec = tsNum > 1_000_000_000_000 ? tsNum / 1000 : tsNum;
  if (Math.abs(Date.now() / 1000 - tsSec) > 300) return false;

  const bodiesToTry = [rawBody];
  try {
    const compact = JSON.stringify(JSON.parse(rawBody));
    if (compact !== rawBody) bodiesToTry.push(compact);
  } catch {
    /* ignore */
  }

  for (const body of bodiesToTry) {
    const signed = `${timestamp}.${body}`;
    for (const key of hmacKeyCandidates(secret)) {
      const expected = createHmac("sha256", key).update(signed, "utf8").digest("base64");
      if (timingSafeEqualBase64(expected, provided)) return true;
    }
  }
  return false;
}

/** Standard Webhooks / Svix (Quo API version 2026-03-30+). */
function verifyQuoWebhookWithSecret(secret: string, req: Request, rawBody: string): boolean {
  const webhookId = req.headers.get("webhook-id") ?? "";
  const timestamp = req.headers.get("webhook-timestamp") ?? "";
  const signatureHeader = req.headers.get("webhook-signature") ?? "";
  if (!webhookId || !timestamp || !signatureHeader) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - ts) > 300) return false;

  const signed = `${webhookId}.${timestamp}.${rawBody}`;
  const candidates = signatureHeader
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [version, signature] = part.split(",");
      return version === "v1" && signature ? signature : part.startsWith("v1,") ? part.slice(3) : part;
    })
    .filter(Boolean);

  for (const key of hmacKeyCandidates(secret)) {
    const expected = createHmac("sha256", key).update(signed, "utf8").digest("base64");
    const expectedBuf = Buffer.from(expected);
    for (const cand of candidates) {
      try {
        const candBuf = Buffer.from(cand);
        if (candBuf.length === expectedBuf.length && timingSafeEqual(candBuf, expectedBuf)) {
          return true;
        }
      } catch {
        /* try next */
      }
    }
  }
  return false;
}

export type QuoWebhookAuthResult =
  | { ok: true; open: true }
  | { ok: true; open: false; scheme: "svix" | "openphone-legacy" }
  | {
      ok: false;
      reason: "missing_headers" | "invalid_signature";
      scheme?: "svix" | "openphone-legacy" | "none";
    };

/**
 * Verify Quo/OpenPhone webhook signatures.
 * Supports legacy OpenPhone (`openphone-signature`, apiVersion v3) and Svix-style headers.
 */
export async function authorizeQuoWebhook(
  req: Request,
  rawBody: string,
  firmId?: string,
): Promise<QuoWebhookAuthResult> {
  const secrets = await resolveSigningKeys(firmId);
  if (secrets.length === 0) {
    return { ok: true, open: true };
  }

  const svix = hasSvixWebhookHeaders(req);
  const legacyHeader = openPhoneSignatureHeader(req);
  const scheme = svix ? "svix" : legacyHeader ? "openphone-legacy" : "none";

  if (!svix && !legacyHeader) {
    return { ok: false, reason: "missing_headers", scheme: "none" };
  }

  for (const secret of secrets) {
    if (svix && verifyQuoWebhookWithSecret(secret, req, rawBody)) {
      return { ok: true, open: false, scheme: "svix" };
    }
    if (legacyHeader && verifyLegacyOpenPhoneWithSecret(secret, legacyHeader, rawBody)) {
      return { ok: true, open: false, scheme: "openphone-legacy" };
    }
  }
  return { ok: false, reason: "invalid_signature", scheme };
}

/** @deprecated use authorizeQuoWebhook */
export async function isQuoWebhookAuthorized(
  req: Request,
  rawBody: string,
  firmId?: string,
): Promise<boolean> {
  const r = await authorizeQuoWebhook(req, rawBody, firmId);
  return r.ok;
}

function messageBody(obj: NonNullable<QuoMessageReceivedPayload["data"]>["object"]): string {
  return (obj?.body ?? obj?.text ?? obj?.content ?? "").toString();
}

/**
 * Process Quo message events. Only `message.received` with STOP keywords
 * disable reminders; signing links stay active.
 */
export async function processQuoWebhookJson(
  payload: unknown,
  firmId?: string,
): Promise<{
  handled: boolean;
  stopped: number;
  reason?: string;
}> {
  if (!payload || typeof payload !== "object") {
    return { handled: false, stopped: 0, reason: "invalid_payload" };
  }
  const body = payload as QuoMessageReceivedPayload;
  const eventType = body.type ?? "";
  if (eventType && eventType !== "message.received") {
    return { handled: false, stopped: 0, reason: `ignored_${eventType}` };
  }

  const msg = body.data?.object;
  if (!msg) return { handled: false, stopped: 0, reason: "missing_message" };

  const direction = (msg.direction ?? "").toLowerCase();
  if (direction && direction !== "incoming" && direction !== "inbound") {
    return { handled: false, stopped: 0, reason: "not_inbound" };
  }

  const text = messageBody(msg);
  if (!isSmsStopKeyword(text)) {
    return { handled: false, stopped: 0, reason: "not_stop_keyword" };
  }

  const from = msg.from?.trim();
  if (!from) return { handled: false, stopped: 0, reason: "missing_from" };

  const updated = await stopRemindersByPhone(from, "client_sms_stop", {
    messageBody: text,
    firmId,
  });
  return { handled: true, stopped: updated.length };
}
