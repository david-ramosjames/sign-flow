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
