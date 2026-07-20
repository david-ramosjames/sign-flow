import { addHours, addMinutes } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import type { ReminderScheduleSettings } from "@/types/models";
import { DEFAULT_REMINDER_SCHEDULE } from "@/lib/reminder-schedule";
import { nextSignflowMorningAfter, SIGNFLOW_TIMEZONE } from "@/lib/signflow-timezone";

/** US Central: no client reminders before this hour (inclusive). */
export const REMINDER_SEND_EARLIEST_HOUR = 7;
/** US Central: no client reminders after this hour (inclusive through :00, e.g. 8:00 PM ok, 8:01 PM not). */
export const REMINDER_SEND_LATEST_HOUR = 20;

function localMinutes(date: Date): number {
  const zoned = toZonedTime(date, SIGNFLOW_TIMEZONE);
  return zoned.getHours() * 60 + zoned.getMinutes();
}

/** True when `date` falls in the 7:00 AM–8:00 PM US Central send window. */
export function isWithinReminderSendWindow(date: Date = new Date()): boolean {
  const minutes = localMinutes(date);
  return minutes >= REMINDER_SEND_EARLIEST_HOUR * 60 && minutes <= REMINDER_SEND_LATEST_HOUR * 60;
}

/**
 * Move a scheduled reminder into the allowed US Central window.
 * Before 7 AM → same day 7:00 AM. After 8:00 PM → next day 7:00 AM.
 */
export function clampToReminderSendWindow(date: Date): Date {
  if (isWithinReminderSendWindow(date)) return date;
  const zoned = toZonedTime(date, SIGNFLOW_TIMEZONE);
  const adjusted = new Date(zoned);
  if (localMinutes(date) < REMINDER_SEND_EARLIEST_HOUR * 60) {
    adjusted.setHours(REMINDER_SEND_EARLIEST_HOUR, 0, 0, 0);
  } else {
    adjusted.setDate(adjusted.getDate() + 1);
    adjusted.setHours(REMINDER_SEND_EARLIEST_HOUR, 0, 0, 0);
  }
  return fromZonedTime(adjusted, SIGNFLOW_TIMEZONE);
}

/**
 * Automated reminder schedule after initial send.
 * Step 1: `firstReminderAfterSendMinutes` after send.
 * Step 2: next calendar day at `secondReminderLocalHour` US Central after step-1 anchor time.
 * Step 3: `thirdReminderHoursAfterSecond` hours after that second anchor.
 * All steps are clamped to 7 AM–8 PM US Central.
 */
export function computeNextReminderAt(
  input: { sentAt: Date; reminderCount: number },
  schedule: ReminderScheduleSettings = DEFAULT_REMINDER_SCHEDULE,
): Date | null {
  const max = schedule.maxAutoReminders;
  if (input.reminderCount >= max) return null;
  const sent = input.sentAt;
  let raw: Date;
  if (input.reminderCount === 0) {
    raw = addMinutes(sent, schedule.firstReminderAfterSendMinutes);
  } else {
    const first = addMinutes(sent, schedule.firstReminderAfterSendMinutes);
    if (input.reminderCount === 1) {
      raw = nextSignflowMorningAfter(first, schedule.secondReminderLocalHour, 0);
    } else {
      const morning = nextSignflowMorningAfter(first, schedule.secondReminderLocalHour, 0);
      if (input.reminderCount === 2) {
        raw = addHours(morning, schedule.thirdReminderHoursAfterSecond);
      } else {
        return null;
      }
    }
  }
  return clampToReminderSendWindow(raw);
}

export const MAX_AUTO_REMINDERS = DEFAULT_REMINDER_SCHEDULE.maxAutoReminders;
