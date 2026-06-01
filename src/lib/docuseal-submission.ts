function asObj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function submissionIdFromUnknown(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.trim());
    if (Number.isFinite(n) && Number.isInteger(n)) return n;
  }
  return null;
}

/** Parse DocuSeal submission id from webhook payloads (number or string). */
export function extractDocusealSubmissionId(payload: Record<string, unknown>): number | null {
  const data = asObj(payload.data);
  if (!data) return null;

  const submission = asObj(data.submission);
  if (submission) {
    const sid = submissionIdFromUnknown(submission.id);
    if (sid != null) return sid;
  }

  const sid2 = submissionIdFromUnknown(data.submission_id);
  if (sid2 != null) return sid2;

  const idTop = submissionIdFromUnknown(data.id);
  const et = String(payload.event_type ?? "");
  if (idTop != null && (et.startsWith("submission.") || et.startsWith("form."))) return idTop;

  return null;
}

export function extractCompletionUrlsFromWebhookData(data: Record<string, unknown>): {
  pdf: string | null;
  audit: string | null;
} {
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

export function submissionIsCompleted(submission: unknown): boolean {
  const o = asObj(submission);
  if (!o) return false;

  const status = String(o.status ?? "").toLowerCase();
  if (status === "completed") return true;

  const submitters = o.submitters;
  if (Array.isArray(submitters) && submitters.length > 0) {
    return submitters.every((s) => {
      const row = asObj(s);
      return row != null && String(row.status ?? "").toLowerCase() === "completed";
    });
  }

  return false;
}

export function extractSubmissionDocumentUrls(submission: unknown): { pdf: string | null; audit: string | null } {
  const o = asObj(submission);
  if (!o) return { pdf: null, audit: null };

  let pdf = String(o.combined_document_url ?? "") || null;
  const docs = o.documents;
  if ((!pdf || pdf === "null") && Array.isArray(docs) && docs.length) {
    const first = asObj(docs[0]);
    if (first?.url) pdf = String(first.url);
  }

  const audit = String(o.audit_log_url ?? "") || null;
  return {
    pdf: pdf && pdf !== "null" ? pdf : null,
    audit: audit && audit !== "null" ? audit : null,
  };
}

/** True when DocuSeal webhook event indicates signing is finished. */
export function isDocusealCompletionEvent(eventType: string): boolean {
  const et = eventType.toLowerCase();
  return (
    et === "form.completed" ||
    et === "submission.completed" ||
    et === "submitter.completed" ||
    et.endsWith(".completed")
  );
}
