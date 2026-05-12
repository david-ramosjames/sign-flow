import { addDays, addMinutes, setHours, startOfDay } from "date-fns";
import type { ReminderSchedule, ReminderStep } from "@/types/models";

function nextLocalMorningAfter(base: Date, hour: number): Date {
  const dayStart = startOfDay(base);
  let candidate = setHours(dayStart, hour);
  if (candidate.getTime() <= base.getTime()) {
    candidate = setHours(addDays(dayStart, 1), hour);
  }
  return candidate;
}

/**
 * Computes the next reminder time for a given step index (0-based).
 * TODO: Add explicit IANA timezone support (e.g. America/Chicago) — date-fns-tz recommended.
 */
export function computeNextReminderAt(sentAt: Date, schedule: ReminderSchedule, reminderCount: number): Date | null {
  if (!schedule.active || reminderCount >= schedule.maxReminders) return null;
  const step = schedule.steps[reminderCount];
  if (!step) return null;

  if (step.kind === "relative_minutes") {
    const minutes = step.delayMinutes ?? 0;
    return addMinutes(sentAt, minutes);
  }

  if (step.kind === "next_local_morning") {
    const hour = step.morningHour ?? 9;
    const minDelay = step.minDelayMinutes ?? 0;
    const anchor = addMinutes(sentAt, minDelay);
    return nextLocalMorningAfter(anchor, hour);
  }

  return null;
}

export function describeReminderStep(step: ReminderStep): string {
  if (step.kind === "relative_minutes") return `${step.delayMinutes ?? 0} min after send`;
  return `Next morning @ ${String(step.morningHour ?? 9)}:00 (local server time — TODO timezone)`;
}
