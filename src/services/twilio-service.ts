import { parsePhoneNumberFromString } from "libphonenumber-js";

export type SendSmsResult = {
  sid: string;
  status: string;
  body: string;
  to: string;
};

/** True when real SMS can be sent (all three Twilio env vars set). */
export function isTwilioSmsConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID?.trim() &&
      process.env.TWILIO_AUTH_TOKEN?.trim() &&
      process.env.TWILIO_FROM_NUMBER?.trim(),
  );
}

function twilioSmsMockEnabled(): boolean {
  return process.env.TWILIO_SMS_MOCK?.trim().toLowerCase() === "true";
}

function toE164(raw: string): string | null {
  const p = parsePhoneNumberFromString(raw, "US");
  if (p?.isValid()) return p.number;
  const p2 = parsePhoneNumberFromString(raw.startsWith("+") ? raw : `+${raw.replace(/\D/g, "")}`);
  return p2?.isValid() ? p2.number : null;
}

export async function sendSms(toRaw: string, body: string): Promise<SendSmsResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = process.env.TWILIO_FROM_NUMBER?.trim();
  if (!sid || !token || !from) {
    if (twilioSmsMockEnabled()) {
      const mockSid = `SM_MOCK_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
      return { sid: mockSid, status: "queued-mock", body, to: toRaw };
    }
    throw new Error(
      "SMS was requested but Twilio is not fully configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER (E.164, e.g. +18557748203). For local dev without Twilio, set TWILIO_SMS_MOCK=true or turn off SMS on the send form.",
    );
  }
  const to = toE164(toRaw);
  if (!to) {
    throw new Error(
      `Invalid phone number for SMS: "${toRaw.trim() || "(empty)"}". Use E.164 (e.g. +15125551234) or a valid US number with area code.`,
    );
  }
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const params = new URLSearchParams({ To: to, From: from, Body: body });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: { authorization: `Basic ${auth}`, "content-type": "application/x-www-form-urlencoded" },
    body: params,
  });
  if (!res.ok) {
    const text = await res.text();
    let detail = text.slice(0, 900);
    try {
      const j = JSON.parse(text) as { message?: string; code?: number | string; more_info?: string };
      if (j?.message) {
        detail = j.message;
        if (j.code != null) detail += ` (Twilio error ${j.code})`;
        if (j.more_info && typeof j.more_info === "string") detail += ` — ${j.more_info}`;
      }
    } catch {
      /* keep raw snippet */
    }
    throw new Error(`Twilio SMS failed (HTTP ${res.status}): ${detail}`);
  }
  const json = (await res.json()) as { sid?: string; status?: string };
  return { sid: String(json.sid ?? ""), status: String(json.status ?? "queued"), body, to };
}
