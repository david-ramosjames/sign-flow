import type { AppSettings, ReminderScheduleSettings, ReminderStep, SigningFormKind } from "@/types/models";

/** Default sequence: day 0 (+30m), then days 1, 2, 3, 5, 7 at the morning hour. */
export const DEFAULT_FOLLOW_UP_DAYS_AFTER_SEND = [1, 2, 3, 5, 7] as const;

export function buildDefaultSteps(
  firstMinutes = 30,
  hour = 9,
  days: readonly number[] = DEFAULT_FOLLOW_UP_DAYS_AFTER_SEND,
): ReminderStep[] {
  const steps: ReminderStep[] = [
    { day: 0, hour, minutesAfterSend: firstMinutes, smsTemplate: "", smsTemplateEs: "" },
  ];
  for (const d of days) {
    steps.push({ day: d, hour, smsTemplate: "", smsTemplateEs: "" });
  }
  return steps;
}

export const DEFAULT_REMINDER_SCHEDULE: ReminderScheduleSettings = {
  firstReminderAfterSendMinutes: 30,
  secondReminderLocalHour: 9,
  followUpDaysAfterSend: [...DEFAULT_FOLLOW_UP_DAYS_AFTER_SEND],
  thirdReminderHoursAfterSecond: 24,
  maxAutoReminders: 1 + DEFAULT_FOLLOW_UP_DAYS_AFTER_SEND.length,
  steps: buildDefaultSteps(),
  contractSteps: buildDefaultSteps(),
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

export function sanitizeSteps(raw: unknown, fallbackHour: number): ReminderStep[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return raw
    .filter((s): s is Record<string, unknown> => s && typeof s === "object")
    .map((s) => {
      const step: ReminderStep = {
        day: Math.max(0, Math.floor(Number(s.day) || 0)),
        hour: Math.min(20, Math.max(7, Math.floor(Number(s.hour) || fallbackHour))),
        smsTemplate: typeof s.smsTemplate === "string" ? s.smsTemplate : "",
        smsTemplateEs: typeof s.smsTemplateEs === "string" ? s.smsTemplateEs : "",
      };
      if (s.minutesAfterSend != null) {
        step.minutesAfterSend = Math.max(5, Math.floor(Number(s.minutesAfterSend) || 30));
      }
      return step;
    })
    .sort((a, b) => a.day - b.day || (a.minutesAfterSend ?? 0) - (b.minutesAfterSend ?? 0));
}

function stepsFromLegacy(schedule: ReminderScheduleSettings): ReminderStep[] {
  const days = schedule.followUpDaysAfterSend ?? [...DEFAULT_FOLLOW_UP_DAYS_AFTER_SEND];
  return buildDefaultSteps(schedule.firstReminderAfterSendMinutes, schedule.secondReminderLocalHour, days);
}

function cloneSteps(steps: ReminderStep[]): ReminderStep[] {
  return steps.map((s) => ({ ...s }));
}

export function mergeReminderSchedule(settings: AppSettings | null): ReminderScheduleSettings {
  const o = settings?.reminderSchedule;
  const hasExplicitSteps = Array.isArray(o?.steps) && o.steps.length > 0;
  const hasExplicitDays = Array.isArray(o?.followUpDaysAfterSend) && o.followUpDaysAfterSend.length > 0;
  const hasExplicitContractSteps = Array.isArray(o?.contractSteps) && o.contractSteps.length > 0;

  const merged: ReminderScheduleSettings = {
    ...DEFAULT_REMINDER_SCHEDULE,
    ...(o ?? {}),
    followUpDaysAfterSend: hasExplicitDays
      ? sanitizeFollowUpDays(o!.followUpDaysAfterSend)
      : [...DEFAULT_FOLLOW_UP_DAYS_AFTER_SEND],
  };

  merged.secondReminderLocalHour = Math.min(20, Math.max(7, merged.secondReminderLocalHour));

  if (hasExplicitSteps) {
    merged.steps = sanitizeSteps(o!.steps, merged.secondReminderLocalHour);
    merged.followUpDaysAfterSend = merged.steps.filter((s) => s.day > 0).map((s) => s.day);
    merged.firstReminderAfterSendMinutes = merged.steps.find((s) => s.day === 0)?.minutesAfterSend ?? 30;
  } else {
    merged.steps = stepsFromLegacy(merged);
  }

  merged.contractSteps = hasExplicitContractSteps
    ? sanitizeSteps(o!.contractSteps, merged.secondReminderLocalHour)
    : cloneSteps(merged.steps);

  const longest = Math.max(merged.steps.length, merged.contractSteps.length);
  if (!hasExplicitDays && !hasExplicitSteps && (o?.maxAutoReminders == null || o.maxAutoReminders <= 3)) {
    merged.maxAutoReminders = longest;
  } else {
    merged.maxAutoReminders = Math.min(20, Math.max(1, Math.floor(merged.maxAutoReminders) || longest));
  }

  return merged;
}

/** Apply one sequence’s steps onto a copy of the merged schedule for cadence + SMS lookup. */
export function scheduleWithSteps(
  schedule: ReminderScheduleSettings,
  steps: ReminderStep[],
): ReminderScheduleSettings {
  const list = steps.length > 0 ? steps : schedule.steps ?? [];
  return {
    ...schedule,
    steps: list,
    firstReminderAfterSendMinutes: list.find((s) => s.day === 0)?.minutesAfterSend ?? schedule.firstReminderAfterSendMinutes,
    followUpDaysAfterSend: list.filter((s) => s.day > 0).map((s) => s.day),
    maxAutoReminders: list.length,
  };
}

export function reminderScheduleForFormKind(
  settings: AppSettings | null,
  formKind: SigningFormKind | null | undefined,
): ReminderScheduleSettings {
  const merged = mergeReminderSchedule(settings);
  const steps =
    formKind === "contract"
      ? (merged.contractSteps?.length ? merged.contractSteps : merged.steps ?? [])
      : (merged.steps ?? []);
  return scheduleWithSteps(merged, steps);
}
