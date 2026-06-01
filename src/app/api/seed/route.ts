import { NextResponse } from "next/server";
import { getSignFlowStore } from "@/lib/db";
import { requireSessionUser } from "@/lib/auth/get-session";
import { nowIso } from "@/lib/time";
import type { AppSettings } from "@/types/models";
import { isGmailWorkspaceDelegationConfigured } from "@/services/gmail-workspace-dwd";

export async function POST() {
  try {
    await requireSessionUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const store = getSignFlowStore();
  const results: string[] = [];

  if (!(await store.getAppSettings())) {
    const settings: AppSettings = {
      id: "default",
      docusealConfigured: Boolean(process.env.DOCUSEAL_API_KEY),
      smsConfigured: Boolean(process.env.QUO_API_KEY && process.env.QUO_FROM_NUMBER),
      dropboxConfigured: Boolean(process.env.DROPBOX_ACCESS_TOKEN),
      slackWebhookConfigured: Boolean(process.env.SLACK_WEBHOOK_URL),
      emailConfigured: Boolean(
        isGmailWorkspaceDelegationConfigured() ||
          process.env.SENDGRID_API_KEY ||
          (process.env.GOOGLE_REFRESH_TOKEN && process.env.GOOGLE_EMAIL_FROM),
      ),
      updatedAt: nowIso(),
    };
    await store.upsertAppSettings(settings);
    results.push("Seeded app settings");
  } else {
    results.push("Skipped app settings (already present)");
  }

  return NextResponse.json({ ok: true, results, store: store.isMock ? "mock" : "firestore" });
}
