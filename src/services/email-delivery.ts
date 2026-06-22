import {
  isGmailWorkspaceDelegationConfigured,
  sendGmailViaWorkspaceDelegationDetailed,
} from "@/services/gmail-workspace-dwd";
import { buildRfc822Message, type EmailAttachment } from "@/lib/mime-rfc822";
export type { EmailAttachment };
export type SendTransactionalEmailInput = {
  /** One recipient or multiple addresses on a single message (shared To line). */
  to: string | string[];
  subject: string;
  textBody: string;
  htmlBody?: string;
  attachments?: EmailAttachment[];
};

function normalizeRecipients(to: string | string[]): string[] {
  return (Array.isArray(to) ? to : [to]).map((a) => a.trim()).filter(Boolean);
}

async function sendSendGrid(input: SendTransactionalEmailInput): Promise<boolean> {
  const key = process.env.SENDGRID_API_KEY?.trim();
  const from = process.env.SENDGRID_FROM_EMAIL?.trim();
  const recipients = normalizeRecipients(input.to);
  if (!key || !from || recipients.length === 0) return false;
  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      personalizations: [{ to: recipients.map((email) => ({ email })) }],
      from: { email: from },
      subject: input.subject,
      content: [
        { type: "text/plain", value: input.textBody },
        ...(input.htmlBody ? [{ type: "text/html", value: input.htmlBody }] : []),
      ],
      ...(input.attachments?.length
        ? {
            attachments: input.attachments.map((a) => ({
              content: a.content.toString("base64"),
              filename: a.filename,
              type: a.mimeType ?? "application/octet-stream",
              disposition: "attachment",
            })),
          }
        : {}),
    }),
  });
  return res.ok;
}

export type SendTransactionalEmailResult = { ok: true } | { ok: false; error: string };

async function refreshGoogleAccessToken(): Promise<string | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const refresh = process.env.GOOGLE_REFRESH_TOKEN?.trim();
  if (!clientId || !clientSecret || !refresh) return null;
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refresh,
    grant_type: "refresh_token",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { access_token?: string };
  return json.access_token ?? null;
}

/** Legacy: user OAuth refresh token (not domain-wide delegation). */
async function sendGmailUserOAuth(input: SendTransactionalEmailInput): Promise<boolean> {
  const from = process.env.GOOGLE_EMAIL_FROM?.trim();
  const access = await refreshGoogleAccessToken();
  const recipients = normalizeRecipients(input.to);
  if (!from || !access || recipients.length === 0) return false;
  const raw = buildRfc822Message(
    recipients,
    from,
    input.subject,
    input.textBody,
    input.htmlBody,
    input.attachments,
  );
  const enc = Buffer.from(raw).toString("base64url");
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { authorization: `Bearer ${access}`, "content-type": "application/json" },
    body: JSON.stringify({ raw: enc }),
  });
  return res.ok;
}

/**
 * Sends transactional email. Order of attempt:
 * 1. Google Workspace domain-wide delegation (service account → `GMAIL_SEND_AS_EMAIL`)
 * 2. Gmail API with user refresh token (`GOOGLE_REFRESH_TOKEN` + `GOOGLE_EMAIL_FROM`)
 * 3. SendGrid
 */
export async function sendTransactionalEmail(input: SendTransactionalEmailInput): Promise<SendTransactionalEmailResult> {
  const tried: string[] = [];

  if (isGmailWorkspaceDelegationConfigured()) {
    const dwd = await sendGmailViaWorkspaceDelegationDetailed(input);
    if (dwd.ok) return { ok: true };
    tried.push(dwd.error);
  } else if (
    process.env.GMAIL_SERVICE_ACCOUNT_EMAIL?.trim() ||
    process.env.GMAIL_SERVICE_ACCOUNT_PRIVATE_KEY?.trim() ||
    process.env.GMAIL_SEND_AS_EMAIL?.trim()
  ) {
    tried.push(
      "Workspace mail env vars look partially set but isGmailWorkspaceDelegationConfigured() is false — usually a missing/empty GMAIL_SERVICE_ACCOUNT_PRIVATE_KEY or PEM parsing issue.",
    );
  }

  if (await sendGmailUserOAuth(input)) return { ok: true };
  if (await sendSendGrid(input)) return { ok: true };

  const tail =
    tried.length > 0
      ? tried.join(" ")
      : "No email provider configured. For Workspace delegation set GMAIL_SERVICE_ACCOUNT_EMAIL, GMAIL_SERVICE_ACCOUNT_PRIVATE_KEY, GMAIL_SEND_AS_EMAIL (separate from Firebase Admin), plus domain-wide delegation Client ID with gmail.send scope.";
  return { ok: false, error: tail };
}
