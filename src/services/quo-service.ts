import { parsePhoneNumberFromString } from "libphonenumber-js";

export type SendSmsResult = {
  sid: string;
  status: string;
  body: string;
  to: string;
};

/** True when real SMS can be sent (Quo API key + from number set). */
export function isQuoSmsConfigured(): boolean {
  return Boolean(process.env.QUO_API_KEY?.trim() && process.env.QUO_FROM_NUMBER?.trim());
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

type QuoErrorBody = {
  message?: string;
  code?: string;
  title?: string;
  description?: string;
};

export async function sendSms(toRaw: string, body: string): Promise<SendSmsResult> {
  const apiKey = process.env.QUO_API_KEY?.trim();
  const from = process.env.QUO_FROM_NUMBER?.trim();
  const userId = process.env.QUO_USER_ID?.trim();

  if (!apiKey || !from) {
    if (quoSmsMockEnabled()) {
      const mockSid = `AC_MOCK_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
      return { sid: mockSid, status: "queued-mock", body, to: toRaw };
    }
    throw new Error(
      "SMS was requested but Quo is not fully configured. Set QUO_API_KEY and QUO_FROM_NUMBER (E.164 Quo/OpenPhone number, e.g. +18557748203). For local dev without Quo, set QUO_SMS_MOCK=true or turn off SMS on the send form.",
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
    from,
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
