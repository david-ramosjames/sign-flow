import type { AppSettings } from "@/types/models";

/** `null` means auto-cancel is off. */
export function normalizeAutoCancelUnsignedAfterDays(
  value: number | null | undefined,
): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const n = Math.floor(value);
  if (n <= 0) return null;
  return Math.min(365, n);
}

/** Reads the current setting, with fallback to the older contract-only field name. */
export function autoCancelUnsignedAfterDaysFromSettings(
  settings: AppSettings | null | undefined,
): number | null {
  const primary = normalizeAutoCancelUnsignedAfterDays(settings?.autoCancelUnsignedAfterDays);
  if (primary != null) return primary;
  return normalizeAutoCancelUnsignedAfterDays(settings?.autoCancelUnsignedContractsAfterDays);
}

/** @deprecated Prefer `normalizeAutoCancelUnsignedAfterDays`. */
export const normalizeAutoCancelUnsignedContractsAfterDays = normalizeAutoCancelUnsignedAfterDays;

/** @deprecated Prefer `autoCancelUnsignedAfterDaysFromSettings`. */
export const autoCancelUnsignedContractsAfterDaysFromSettings = autoCancelUnsignedAfterDaysFromSettings;

/** True when `sentAt` (or `createdAt`) is at least `days` full days in the past. */
export function isPastAutoCancelAge(
  sentAt: string | null | undefined,
  createdAt: string | null | undefined,
  days: number,
  nowMs: number = Date.now(),
): boolean {
  const raw = sentAt?.trim() || createdAt?.trim();
  if (!raw) return false;
  const sentMs = new Date(raw).getTime();
  if (!Number.isFinite(sentMs)) return false;
  return nowMs - sentMs >= days * 24 * 60 * 60 * 1000;
}
