import { createHmac, timingSafeEqual } from "node:crypto";

export function isSlackBotConfigured(): boolean {
  return Boolean(process.env.SLACK_BOT_TOKEN?.trim() && process.env.SLACK_SIGNING_SECRET?.trim());
}

export function slackBotToken(): string | null {
  return process.env.SLACK_BOT_TOKEN?.trim() || null;
}

export function slackSigningSecret(): string | null {
  return process.env.SLACK_SIGNING_SECRET?.trim() || null;
}

/** Firm used for Slack-created contracts (defaults to Ramos James). */
export function slackDefaultFirmId(): string {
  return process.env.SLACK_DEFAULT_FIRM_ID?.trim() || "ramos-james";
}

/**
 * Absolute public origin for Slack deep links (no trailing slash).
 * Prefer SIGNFLOW_EMAIL_PUBLIC_ORIGIN; fall back to VERCEL_URL on Vercel.
 */
export function slackPublicAppOrigin(): string | null {
  const configured =
    process.env.SIGNFLOW_EMAIL_PUBLIC_ORIGIN?.trim() ||
    process.env.NEXT_PUBLIC_SIGNFLOW_EMAIL_PUBLIC_ORIGIN?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
    return host ? `https://${host}` : null;
  }
  return null;
}

/**
 * Verify Slack request signature.
 * @see https://api.slack.com/authentication/verifying-requests-from-slack
 */
export function verifySlackRequest(opts: {
  signingSecret: string;
  signature: string | null;
  timestamp: string | null;
  rawBody: string;
  maxAgeSec?: number;
}): boolean {
  const { signingSecret, signature, timestamp, rawBody, maxAgeSec = 60 * 5 } = opts;
  if (!signature || !timestamp) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(Date.now() / 1000 - ts) > maxAgeSec) return false;

  const base = `v0:${timestamp}:${rawBody}`;
  const digest = createHmac("sha256", signingSecret).update(base).digest("hex");
  const expected = `v0=${digest}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
