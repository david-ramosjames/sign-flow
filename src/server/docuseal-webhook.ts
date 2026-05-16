import { applyDocusealCompletionToRequest, markSigningViewedFromWebhook } from "@/server/signing-workflow";
import { getSignFlowStore } from "@/lib/db";
import { appendSigningEvent } from "@/services/signing-events";

function asObj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function isDocusealWebhookAuthorized(req: Request): boolean {
  const secret = process.env.DOCUSEAL_WEBHOOK_SECRET?.trim();
  if (!secret) return true;
  const a = req.headers.get("x-docuseal-secret")?.trim();
  const b = req.headers.get("x-webhook-secret")?.trim();
  return a === secret || b === secret;
}

function extractSubmissionId(payload: Record<string, unknown>): number | null {
  const data = asObj(payload.data);
  if (!data) return null;
  const submission = asObj(data.submission);
  if (submission) {
    const sid = num(submission.id);
    if (sid != null) return sid;
  }
  const sid2 = num(data.submission_id);
  if (sid2 != null) return sid2;
  const idTop = num(data.id);
  const et = String(payload.event_type ?? "");
  if (idTop != null && et.startsWith("submission.")) return idTop;
  return null;
}

function extractCompletionUrls(data: Record<string, unknown>): { pdf: string | null; audit: string | null } {
  const submission = asObj(data.submission);
  const pdfFromSubmission = submission ? String(submission.combined_document_url ?? "") : "";
  const auditTop = String(data.audit_log_url ?? "");
  const auditFromSubmission = submission ? String(submission.audit_log_url ?? "") : "";

  let pdf: string | null = pdfFromSubmission || String(data.combined_document_url ?? "") || null;
  const docs = data.documents;
  if ((!pdf || pdf === "null") && Array.isArray(docs) && docs.length) {
    const first = asObj(docs[0]);
    if (first?.url) pdf = String(first.url);
  }

  const audit = auditTop || auditFromSubmission || null;
  return {
    pdf: pdf && pdf !== "null" ? pdf : null,
    audit: audit && audit !== "null" ? audit : null,
  };
}

export async function processDocusealWebhookJson(payload: unknown): Promise<void> {
  const root = asObj(payload);
  if (!root) return;

  const eventType = String(root.event_type ?? "");
  const data = asObj(root.data);
  if (!data) return;

  const submissionId = extractSubmissionId(root);
  if (submissionId == null) return;

  if (eventType === "form.viewed" || eventType === "form.started") {
    await markSigningViewedFromWebhook(submissionId);
    return;
  }

  if (
    eventType === "form.completed" ||
    eventType === "submission.completed" ||
    eventType === "form.declined"
  ) {
    const store = getSignFlowStore();
    const req = await store.findSigningRequestByDocusealSubmissionId(submissionId);
    if (!req) {
      return;
    }

    if (eventType === "form.declined") {
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

    const { pdf, audit } = extractCompletionUrls(data);
    await applyDocusealCompletionToRequest({
      signingRequestId: req.id,
      signedPdfUrl: pdf,
      auditCertificateUrl: audit,
    });
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
