import { fromZonedTime, toZonedTime } from "date-fns-tz";

/** Firm timezone — Ramos James Law (US Central, DST-aware). */
export const SIGNFLOW_TIMEZONE = "America/Chicago";

export type SignflowCalendarDate = {
  year: number;
  month: number;
  day: number;
};

function toDate(input: Date | string | number): Date {
  return input instanceof Date ? input : new Date(input);
}

export function getSignflowCalendarParts(date: Date): SignflowCalendarDate {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SIGNFLOW_TIMEZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  const n = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
  return { year: n("year"), month: n("month"), day: n("day") };
}

/** yyyy-MM-dd in US Central for an instant (ISO timestamps, reminder due checks, filters). */
export function toSignflowYmd(input: Date | string | number): string | null {
  const d = toDate(input);
  if (Number.isNaN(d.getTime())) return null;
  const { year, month, day } = getSignflowCalendarParts(d);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseIsoDateOnly(iso: string): SignflowCalendarDate | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

export function formatSignflowMonthLong(calendar: SignflowCalendarDate): string {
  return new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(calendar.year, calendar.month - 1, calendar.day)),
  );
}

export function formatSignflowMonthYear(calendar: SignflowCalendarDate): string {
  return `${formatSignflowMonthLong(calendar)} ${calendar.year}`;
}

/** Next calendar day in US Central at the given local hour (reminder “next morning”). */
export function nextSignflowMorningAfter(from: Date, hour: number, minute = 0): Date {
  const zoned = toZonedTime(from, SIGNFLOW_TIMEZONE);
  const next = new Date(zoned);
  next.setDate(next.getDate() + 1);
  next.setHours(hour, minute, 0, 0);
  return fromZonedTime(next, SIGNFLOW_TIMEZONE);
}

export function formatSignflowDateTime(input: Date | string | number): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: SIGNFLOW_TIMEZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(toDate(input));
}

export function formatSignflowShortDateTime(input: Date | string | number): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: SIGNFLOW_TIMEZONE,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(toDate(input));
}

export function formatSignflowTimestamp(input: Date | string | number): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: SIGNFLOW_TIMEZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(toDate(input));
}

export function formatSignflowDate(input: Date | string | number): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: SIGNFLOW_TIMEZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(toDate(input));
}
