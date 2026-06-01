import { parsePhoneNumberFromString } from "libphonenumber-js";

export type SendSmsResult = {
  sid: string;
  status: string;
  body: string;
  to: string;
};

const PN_ID = /^PN[a-zA-Z0-9]+$/;

/** True when real SMS can be sent (API key + from number or phone number id). */
export function isQuoSmsConfigured(): boolean {
  return Boolean(process.env.QUO_API_KEY?.trim() && resolveQuoFrom()?.from);
}

function quoSmsMockEnabled(): boolean {
  return process.env.QUO_SMS_MOCK?.trim().toLowerCase() === "true";
}

function toE164(raw: string): string | null {
  const p = parsePhoneNumberFromString(raw, "US");
  if (p?.isValid()) return p.number;
  const p2 = parsePhoneNumberFromString(raw.startsWith("+") ? raw : `+${raw.replace(/\D/g, "")}`);
  return p2?.isValid() ? p2.number : null;
}

/** Quo accepts `from` as E.164 or phone number id (PN…). */
function resolveQuoFrom(): { from: string; label: string } | null {
  const phoneNumberId = process.env.QUO_PHONE_NUMBER_ID?.trim();
  if (phoneNumberId) {
    const id = phoneNumberId.startsWith("PN") ? phoneNumberId : `PN${phoneNumberId}`;
    if (!PN_ID.test(id)) return null;
    return { from: id, label: "QUO_PHONE_NUMBER_ID" };
  }

  const raw = process.env.QUO_FROM_NUMBER?.trim();
  if (!raw) return null;
  if (PN_ID.test(raw) || raw.startsWith("PN")) return { from: raw.startsWith("PN") ? raw : `PN${raw}`, label: "QUO_FROM_NUMBER" };

  const e164 = toE164(raw);
  if (!e164) return null;
  return { from: e164, label: "QUO_FROM_NUMBER" };
}

type QuoErrorBody = {
  message?: string;
  code?: string;
  title?: string;
  description?: string;
};

function formatQuoFailure(status: number, text: string, fromLabel: string): string {
  let detail = text.slice(0, 900);
  try {
    const j = JSON.parse(text) as QuoErrorBody;
    if (j?.message) {
      detail = j.message;
      if (j.title) detail = `${j.title}: ${detail}`;
      if (j.code) detail += ` (Quo error ${j.code})`;
    }
  } catch {
    /* keep raw snippet */
  }

  const notFoundFrom =
    status === 404 &&
    /phone number not found/i.test(detail) &&
    fromLabel === "QUO_FROM_NUMBER";

  if (notFoundFrom) {
    detail +=
      " — This number is not in your Quo workspace. In the Quo app, open your number’s settings and copy its exact E.164 value, or set QUO_PHONE_NUMBER_ID to the PN… id from GET https://api.openphone.com/v1/phone-numbers (do not reuse a Twilio or other provider number).";
  }

  return detail;
}

export async function sendSms(toRaw: string, body: string): Promise<SendSmsResult> {
  const apiKey = process.env.QUO_API_KEY?.trim();
  const resolved = resolveQuoFrom();
  const userId = process.env.QUO_USER_ID?.trim();

  if (!apiKey || !resolved) {
    if (quoSmsMockEnabled()) {
      const mockSid = `AC_MOCK_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
      return { sid: mockSid, status: "queued-mock", body, to: toRaw };
    }
    throw new Error(
      "SMS was requested but Quo is not fully configured. Set QUO_API_KEY and either QUO_FROM_NUMBER (E.164 number from your Quo workspace) or QUO_PHONE_NUMBER_ID (PN… from GET /v1/phone-numbers). For local dev without Quo, set QUO_SMS_MOCK=true or turn off SMS on the send form.",
    );
  }

  const to = toE164(toRaw);
  if (!to) {
    throw new Error(
      `Invalid phone number for SMS: "${toRaw.trim() || "(empty)"}". Use E.164 (e.g. +15125551234) or a valid US number with area code.`,
    );
  }

  const payload: { content: string; from: string; to: string[]; userId?: string } = {
    content: body,
    from: resolved.from,
    to: [to],
  };
  if (userId) payload.userId = userId;

  const res = await fetch("https://api.openphone.com/v1/messages", {
    method: "POST",
    headers: { Authorization: apiKey, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    const detail = formatQuoFailure(res.status, text, resolved.label);
    throw new Error(`Quo SMS failed (HTTP ${res.status}): ${detail}`);
  }

  const json = (await res.json()) as {
    data?: { id?: string; status?: string; to?: string[] };
  };
  const data = json.data;
  return {
    sid: String(data?.id ?? ""),
    status: String(data?.status ?? "queued"),
    body,
    to: data?.to?.[0] ?? to,
  };
}
