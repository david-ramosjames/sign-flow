import { getSignFlowStore } from "@/lib/db";
import { documentFirmId } from "@/lib/firm-scope";
import {
  autoCancelUnsignedAfterDaysFromSettings,
  isPastAutoCancelAge,
} from "@/lib/auto-cancel";
import { isActiveSigningRequest } from "@/lib/signing-request-active";
import { cancelSigningRequest } from "@/server/signing-workflow";
import type { SigningStatus } from "@/types/models";

const TERMINAL: ReadonlySet<SigningStatus> = new Set([
  "completed",
  "signed",
  "expired",
  "failed",
  "cancelled",
]);

export type ProcessAutoCancelResult = {
  candidates: number;
  cancelled: number;
  errors: { id: string; error: string }[];
};

/**
 * Cancel unsigned signing requests older than each firm's
 * `autoCancelUnsignedAfterDays` setting (all form kinds).
 */
export async function processAutoCancelUnsignedRequests(): Promise<ProcessAutoCancelResult> {
  const store = getSignFlowStore();
  const items = await store.listSigningRequests();
  const now = Date.now();

  const settingsByFirm = new Map<string, number | null>();
  async function daysForFirm(firmId: string): Promise<number | null> {
    if (settingsByFirm.has(firmId)) return settingsByFirm.get(firmId) ?? null;
    const settings = await store.getAppSettings(firmId);
    const days = autoCancelUnsignedAfterDaysFromSettings(settings);
    settingsByFirm.set(firmId, days);
    return days;
  }

  const candidates = [];
  for (const r of items) {
    if (!isActiveSigningRequest(r)) continue;
    if (TERMINAL.has(r.status)) continue;
    const firmId = documentFirmId(r);
    const days = await daysForFirm(firmId);
    if (days == null) continue;
    if (!isPastAutoCancelAge(r.sentAt, r.createdAt, days, now)) continue;
    candidates.push(r);
  }

  let cancelled = 0;
  const errors: { id: string; error: string }[] = [];
  for (const r of candidates) {
    try {
      await cancelSigningRequest(
        r.id,
        { sub: "system:auto_cancel" },
        { reason: "auto_cancel_unsigned" },
      );
      cancelled += 1;
    } catch (e) {
      errors.push({ id: r.id, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return { candidates: candidates.length, cancelled, errors };
}

/** @deprecated Prefer `processAutoCancelUnsignedRequests`. */
export const processAutoCancelUnsignedContracts = processAutoCancelUnsignedRequests;
