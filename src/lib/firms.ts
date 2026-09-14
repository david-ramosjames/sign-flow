import { cookies } from "next/headers";
import { getSignFlowStore } from "@/lib/db";
import { nowIso } from "@/lib/time";
import type { Firm, FirmSecrets, QuoPhoneNumberOption, SigningFormKind } from "@/types/models";
import {
  DEFAULT_FIRM_ID,
  FIRM_COOKIE,
  defaultFirmRecord,
  userCanAccessFirm,
} from "@/lib/firm-scope";

export {
  DEFAULT_FIRM_ID,
  FIRM_COOKIE,
  belongsToFirm,
  defaultFirmRecord,
  documentFirmId,
  emptyFirmSecrets,
  parseMemberEmails,
  slugifyFirmName,
  userCanAccessFirm,
} from "@/lib/firm-scope";

export async function ensureDefaultFirm(): Promise<Firm> {
  const store = getSignFlowStore();
  const existing = await store.getFirm(DEFAULT_FIRM_ID);
  if (existing) return existing;
  const firm = defaultFirmRecord(nowIso());
  await store.upsertFirm(firm);
  return firm;
}

export async function listAllFirms(): Promise<Firm[]> {
  const store = getSignFlowStore();
  await ensureDefaultFirm();
  const firms = await store.listFirms();
  if (firms.some((f) => f.id === DEFAULT_FIRM_ID)) return firms;
  return [defaultFirmRecord(nowIso()), ...firms];
}

export async function firmsAccessibleTo(email: string | undefined, isAdmin: boolean): Promise<Firm[]> {
  const firms = await listAllFirms();
  return firms.filter((f) => userCanAccessFirm(email, f, isAdmin));
}

export async function emailIsFirmMember(email: string): Promise<boolean> {
  const firms = await listAllFirms();
  return firms.some((f) => f.memberEmails.length > 0 && userCanAccessFirm(email, f, false));
}

export async function readFirmCookie(): Promise<string | null> {
  const value = (await cookies()).get(FIRM_COOKIE)?.value?.trim();
  return value || null;
}

export async function resolveActiveFirm(email: string | undefined, isAdmin: boolean): Promise<Firm> {
  const accessible = await firmsAccessibleTo(email, isAdmin);
  if (accessible.length === 0) {
    return ensureDefaultFirm();
  }
  const cookieId = await readFirmCookie();
  const fromCookie = cookieId ? accessible.find((f) => f.id === cookieId) : undefined;
  if (fromCookie) return fromCookie;
  const home = accessible.find((f) => f.id === DEFAULT_FIRM_ID);
  return home ?? accessible[0]!;
}

export type FirmPublic = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  memberEmails: string[];
  docusealConfigured: boolean;
  quoConfigured: boolean;
  usesEnvDocuseal: boolean;
  usesEnvQuo: boolean;
  /** Non-secret connection fields — safe to show in Admin → Firms. */
  docusealApiUrl: string | null;
  docusealAdminBaseUrl: string | null;
  quoFromNumber: string | null;
  quoPhoneNumberId: string | null;
  quoPhoneNumbers: QuoPhoneNumberOption[];
  /** Ids staff may pick on send forms (`null` = all imported). */
  quoSelectablePhoneNumberIds: string[] | null;
  quoDefaultContractPhoneNumberId: string | null;
  quoDefaultGeneralPhoneNumberId: string | null;
  /** True when a firm-specific secret is stored (value never returned). */
  hasDocusealApiKey: boolean;
  hasDocusealWebhookSecret: boolean;
  hasQuoApiKey: boolean;
  hasQuoWebhookSecret: boolean;
};

function firmHasQuoFrom(secrets: FirmSecrets | null): boolean {
  if (!secrets) return false;
  if (secrets.quoDefaultContractPhoneNumberId?.trim() || secrets.quoDefaultGeneralPhoneNumberId?.trim()) {
    return true;
  }
  if ((secrets.quoPhoneNumbers?.length ?? 0) > 0) return true;
  return Boolean(secrets.quoFromNumber?.trim() || secrets.quoPhoneNumberId?.trim());
}

export function firmSecretsConfigured(secrets: FirmSecrets | null): {
  docusealConfigured: boolean;
  quoConfigured: boolean;
  usesEnvDocuseal: boolean;
  usesEnvQuo: boolean;
  docusealApiUrl: string | null;
  docusealAdminBaseUrl: string | null;
  quoFromNumber: string | null;
  quoPhoneNumberId: string | null;
  quoPhoneNumbers: QuoPhoneNumberOption[];
  /** Ids staff may pick on send forms (`null` = all imported). */
  quoSelectablePhoneNumberIds: string[] | null;
  quoDefaultContractPhoneNumberId: string | null;
  quoDefaultGeneralPhoneNumberId: string | null;
  hasDocusealApiKey: boolean;
  hasDocusealWebhookSecret: boolean;
  hasQuoApiKey: boolean;
  hasQuoWebhookSecret: boolean;
} {
  const hasFirmDocuseal = Boolean(secrets?.docusealApiKey?.trim());
  const hasEnvDocuseal = Boolean(process.env.DOCUSEAL_API_KEY?.trim());
  const hasFirmQuo = Boolean(secrets?.quoApiKey?.trim() && firmHasQuoFrom(secrets));
  const hasEnvQuo = Boolean(
    process.env.QUO_API_KEY?.trim() && (process.env.QUO_FROM_NUMBER?.trim() || process.env.QUO_PHONE_NUMBER_ID?.trim()),
  );
  return {
    docusealConfigured: hasFirmDocuseal || hasEnvDocuseal,
    quoConfigured: hasFirmQuo || hasEnvQuo,
    usesEnvDocuseal: !hasFirmDocuseal && hasEnvDocuseal,
    usesEnvQuo: !hasFirmQuo && hasEnvQuo,
    docusealApiUrl: secrets?.docusealApiUrl?.trim() || null,
    docusealAdminBaseUrl: secrets?.docusealAdminBaseUrl?.trim() || null,
    quoFromNumber: secrets?.quoFromNumber?.trim() || null,
    quoPhoneNumberId: secrets?.quoPhoneNumberId?.trim() || null,
    quoPhoneNumbers: secrets?.quoPhoneNumbers ?? [],
    quoSelectablePhoneNumberIds: secrets?.quoSelectablePhoneNumberIds ?? null,
    quoDefaultContractPhoneNumberId: secrets?.quoDefaultContractPhoneNumberId?.trim() || null,
    quoDefaultGeneralPhoneNumberId: secrets?.quoDefaultGeneralPhoneNumberId?.trim() || null,
    hasDocusealApiKey: hasFirmDocuseal,
    hasDocusealWebhookSecret: Boolean(secrets?.docusealWebhookSecret?.trim()),
    hasQuoApiKey: Boolean(secrets?.quoApiKey?.trim()),
    hasQuoWebhookSecret: Boolean(secrets?.quoWebhookSecret?.trim()),
  };
}

/** Numbers staff may choose on send forms (filtered by firm setting). */
export function selectableQuoPhoneNumbers(secrets: FirmSecrets | null | undefined): QuoPhoneNumberOption[] {
  const all = secrets?.quoPhoneNumbers ?? [];
  const ids = secrets?.quoSelectablePhoneNumberIds;
  if (ids == null) return all;
  const allowed = new Set(ids.map((id) => id.trim()).filter(Boolean));
  return all.filter((n) => allowed.has(n.id));
}

/** Keep only ids that still exist in the imported list. */
export function pruneSelectableQuoPhoneNumberIds(
  numbers: QuoPhoneNumberOption[],
  ids: string[] | null | undefined,
): string[] | null {
  if (ids == null) return null;
  const valid = new Set(numbers.map((n) => n.id));
  return ids.map((id) => id.trim()).filter((id) => id && valid.has(id));
}

export async function toFirmPublic(firm: Firm): Promise<FirmPublic> {
  const secrets = await getSignFlowStore().getFirmSecrets(firm.id);
  return {
    id: firm.id,
    name: firm.name,
    slug: firm.slug,
    logoUrl: firm.logoUrl,
    memberEmails: firm.memberEmails,
    ...firmSecretsConfigured(secrets),
  };
}

export type DocusealConnection = {
  apiUrl?: string | null;
  apiKey?: string | null;
  adminBaseUrl?: string | null;
  webhookSecret?: string | null;
};

export type QuoConnection = {
  apiKey?: string | null;
  fromNumber?: string | null;
  phoneNumberId?: string | null;
};

export async function getFirmDocusealConnection(firmId: string): Promise<DocusealConnection> {
  const secrets = await getSignFlowStore().getFirmSecrets(firmId);
  return {
    apiUrl: secrets?.docusealApiUrl,
    apiKey: secrets?.docusealApiKey,
    adminBaseUrl: secrets?.docusealAdminBaseUrl,
    webhookSecret: secrets?.docusealWebhookSecret,
  };
}

export type ResolveQuoFromOptions = {
  /** Explicit override from the send form (`PN…`). */
  phoneNumberId?: string | null;
  /** When no override, pick contract vs general default. */
  forContract?: boolean;
};

/** Resolve which Quo from-id to use (override → kind default → legacy). */
export function resolveFirmQuoPhoneNumberId(
  secrets: FirmSecrets | null | undefined,
  opts?: ResolveQuoFromOptions,
): string | null {
  const override = opts?.phoneNumberId?.trim();
  if (override) return override.startsWith("PN") ? override : `PN${override}`;

  if (opts?.forContract === true) {
    const c = secrets?.quoDefaultContractPhoneNumberId?.trim();
    if (c) return c;
  }
  if (opts?.forContract === false) {
    const g = secrets?.quoDefaultGeneralPhoneNumberId?.trim();
    if (g) return g;
  }

  const anyDefault =
    secrets?.quoDefaultContractPhoneNumberId?.trim() || secrets?.quoDefaultGeneralPhoneNumberId?.trim();
  if (anyDefault) return anyDefault;

  const legacy = secrets?.quoPhoneNumberId?.trim();
  if (legacy) return legacy.startsWith("PN") ? legacy : `PN${legacy}`;
  return null;
}

export function formKindUsesContractQuoDefault(formKind: SigningFormKind | null | undefined): boolean {
  return formKind === "contract";
}

export async function getFirmQuoConnection(
  firmId: string,
  opts?: ResolveQuoFromOptions,
): Promise<QuoConnection | undefined> {
  const secrets = await getSignFlowStore().getFirmSecrets(firmId);
  const firmKey = secrets?.quoApiKey?.trim();
  const apiKey = firmKey || process.env.QUO_API_KEY?.trim();
  if (!apiKey) return undefined;

  const phoneNumberId = resolveFirmQuoPhoneNumberId(secrets, opts);
  if (firmKey) {
    return {
      apiKey: firmKey,
      fromNumber: phoneNumberId ? null : secrets?.quoFromNumber ?? null,
      phoneNumberId: phoneNumberId || secrets?.quoPhoneNumberId || null,
    };
  }

  return {
    apiKey,
    fromNumber: phoneNumberId ? null : process.env.QUO_FROM_NUMBER ?? null,
    phoneNumberId: phoneNumberId || process.env.QUO_PHONE_NUMBER_ID || null,
  };
}
