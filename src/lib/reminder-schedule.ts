import type { AppSettings, ReminderScheduleSettings } from "@/types/models";

/** Default sequence: day 0 (+30m), then days 1, 2, 3, 5, 7 at the morning hour. */
export const DEFAULT_FOLLOW_UP_DAYS_AFTER_SEND = [1, 2, 3, 5, 7] as const;

export const DEFAULT_REMINDER_SCHEDULE: ReminderScheduleSettings = {
  firstReminderAfterSendMinutes: 30,
  secondReminderLocalHour: 9,
  followUpDaysAfterSend: [...DEFAULT_FOLLOW_UP_DAYS_AFTER_SEND],
  thirdReminderHoursAfterSecond: 24,
  maxAutoReminders: 1 + DEFAULT_FOLLOW_UP_DAYS_AFTER_SEND.length,
};

function sanitizeFollowUpDays(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [...DEFAULT_FOLLOW_UP_DAYS_AFTER_SEND];
  const days = raw
    .map((d) => (typeof d === "number" ? d : Number(d)))
    .filter((d) => Number.isFinite(d) && d >= 1 && d <= 30)
    .map((d) => Math.floor(d));
  const unique = [...new Set(days)].sort((a, b) => a - b);
  return unique.length > 0 ? unique : [...DEFAULT_FOLLOW_UP_DAYS_AFTER_SEND];
}

export function mergeReminderSchedule(settings: AppSettings | null): ReminderScheduleSettings {
  const o = settings?.reminderSchedule;
  const hasExplicitDays = Array.isArray(o?.followUpDaysAfterSend) && o.followUpDaysAfterSend.length > 0;

  const merged: ReminderScheduleSettings = {
    ...DEFAULT_REMINDER_SCHEDULE,
    ...(o ?? {}),
    followUpDaysAfterSend: hasExplicitDays
      ? sanitizeFollowUpDays(o!.followUpDaysAfterSend)
      : [...DEFAULT_FOLLOW_UP_DAYS_AFTER_SEND],
  };

  // Keep the follow-up hour inside the client send window (7 AM–8 PM US Central).
  merged.secondReminderLocalHour = Math.min(20, Math.max(7, merged.secondReminderLocalHour));

  // Legacy docs only had maxAutoReminders: 3 — raise to cover the new day sequence once.
  if (!hasExplicitDays && (o?.maxAutoReminders == null || o.maxAutoReminders <= 3)) {
    merged.maxAutoReminders = DEFAULT_REMINDER_SCHEDULE.maxAutoReminders;
  } else {
    merged.maxAutoReminders = Math.min(20, Math.max(1, Math.floor(merged.maxAutoReminders) || 6));
  }

  // Sequence cannot run past the day list + day-0 short reminder.
  const sequenceLen = 1 + merged.followUpDaysAfterSend.length;
  if (merged.maxAutoReminders > sequenceLen) {
    merged.maxAutoReminders = sequenceLen;
  }

  return merged;
}
