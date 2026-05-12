import { NextResponse } from "next/server";
import { getRelayStore } from "@/lib/db";
import { requireSessionUser } from "@/lib/auth/get-session";
import { seedDocumentTemplates, seedMessageTemplates } from "@/lib/seed-data";
import { buildDefaultReminderSchedule } from "@/lib/default-reminder-schedule";
import { nowIso } from "@/lib/time";
import type { AppSettings, StaffUser } from "@/types/models";

export async function POST() {
  try {
    await requireSessionUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const store = getRelayStore();
  const results: string[] = [];

  const existingTemplates = await store.listDocumentTemplates();
  if (existingTemplates.length === 0) {
    const templates = seedDocumentTemplates();
    for (const t of templates) {
      await store.upsertDocumentTemplate(t);
    }
    results.push(`Seeded ${templates.length} document templates`);
  } else {
    results.push("Skipped templates (already present)");
  }

  const existingMsgs = await store.listMessageTemplates();
  if (existingMsgs.length === 0) {
    const msgs = seedMessageTemplates();
    for (const m of msgs) {
      await store.upsertMessageTemplate(m);
    }
    results.push(`Seeded ${msgs.length} message templates`);
  } else {
    results.push("Skipped message templates (already present)");
  }

  const existingSched = await store.listReminderSchedules();
  if (existingSched.length === 0) {
    await store.upsertReminderSchedule(buildDefaultReminderSchedule());
    results.push("Seeded default reminder schedule");
  } else {
    results.push("Skipped reminder schedule (already present)");
  }

  const staff = await store.listStaffUsers();
  if (staff.length === 0) {
    const t = nowIso();
    const s: StaffUser = {
      id: "staff_seed_intake",
      displayName: "Intake Team",
      email: "intake@ramosjameslaw.example",
      role: "staff",
      active: true,
      createdAt: t,
      updatedAt: t,
    };
    await store.upsertStaffUser(s);
    results.push("Seeded sample staff user");
  } else {
    results.push("Skipped staff (already present)");
  }

  if (!(await store.getAppSettings())) {
    const settings: AppSettings = {
      id: "default",
      adobeClientIdLast4: process.env.ADOBE_CLIENT_ID ? process.env.ADOBE_CLIENT_ID.slice(-4) : null,
      twilioConfigured: Boolean(process.env.TWILIO_ACCOUNT_SID),
      smsFromNumberOrService: process.env.TWILIO_MESSAGING_SERVICE_SID ?? process.env.TWILIO_FROM_NUMBER ?? null,
      defaultLanguage: "en",
      slackWebhookConfigured: Boolean(process.env.SLACK_WEBHOOK_URL),
      updatedAt: nowIso(),
    };
    await store.upsertAppSettings(settings);
    results.push("Seeded app settings");
  } else {
    results.push("Skipped app settings (already present)");
  }

  return NextResponse.json({ ok: true, results, store: store.isMock ? "mock" : "firestore" });
}
