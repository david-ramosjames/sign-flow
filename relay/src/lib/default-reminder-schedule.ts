import type { ReminderSchedule, ReminderStep } from "@/types/models";
import { nowIso, newId } from "@/lib/time";

/**
 * Default operational schedule (MVP):
 * - Immediate send happens when staff clicks Send (not a reminder step).
 * - Reminder 1: 30 minutes
 * - Reminder 2: 2 hours
 * - Reminder 3: next local morning 9:00 (see reminder engine TODO for timezone handling)
 * - Reminder 4: 24 hours
 * - Then intake call alert (handled in cron when max reached)
 */
export function buildDefaultReminderSchedule(): ReminderSchedule {
  const t = nowIso();
  const steps: ReminderStep[] = [
    {
      id: newId("step"),
      kind: "relative_minutes",
      delayMinutes: 30,
      channel: "sms",
    },
    {
      id: newId("step"),
      kind: "relative_minutes",
      delayMinutes: 120,
      channel: "both",
    },
    {
      id: newId("step"),
      kind: "next_local_morning",
      minDelayMinutes: 120,
      morningHour: 9,
      channel: "sms",
    },
    {
      id: newId("step"),
      kind: "relative_minutes",
      delayMinutes: 24 * 60,
      channel: "both",
    },
  ];
  return {
    id: newId("sched"),
    name: "Default — intake follow-ups",
    active: true,
    steps,
    maxReminders: 4,
    createdAt: t,
    updatedAt: t,
  };
}
