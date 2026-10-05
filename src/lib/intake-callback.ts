import type { SigningRequest } from "@/types/models";

export type IntakeCallbackStatus = "viewed" | "signed" | "declined" | "expired";

/**
 * Tell the system that created this request (e.g. the inbound AI intake) that its status
 * changed. Posts to the request's own callback URL (falls back to SIGNFLOW_INTAKE_CALLBACK_URL),
 * authenticated with the same SIGNFLOW_INTAKE_TOKEN the caller uses. Never throws.
 */
export async function notifyIntakeCallback(req: SigningRequest, status: IntakeCallbackStatus): Promise<void> {
  const url = req.externalCallbackUrl?.trim() || process.env.SIGNFLOW_INTAKE_CALLBACK_URL?.trim();
  const token = process.env.SIGNFLOW_INTAKE_TOKEN?.trim();
  if (!url || !req.externalRef || !token) return;
  const legacySecret = process.env.SIGNFLOW_INTAKE_CALLBACK_SECRET?.trim();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
        ...(legacySecret ? { "x-inbound-contract-secret": legacySecret } : {}),
      },
      body: JSON.stringify({ external_id: req.id, intake_id: req.externalRef, status }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) console.warn("[intake-callback] non-2xx", { status: res.status, signingRequestId: req.id });
  } catch (e) {
    console.warn("[intake-callback] failed", { signingRequestId: req.id, error: String(e) });
  }
}
