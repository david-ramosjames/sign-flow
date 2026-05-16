import type { AppSettings, ReminderScheduleSettings } from "@/types/models";

export const DEFAULT_REMINDER_SCHEDULE: ReminderScheduleSettings = {
  firstReminderAfterSendMinutes: 30,
  secondReminderLocalHour: 9,
  thirdReminderHoursAfterSecond: 24,
  maxAutoReminders: 3,
};

export function mergeReminderSchedule(settings: AppSettings | null): ReminderScheduleSettings {
  const o = settings?.reminderSchedule;
  if (!o) return { ...DEFAULT_REMINDER_SCHEDULE };
  return {
    ...DEFAULT_REMINDER_SCHEDULE,
    ...o,
  };
}
