import type { AppSettings, ReminderScheduleSettings } from "@/types/models";

export const DEFAULT_REMINDER_SCHEDULE: ReminderScheduleSettings = {
  firstReminderAfterSendMinutes: 30,
  secondReminderLocalHour: 9,
  thirdReminderHoursAfterSecond: 24,
  maxAutoReminders: 3,
};

export function mergeReminderSchedule(settings: AppSettings | null): ReminderScheduleSettings {
  const o = settings?.reminderSchedule;
  const merged = !o ? { ...DEFAULT_REMINDER_SCHEDULE } : { ...DEFAULT_REMINDER_SCHEDULE, ...o };
  // Keep the “next morning” hour inside the client send window (7 AM–8 PM US Central).
  merged.secondReminderLocalHour = Math.min(20, Math.max(7, merged.secondReminderLocalHour));
  return merged;
}
