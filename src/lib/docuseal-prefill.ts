import { format } from "date-fns";

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
  /** When the signing request is sent; defaults to now. */
  sentAt?: Date;
};

function parseIsoDateOnly(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Pre-fill DocuSeal submitter fields (excludes signature). */
export function buildDocusealPrefillFields(input: BuildDocusealPrefillInput): DocusealPrefillField[] {
  if (!isRjlEnglish2026Template(input.templateName)) return [];

  const dol = input.dateOfLoss ? parseIsoDateOnly(input.dateOfLoss) : null;
  if (!dol) return [];

  const today = input.sentAt ?? new Date();
  const F = RJL_ENGLISH_2026_FIELD;

  return [
    { name: F.clientName, default_value: input.clientName.trim(), readonly: true },
    { name: F.dolDayNumber, default_value: String(dol.getDate()), readonly: true },
    { name: F.dolMonthYear, default_value: format(dol, "MMMM yyyy"), readonly: true },
    { name: F.todayDayNumber, default_value: String(today.getDate()), readonly: true },
    { name: F.todayMonth, default_value: format(today, "MMMM"), readonly: true },
  ];
}

/** Never pre-fill signature or other signer-only fields. */
export function isSignerOnlyDocusealField(fieldName: string): boolean {
  return fieldName.trim().toLowerCase() === SIGNATURE_FIELD_LOWER;
}
