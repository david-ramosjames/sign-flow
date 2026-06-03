import { normalizeSigningRequestDocusealUrls } from "@/lib/docuseal-public-url";
import type { SigningRequest, SigningStatus } from "@/types/models";

/** Legacy rows used `deletedAt` for soft-hide; treat as cancelled. */
export function isCancelledSigningRequest(req: SigningRequest): boolean {
  return req.status === "cancelled" || Boolean(req.deletedAt);
}

/** May receive reminders, resends, and DocuSeal status updates. */
export function isActiveSigningRequest(req: SigningRequest): boolean {
  return !isCancelledSigningRequest(req);
}

export function normalizeSigningRequestForDisplay(req: SigningRequest): SigningRequest {
  let out: SigningRequest = { ...req, dateOfLoss: req.dateOfLoss ?? null };
  out = normalizeSigningRequestDocusealUrls(out);
  if (out.deletedAt && out.status !== "cancelled") {
    out = { ...out, status: "cancelled" satisfies SigningStatus };
  }
  return out;
}
