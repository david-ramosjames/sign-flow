import { NextResponse } from "next/server";
import { getSignFlowStore } from "@/lib/db";
import { isActiveSigningRequest } from "@/lib/signing-request-active";
import { runReminderForRequest } from "@/server/signing-workflow";

/**
 * Reminder cron — call from Vercel Cron / Railway scheduler with `CRON_SECRET` header `x-cron-secret`.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("x-cron-secret");
  if (secret && header !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const store = getSignFlowStore();
  const items = await store.listSigningRequests();
  const now = Date.now();
  const due = items.filter(
    (r) =>
      isActiveSigningRequest(r) &&
      r.reminderEnabled &&
      r.nextReminderAt &&
      new Date(r.nextReminderAt).getTime() <= now,
  );

  let processed = 0;
  for (const r of due) {
    const out = await runReminderForRequest(r);
    if (out) processed += 1;
  }

  return NextResponse.json({ ok: true, due: due.length, processed });
}
