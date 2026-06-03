import { NextResponse } from "next/server";
import { getSignFlowStore } from "@/lib/db";
import { isActiveSigningRequest } from "@/lib/signing-request-active";
import { runReminderForRequest } from "@/server/signing-workflow";

export const dynamic = "force-dynamic";

/** Vercel Cron uses `vercel-cron/1.0`; manual runs can pass `x-cron-secret`. */
function isCronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return true;
  if (req.headers.get("x-cron-secret") === secret) return true;
  const ua = req.headers.get("user-agent") ?? "";
  if (ua.includes("vercel-cron")) return true;
  if (req.headers.get("x-vercel-cron-schedule")) return true;
  return false;
}

/**
 * Reminder cron — Vercel Cron (see vercel.json) or manual GET with optional `x-cron-secret`.
 */
export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
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
  const errors: { id: string; error: string }[] = [];
  for (const r of due) {
    try {
      const out = await runReminderForRequest(r);
      if (out) processed += 1;
    } catch (e) {
      errors.push({ id: r.id, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return NextResponse.json({ ok: true, due: due.length, processed, errors });
}
