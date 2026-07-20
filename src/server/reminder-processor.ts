import { getSignFlowStore } from "@/lib/db";
import { isActiveSigningRequest } from "@/lib/signing-request-active";
import { runReminderForRequest } from "@/server/signing-workflow";

export type ProcessDueRemindersResult = {
  due: number;
  processed: number;
  deferred: number;
  errors: { id: string; error: string }[];
};

/** Send SMS/email reminders for all signing requests past `nextReminderAt` (within 7 AM–8 PM US Central). */
export async function processDueReminders(): Promise<ProcessDueRemindersResult> {
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
  let deferred = 0;
  const errors: { id: string; error: string }[] = [];
  for (const r of due) {
    try {
      const out = await runReminderForRequest(r);
      if (out === "deferred") deferred += 1;
      else if (out) processed += 1;
    } catch (e) {
      errors.push({ id: r.id, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return { due: due.length, processed, deferred, errors };
}
