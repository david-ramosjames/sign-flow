import { addHours, addMinutes } from "date-fns";
import type { ReminderScheduleSettings } from "@/types/models";
import { DEFAULT_REMINDER_SCHEDULE } from "@/lib/reminder-schedule";

function nextLocalMorningAfter(from: Date, hour: number, minute: number): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + 1);
  d.setHours(hour, minute, 0, 0);
  return d;
}

/**
 * Automated reminder schedule after initial send.
 * Step 1: `firstReminderAfterSendMinutes` after send.
 * Step 2: next calendar day at `secondReminderLocalHour` (server local TZ) after step-1 anchor time.
 * Step 3: `thirdReminderHoursAfterSecond` hours after that second anchor.
 */
export function computeNextReminderAt(
  input: { sentAt: Date; reminderCount: number },
  schedule: ReminderScheduleSettings = DEFAULT_REMINDER_SCHEDULE,
): Date | null {
  const max = schedule.maxAutoReminders;
  if (input.reminderCount >= max) return null;
  const sent = input.sentAt;
  if (input.reminderCount === 0) return addMinutes(sent, schedule.firstReminderAfterSendMinutes);
  const first = addMinutes(sent, schedule.firstReminderAfterSendMinutes);
  if (input.reminderCount === 1) {
    return nextLocalMorningAfter(first, schedule.secondReminderLocalHour, 0);
  }
  const morning = nextLocalMorningAfter(first, schedule.secondReminderLocalHour, 0);
  if (input.reminderCount === 2) return addHours(morning, schedule.thirdReminderHoursAfterSecond);
  return null;
}

export const MAX_AUTO_REMINDERS = DEFAULT_REMINDER_SCHEDULE.maxAutoReminders;
