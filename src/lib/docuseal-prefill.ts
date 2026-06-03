import {
  formatSignflowMonthLong,
  formatSignflowMonthYear,
  getSignflowCalendarParts,
  parseIsoDateOnly,
} from "@/lib/signflow-timezone";

/** DocuSeal field names on "Contract Ramos James Law ENGLISH 2026" (and variants). */
export const RJL_ENGLISH_2026_FIELD = {
  clientName: "client name",
  dolDayNumber: "dol day number",
  dolMonthYear: "dol month year",
  todayDayNumber: "today day number",
  todayMonth: "today month",
  signature: "signature",
} as const;

const SIGNATURE_FIELD_LOWER = RJL_ENGLISH_2026_FIELD.signature.toLowerCase();

export function isRjlEnglish2026Template(templateName: string): boolean {
  return /ramos james law english 2026/i.test(templateName);
}

export function templateRequiresDateOfLoss(templateName: string): boolean {
  return isRjlEnglish2026Template(templateName);
}

export type DocusealPrefillField = {
  name: string;
  default_value: string;
  readonly?: boolean;
};

export type BuildDocusealPrefillInput = {
  templateName: string;
  clientName: string;
  /** ISO date (yyyy-MM-dd) for date of loss. */
  dateOfLoss: string | null;
  /** When the signing request is sent; defaults to now (US Central calendar for “today”). */
  sentAt?: Date;
};

/** Pre-fill DocuSeal submitter fields (excludes signature). */
export function buildDocusealPrefillFields(input: BuildDocusealPrefillInput): DocusealPrefillField[] {
  if (!isRjlEnglish2026Template(input.templateName)) return [];

  const dol = input.dateOfLoss ? parseIsoDateOnly(input.dateOfLoss) : null;
  if (!dol) return [];

  const today = getSignflowCalendarParts(input.sentAt ?? new Date());
  const F = RJL_ENGLISH_2026_FIELD;

  return [
    { name: F.clientName, default_value: input.clientName.trim(), readonly: true },
    { name: F.dolDayNumber, default_value: String(dol.day), readonly: true },
    { name: F.dolMonthYear, default_value: formatSignflowMonthYear(dol), readonly: true },
    { name: F.todayDayNumber, default_value: String(today.day), readonly: true },
    { name: F.todayMonth, default_value: formatSignflowMonthLong(today), readonly: true },
  ];
}

/** Never pre-fill signature or other signer-only fields. */
export function isSignerOnlyDocusealField(fieldName: string): boolean {
  return fieldName.trim().toLowerCase() === SIGNATURE_FIELD_LOWER;
}
