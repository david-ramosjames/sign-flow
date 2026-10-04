import type { SigningRequest } from "@/types/models";

export type IntakeCallbackStatus = "viewed" | "signed" | "declined" | "expired";

/**
 * Tell the system that created this request (e.g. the inbound AI intake) that its
 * status changed. Only fires for requests created with an `externalRef` and when
 * SIGNFLOW_INTAKE_CALLBACK_URL is configured. Never throws.
 */
export async function notifyIntakeCallback(req: SigningRequest, status: IntakeCallbackStatus): Promise<void> {
  const url = process.env.SIGNFLOW_INTAKE_CALLBACK_URL?.trim();
  if (!url || !req.externalRef) return;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-inbound-contract-secret": process.env.SIGNFLOW_INTAKE_CALLBACK_SECRET?.trim() ?? "",
      },
      body: JSON.stringify({ external_id: req.id, intake_id: req.externalRef, status }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) console.warn("[intake-callback] non-2xx", { status: res.status, signingRequestId: req.id });
  } catch (e) {
    console.warn("[intake-callback] failed", { signingRequestId: req.id, error: String(e) });
  }
}
