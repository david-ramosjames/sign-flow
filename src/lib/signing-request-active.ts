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
  if (req.deletedAt && req.status !== "cancelled") {
    return { ...req, status: "cancelled" satisfies SigningStatus };
  }
  return req;
}
