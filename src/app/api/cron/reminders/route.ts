import { NextResponse } from "next/server";
import { processDueReminders } from "@/server/reminder-processor";

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
 * Reminder sweep — runs on Vercel Cron (every 15 minutes; see vercel.json).
 * Due reminders are also processed when staff load the dashboard as a backup.
 */
export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { due, processed, deferred, errors } = await processDueReminders();
  return NextResponse.json({ ok: true, due, processed, deferred, errors });
}
