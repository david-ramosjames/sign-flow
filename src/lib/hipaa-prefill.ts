import {
  formatSignflowUsSlashDate,
  parseIsoDateOnly,
} from "@/lib/signflow-timezone";
import type { HipaaFormPrefill } from "@/types/models";

type PrefillField = {
  name: string;
  default_value: string;
  readonly?: boolean;
};
export const RJL_HIPAA_FIELD = {
  lastName: "last-name",
  firstName: "first-name",
  middleName: "middle-name",
  otherName: "other-name",
  monthDob: "month-date-of-birth",
  dayDob: "day-date-of-birth",
  yearDob: "year-date-of-birth",
  address: "address",
  city: "city",
  state: "state",
  zipCode: "zip-cide",
  phone: "phone",
  altPhone: "alt-phone",
  email: "email",
  legal: "legal",
  allHealth: "all-health",
  todayDate: "today-date",
  nameAuthorizedRepForMinor: "name-authorized-rep-for-minor",
  parent: "parent",
  guardian: "guadian",
  other: "other",
  minorSignature: "minor-signature",
  minorTodayDate: "minor-today-date",
  signature: "signature",
} as const;

export function hipaaClientDisplayName(data: HipaaFormPrefill): string {
  return [data.firstName, data.middleName, data.lastName].filter((p) => p?.trim()).join(" ").trim();
}

export function validateHipaaPrefill(data: HipaaFormPrefill): void {
  if (!data.lastName.trim()) throw new Error("Last name is required for the HIPAA form.");
  if (!data.firstName.trim()) throw new Error("First name is required for the HIPAA form.");
  if (!data.legalAcknowledged) throw new Error("Confirm the legal authorization checkbox before sending.");
  if (!data.allHealthAcknowledged) throw new Error("Confirm the all-health authorization checkbox before sending.");
}

function checkboxValue(checked: boolean): string {
  return checked ? "true" : "false";
}

function optionalField(name: string, value: string | null | undefined): PrefillField | null {
  const v = value?.trim();
  if (!v) return null;
  return { name, default_value: v, readonly: true };
}

export function buildHipaaDocusealPrefillFields(data: HipaaFormPrefill, sentAt?: Date): PrefillField[] {
  const F = RJL_HIPAA_FIELD;
  const today = sentAt ?? new Date();
  const fields: PrefillField[] = [
    { name: F.lastName, default_value: data.lastName.trim(), readonly: true },
    { name: F.firstName, default_value: data.firstName.trim(), readonly: true },
    { name: F.legal, default_value: checkboxValue(data.legalAcknowledged), readonly: true },
    { name: F.allHealth, default_value: checkboxValue(data.allHealthAcknowledged), readonly: true },
    { name: F.todayDate, default_value: formatSignflowUsSlashDate(today), readonly: true },
  ];

  for (const f of [
    optionalField(F.middleName, data.middleName),
    optionalField(F.otherName, data.otherName),
    optionalField(F.address, data.address),
    optionalField(F.city, data.city),
    optionalField(F.state, data.state),
    optionalField(F.zipCode, data.zipCode),
    optionalField(F.phone, data.phone),
    optionalField(F.altPhone, data.altPhone),
    optionalField(F.email, data.email),
  ]) {
    if (f) fields.push(f);
  }

  if (data.dateOfBirth?.trim()) {
    const dob = parseIsoDateOnly(data.dateOfBirth);
    if (dob) {
      fields.push(
        { name: F.monthDob, default_value: String(dob.month), readonly: true },
        { name: F.dayDob, default_value: String(dob.day), readonly: true },
        { name: F.yearDob, default_value: String(dob.year), readonly: true },
      );
    }
  }

  if (data.isMinor) {
    const minorToday = formatSignflowUsSlashDate(today);
    fields.push({ name: F.minorTodayDate, default_value: minorToday, readonly: true });
    const rep = optionalField(F.nameAuthorizedRepForMinor, data.nameAuthorizedRepForMinor);
    if (rep) fields.push(rep);
    if (data.minorRepParent) {
      fields.push({ name: F.parent, default_value: checkboxValue(true), readonly: true });
    }
    if (data.minorRepGuardian) {
      fields.push({ name: F.guardian, default_value: checkboxValue(true), readonly: true });
    }
    if (data.minorRepOther) {
      fields.push({ name: F.other, default_value: checkboxValue(true), readonly: true });
    }
  }

  return fields;
}

/** HIPAA signer-only fields (never pre-filled by Sign Flow). */
export const HIPAA_SIGNER_ONLY_LOWER = new Set(
  [RJL_HIPAA_FIELD.signature, RJL_HIPAA_FIELD.minorSignature].map((n) => n.toLowerCase()),
);
