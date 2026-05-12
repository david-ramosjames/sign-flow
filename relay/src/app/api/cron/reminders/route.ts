import { NextResponse } from "next/server";
import { getRelayStore } from "@/lib/db";

/**
 * Reminder cron (Phase 2):
 * - Secure this route with `CRON_SECRET` header or Vercel Cron auth.
 * - Query signing requests where nextReminderAt <= now and remindersEnabled && !remindersPaused.
 * - Re-fetch Adobe agreement status before sending.
 * - Send SMS/email per schedule step and increment reminderCount.
 *
 * MVP: returns a TODO summary and counts only.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("x-cron-secret");
  if (secret && header !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const store = getRelayStore();
  const items = await store.listSigningRequests();
  const due = items.filter((i) => i.nextReminderAt && i.remindersEnabled && !i.remindersPaused);
  return NextResponse.json({
    ok: true,
    note: "MVP stub — implement Adobe status check + Twilio resend in Phase 2.",
    candidates: due.length,
  });
}
