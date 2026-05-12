import type { DocumentTemplate, SigningRequest } from "@/types/models";
import { buildAdobeMergeFields } from "@/lib/adobe-merge";
import type { StaffUser } from "@/types/models";

export type AdobeAgreementResult = {
  agreementId: string;
  signingUrl: string;
  status: "CREATED" | "OUT_FOR_SIGNATURE";
};

/**
 * Phase 1: Mock Acrobat Sign client.
 * Phase 2: Implement OAuth (refresh token), REST calls to create agreements from library templates,
 * participant sets, merge field info, and agreement status polling as fallback to webhooks.
 *
 * Env (document in .env.example):
 * - ADOBE_CLIENT_ID
 * - ADOBE_CLIENT_SECRET
 * - ADOBE_REFRESH_TOKEN (or OAuth app config)
 * - ADOBE_BASE_URL (shard-specific host)
 */
export async function createAdobeAgreementMock(input: {
  template: DocumentTemplate;
  request: SigningRequest;
  staff: StaffUser | null;
  sendViaAdobeEmail: boolean;
}): Promise<AdobeAgreementResult> {
  const merge = buildAdobeMergeFields({ template: input.template, request: input.request, staff: input.staff });
  void merge; // TODO: pass merge fields to Adobe API payload
  const agreementId = `MOCK_AGR_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const signingUrl = `https://secure.na1.adobesign.com/public/test/mock-sign?agr=${agreementId}`;
  void input.sendViaAdobeEmail;
  return { agreementId, signingUrl, status: "OUT_FOR_SIGNATURE" };
}

export async function fetchAdobeAgreementStatusMock(agreementId: string): Promise<SigningRequest["status"]> {
  void agreementId;
  // TODO(Phase 2): GET /agreements/{agreementId} and map Acrobat statuses → Relay dashboard statuses.
  return "Sent";
}

export type AdobeWebhookPayload = {
  agreementId?: string;
  eventType?: string;
  raw?: unknown;
};

/**
 * Maps Acrobat Sign webhook / event names (approximate) to Relay statuses.
 * TODO(Phase 2): Align with your Adobe webhook JSON schema and verify event strings.
 */
export function mapAdobeWebhookToRelayStatus(payload: AdobeWebhookPayload): {
  status: SigningRequest["status"] | null;
  event: import("@/types/models").EventType | null;
} {
  const t = (payload.eventType ?? "").toUpperCase();
  if (!payload.agreementId) return { status: null, event: "webhook_received" };

  if (t.includes("VIEW")) return { status: "Viewed", event: "viewed" };
  if (t.includes("SIGNED") && !t.includes("COMPLETE")) return { status: "Signed", event: "signed" };
  if (t.includes("COMPLETE") || t.includes("WORKFLOW_COMPLETED")) return { status: "Completed", event: "completed" };
  if (t.includes("REJECT") || t.includes("DECLINE")) return { status: "Declined", event: "declined" };
  if (t.includes("EXPIRE")) return { status: "Expired", event: "expired" };
  if (t.includes("CANCEL")) return { status: "Expired", event: "cancelled" };

  return { status: null, event: "webhook_received" };
}
