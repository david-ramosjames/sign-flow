import { NextResponse } from "next/server";
import { z } from "zod";
import { getRelayStore } from "@/lib/db";
import { requireSessionUser } from "@/lib/auth/get-session";
import { nowIso } from "@/lib/time";
import type { AppSettings } from "@/types/models";

const patchSchema = z.object({
  adobeClientIdLast4: z.string().nullable().optional(),
  twilioConfigured: z.boolean().optional(),
  smsFromNumberOrService: z.string().nullable().optional(),
  defaultLanguage: z.enum(["en", "es"]).optional(),
  slackWebhookConfigured: z.boolean().optional(),
});

export async function GET() {
  try {
    await requireSessionUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const store = getRelayStore();
  const existing = await store.getAppSettings();
  return NextResponse.json({
    item: existing,
    env: {
      hasAdobeClientId: Boolean(process.env.ADOBE_CLIENT_ID),
      hasAdobeClientSecret: Boolean(process.env.ADOBE_CLIENT_SECRET),
      hasAdobeRefreshToken: Boolean(process.env.ADOBE_REFRESH_TOKEN),
      hasAdobeBaseUrl: Boolean(process.env.ADOBE_BASE_URL),
      hasTwilioAccountSid: Boolean(process.env.TWILIO_ACCOUNT_SID),
      hasTwilioAuthToken: Boolean(process.env.TWILIO_AUTH_TOKEN),
      hasTwilioMessagingServiceSid: Boolean(process.env.TWILIO_MESSAGING_SERVICE_SID),
      hasTwilioFromNumber: Boolean(process.env.TWILIO_FROM_NUMBER),
      hasSlackWebhook: Boolean(process.env.SLACK_WEBHOOK_URL),
    },
  });
}

export async function PATCH(req: Request) {
  try {
    await requireSessionUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const store = getRelayStore();
  const existing =
    (await store.getAppSettings()) ??
    ({
      id: "default",
      adobeClientIdLast4: null,
      twilioConfigured: false,
      smsFromNumberOrService: null,
      defaultLanguage: "en",
      slackWebhookConfigured: false,
      updatedAt: nowIso(),
    } satisfies AppSettings);

  const updated: AppSettings = {
    ...existing,
    ...parsed.data,
    id: "default",
    updatedAt: nowIso(),
  };
  await store.upsertAppSettings(updated);
  return NextResponse.json({ item: updated });
}
