import { addHours, addMinutes } from "date-fns";
import type { ReminderScheduleSettings } from "@/types/models";
import { DEFAULT_REMINDER_SCHEDULE } from "@/lib/reminder-schedule";
import { nextSignflowMorningAfter } from "@/lib/signflow-timezone";

/**
 * Automated reminder schedule after initial send.
 * Step 1: `firstReminderAfterSendMinutes` after send.
 * Step 2: next calendar day at `secondReminderLocalHour` US Central after step-1 anchor time.
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
    return nextSignflowMorningAfter(first, schedule.secondReminderLocalHour, 0);
  }
  const morning = nextSignflowMorningAfter(first, schedule.secondReminderLocalHour, 0);
  if (input.reminderCount === 2) return addHours(morning, schedule.thirdReminderHoursAfterSecond);
  return null;
}

export const MAX_AUTO_REMINDERS = DEFAULT_REMINDER_SCHEDULE.maxAutoReminders;
