import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

const DEFAULT_REGION: CountryCode = "US";

export function formatPhoneE164(input: string, defaultRegion: CountryCode = DEFAULT_REGION): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const parsed = parsePhoneNumberFromString(trimmed, defaultRegion);
  if (!parsed?.isValid()) return null;
  return parsed.format("E.164");
}

export function formatPhoneNational(input: string, defaultRegion: CountryCode = DEFAULT_REGION): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  const parsed = parsePhoneNumberFromString(trimmed, defaultRegion);
  if (!parsed?.isValid()) return trimmed;
  return parsed.formatNational();
}
