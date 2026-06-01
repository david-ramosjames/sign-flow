import { applyDocusealCompletionToRequest, markSigningViewedFromWebhook } from "@/server/signing-workflow";
import { getSignFlowStore } from "@/lib/db";
import { appendSigningEvent } from "@/services/signing-events";
import {
  extractCompletionUrlsFromWebhookData,
  extractDocusealSubmissionId,
  isDocusealCompletionEvent,
} from "@/lib/docuseal-submission";

function asObj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

export function isDocusealWebhookAuthorized(req: Request): boolean {
  const secret = process.env.DOCUSEAL_WEBHOOK_SECRET?.trim();
  if (!secret) return true;
  const a = req.headers.get("x-docuseal-secret")?.trim();
  const b = req.headers.get("x-webhook-secret")?.trim();
  return a === secret || b === secret;
}

export async function processDocusealWebhookJson(payload: unknown): Promise<void> {
  const root = asObj(payload);
  if (!root) {
    console.warn("[docuseal-webhook] ignored: payload is not an object");
    return;
  }

  const eventType = String(root.event_type ?? "");
  const data = asObj(root.data);
  if (!data) {
    console.warn("[docuseal-webhook] ignored: missing data", { eventType });
    return;
  }

  const submissionId = extractDocusealSubmissionId(root);
  if (submissionId == null) {
    console.warn("[docuseal-webhook] ignored: no submission id", { eventType });
    return;
  }

  if (eventType === "form.viewed" || eventType === "form.started") {
    await markSigningViewedFromWebhook(submissionId);
    return;
  }

  if (isDocusealCompletionEvent(eventType)) {
    const store = getSignFlowStore();
    const req = await store.findSigningRequestByDocusealSubmissionId(submissionId);
    if (!req) {
      console.warn("[docuseal-webhook] no signing request for submission", { submissionId, eventType });
      return;
    }

    const { pdf, audit } = extractCompletionUrlsFromWebhookData(data);
    await applyDocusealCompletionToRequest({
      signingRequestId: req.id,
      signedPdfUrl: pdf,
      auditCertificateUrl: audit,
    });
    return;
  }

  if (eventType === "form.declined") {
    const store = getSignFlowStore();
    const req = await store.findSigningRequestByDocusealSubmissionId(submissionId);
    if (!req) return;

    req.status = "failed";
    req.updatedAt = new Date().toISOString();
    await store.upsertSigningRequest(req);
    await appendSigningEvent({
      signingRequestId: req.id,
      leadId: req.leadId,
      type: "failed",
      metadata: { eventType, reason: "declined" },
    });
    return;
  }

  if (eventType === "submission.expired") {
    const store = getSignFlowStore();
    const req = await store.findSigningRequestByDocusealSubmissionId(submissionId);
    if (!req) return;
    req.status = "expired";
    req.reminderEnabled = false;
    req.nextReminderAt = null;
    req.updatedAt = new Date().toISOString();
    await store.upsertSigningRequest(req);
    await appendSigningEvent({
      signingRequestId: req.id,
      leadId: req.leadId,
      type: "failed",
      metadata: { eventType },
    });
  }
}
