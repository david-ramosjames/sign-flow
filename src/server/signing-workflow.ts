import { computeNextReminderAt } from "@/lib/reminder-cadence";
import { mergeReminderSchedule } from "@/lib/reminder-schedule";
import {
  mergeCompletionNotifications,
  parseEmailList,
  teamCompletedEmailFromSettings,
  thankYouSmsFromSettings,
} from "@/lib/completion-notifications";
import { mergeOutboundDelivery } from "@/lib/outbound-delivery";
import {
  extractSubmissionDocumentUrls,
  submissionIsCompleted,
} from "@/lib/docuseal-submission";
import {
  reminderEmailFromSettings,
  reminderSmsFromSettings,
  signingEmailFromSettings,
  signingSmsFromSettings,
} from "@/lib/messaging";
import { newId, nowIso } from "@/lib/time";
import { getSignFlowStore } from "@/lib/db";
import { createSubmission, downloadUrlToBuffer, getSubmission, getTemplate } from "@/services/docuseal-client";
import { uploadDropboxFile, getDropboxTemporaryLink } from "@/services/dropbox-client";
import type { EmailAttachment } from "@/lib/mime-rfc822";
import { sendTransactionalEmail } from "@/services/email-delivery";
import { postSlackMessage } from "@/services/slack-notify";
import { sendSms } from "@/services/quo-service";
import { appendSigningEvent } from "@/services/signing-events";
import { isActiveSigningRequest, isCancelledSigningRequest } from "@/lib/signing-request-active";
import type { Lead, LeadStatus, SigningRequest, SupportedLanguage } from "@/types/models";

export type CreateSigningRequestInput = {
  clientName: string;
  phone: string | null;
  email: string | null;
  language: SupportedLanguage;
  source: string;
  templateId: number;
  sendSms: boolean;
  sendEmail: boolean;
  reminderEnabled: boolean;
  assignedTo: string | null;
};

export async function createLeadAndSigningRequest(
  input: CreateSigningRequestInput,
  actor: { sub: string; name: string },
): Promise<{ lead: Lead; signingRequest: SigningRequest }> {
  const store = getSignFlowStore();
  const appSettings = await store.getAppSettings();
  const reminderSchedule = mergeReminderSchedule(appSettings);
  const now = nowIso();
  const leadId = newId("lead");
  const reqId = newId("sig");

  const lead: Lead = {
    id: leadId,
    clientName: input.clientName.trim(),
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    language: input.language,
    source: input.source || "dashboard",
    createdAt: now,
    updatedAt: now,
    assignedTo: input.assignedTo,
    status: "new" satisfies LeadStatus,
  };

  const template = await getTemplate(input.templateId);

  const submitters = await createSubmission({
    templateId: input.templateId,
    clientName: input.clientName.trim(),
    email: input.email,
    phone: input.phone,
    sendDocusealEmail: false,
    sendDocusealSms: false,
  });

  const primary = submitters[0];
  if (!primary?.submission_id) throw new Error("DocuSeal did not return a submission id.");

  const signingUrl = primary.embed_src ?? null;
  const sentAt = nowIso();
  const sentDate = new Date(sentAt);

  const signingRequest: SigningRequest = {
    id: reqId,
    leadId,
    clientName: lead.clientName,
    phone: lead.phone,
    email: lead.email,
    language: input.language,
    templateId: input.templateId,
    templateName: template.name,
    docusealSubmissionId: primary.submission_id,
    docusealSubmitterId: primary.id ?? null,
    signingUrl,
    status: "sent",
    sentViaSms: false,
    sentViaEmail: false,
    reminderEnabled: input.reminderEnabled,
    reminderCount: 0,
    nextReminderAt: input.reminderEnabled
      ? (computeNextReminderAt({ sentAt: sentDate, reminderCount: 0 }, reminderSchedule)?.toISOString() ?? null)
      : null,
    lastReminderAt: null,
    completedAt: null,
    signedPdfUrl: null,
    auditCertificateUrl: null,
    dropboxFolderPath: null,
    dropboxSignedPdfPath: null,
    dropboxAuditPath: null,
    dropboxSignedPdfLink: null,
    dropboxAuditLink: null,
    manualFollowUp: false,
    sentAt,
    lastActivityAt: sentAt,
    createdAt: now,
    updatedAt: now,
  };

  if (!signingUrl) throw new Error("DocuSeal did not return a signing URL.");

  const outbound = mergeOutboundDelivery(appSettings);
  if (input.sendSms && !outbound.signingSmsEnabled) {
    throw new Error("SMS for signing requests is turned off in Admin → Messages (Signing request delivery).");
  }
  if (input.sendEmail && !outbound.signingEmailEnabled) {
    throw new Error("Email for signing requests is turned off in Admin → Messages (Signing request delivery).");
  }

  await store.upsertLead(lead);
  await store.upsertSigningRequest(signingRequest);

  await appendSigningEvent({
    signingRequestId: reqId,
    leadId,
    type: "created",
    metadata: { actor: actor.sub, templateId: input.templateId },
  });

  if (input.sendSms && lead.phone) {
    await sendSms(lead.phone, signingSmsFromSettings(appSettings, lead.clientName, signingUrl));
    signingRequest.sentViaSms = true;
    await appendSigningEvent({ signingRequestId: reqId, leadId, type: "sms_sent", metadata: {} });
  }

  if (input.sendEmail && lead.email) {
    const { subject, text, html } = signingEmailFromSettings(appSettings, lead.clientName, signingUrl);
    const mail = await sendTransactionalEmail({ to: lead.email, subject, textBody: text, htmlBody: html });
    if (!mail.ok) throw new Error(mail.error);
    signingRequest.sentViaEmail = true;
    await appendSigningEvent({ signingRequestId: reqId, leadId, type: "email_sent", metadata: {} });
  }

  if (!signingRequest.sentViaSms && !signingRequest.sentViaEmail) {
    throw new Error("Select at least one delivery method (SMS or email).");
  }

  lead.status = "signing_sent";
  lead.updatedAt = nowIso();
  signingRequest.updatedAt = nowIso();
  await store.upsertLead(lead);
  await store.upsertSigningRequest(signingRequest);

  await postSlackMessage(
    `*Sign Flow* — signing request sent\n• Client: ${lead.clientName}\n• Template: ${template.name}\n• SMS: ${signingRequest.sentViaSms ? "yes" : "no"} · Email: ${signingRequest.sentViaEmail ? "yes" : "no"}`,
  );
  await appendSigningEvent({ signingRequestId: reqId, leadId, type: "slack_posted", metadata: { channel: "ops" } });

  return { lead, signingRequest };
}

export async function cancelSigningRequest(
  signingRequestId: string,
  actor: { sub: string },
): Promise<SigningRequest> {
  const store = getSignFlowStore();
  const req = await store.getSigningRequest(signingRequestId);
  if (!req) throw new Error("Not found");
  if (req.status === "completed") throw new Error("Completed requests cannot be cancelled.");
  if (isCancelledSigningRequest(req)) throw new Error("This signing request is already cancelled.");

  const t = nowIso();
  req.status = "cancelled";
  req.deletedAt = null;
  req.reminderEnabled = false;
  req.nextReminderAt = null;
  req.manualFollowUp = false;
  req.lastActivityAt = t;
  req.updatedAt = t;
  await store.upsertSigningRequest(req);

  await appendSigningEvent({
    signingRequestId: req.id,
    leadId: req.leadId,
    type: "cancelled",
    metadata: { actor: actor.sub },
  });

  return req;
}

export async function purgeSigningRequest(signingRequestId: string): Promise<void> {
  const store = getSignFlowStore();
  const req = await store.getSigningRequest(signingRequestId);
  if (!req) throw new Error("Not found");

  const leadId = req.leadId;
  await store.purgeSigningRequest(signingRequestId);

  const siblings = (await store.listSigningRequests()).filter(
    (r) => r.leadId === leadId && r.id !== signingRequestId && !isCancelledSigningRequest(r),
  );
  const lead = await store.getLead(leadId);
  if (lead && siblings.length === 0 && lead.status !== "signed") {
    lead.status = "archived";
    lead.updatedAt = nowIso();
    await store.upsertLead(lead);
  }
}

export async function resendSigningNotifications(
  signingRequestId: string,
  opts: { sms?: boolean; email?: boolean },
): Promise<SigningRequest> {
  const store = getSignFlowStore();
  const appSettings = await store.getAppSettings();
  const outbound = mergeOutboundDelivery(appSettings);
  const req = await store.getSigningRequest(signingRequestId);
  if (!req?.signingUrl) throw new Error("Signing request not found or missing URL.");
  if (!isActiveSigningRequest(req)) throw new Error("This signing request was cancelled.");

  if (opts.sms && !outbound.signingSmsEnabled) {
    throw new Error("SMS for signing requests is turned off in Admin → Messages.");
  }
  if (opts.email && !outbound.signingEmailEnabled) {
    throw new Error("Email for signing requests is turned off in Admin → Messages.");
  }

  if (opts.sms) {
    if (!req.phone?.trim()) throw new Error("No phone number on file for this request; add a phone number to resend SMS.");
    await sendSms(req.phone, signingSmsFromSettings(appSettings, req.clientName, req.signingUrl));
    await appendSigningEvent({ signingRequestId, leadId: req.leadId, type: "sms_sent", metadata: { resend: true } });
  }
  if (opts.email) {
    if (!req.email?.trim()) throw new Error("No email address on file for this request; add an email to resend email.");
    const { subject, text, html } = signingEmailFromSettings(appSettings, req.clientName, req.signingUrl);
    const mail = await sendTransactionalEmail({ to: req.email, subject, textBody: text, htmlBody: html });
    if (!mail.ok) throw new Error(mail.error);
    await appendSigningEvent({ signingRequestId, leadId: req.leadId, type: "email_sent", metadata: { resend: true } });
  }

  req.updatedAt = nowIso();
  req.lastActivityAt = nowIso();
  await store.upsertSigningRequest(req);
  return req;
}

export async function syncSignedArtifactsToDropbox(signingRequestId: string): Promise<SigningRequest> {
  const store = getSignFlowStore();
  const req = await store.getSigningRequest(signingRequestId);
  if (!req) throw new Error("Not found");
  if (!isActiveSigningRequest(req)) throw new Error("This signing request was cancelled.");
  if (!req.signedPdfUrl && !req.auditCertificateUrl) {
    throw new Error("No DocuSeal document URLs on file yet; wait for completion or refresh from DocuSeal.");
  }

  const folder = `/SignFlow/${req.leadId}/${req.id}`;
  let signedPath: string | null = null;
  let auditPath: string | null = null;
  let signedLink: string | null = null;
  let auditLink: string | null = null;

  if (req.signedPdfUrl) {
    const buf = await downloadUrlToBuffer(req.signedPdfUrl);
    const up = await uploadDropboxFile({ dropboxPath: `${folder}/signed.pdf`, bytes: buf });
    signedPath = up.path_display;
    try {
      signedLink = await getDropboxTemporaryLink(signedPath);
    } catch {
      signedLink = null;
    }
  }
  if (req.auditCertificateUrl) {
    const buf = await downloadUrlToBuffer(req.auditCertificateUrl);
    const up = await uploadDropboxFile({ dropboxPath: `${folder}/audit-certificate.pdf`, bytes: buf });
    auditPath = up.path_display;
    try {
      auditLink = await getDropboxTemporaryLink(auditPath);
    } catch {
      auditLink = null;
    }
  }

  req.dropboxFolderPath = folder;
  req.dropboxSignedPdfPath = signedPath;
  req.dropboxAuditPath = auditPath;
  req.dropboxSignedPdfLink = signedLink;
  req.dropboxAuditLink = auditLink;
  req.updatedAt = nowIso();
  await store.upsertSigningRequest(req);
  await appendSigningEvent({
    signingRequestId,
    leadId: req.leadId,
    type: "dropbox_saved",
    metadata: { folder, signedPath, auditPath },
  });
  return req;
}

export async function postSigningSlackUpdate(signingRequestId: string): Promise<void> {
  const store = getSignFlowStore();
  const req = await store.getSigningRequest(signingRequestId);
  if (!req) throw new Error("Not found");
  await postSlackMessage(
    `*Sign Flow* — ${req.clientName}\n• Status: ${req.status}\n• Template: ${req.templateName}\n• Dropbox: ${req.dropboxSignedPdfPath ? "archived" : "pending"}`,
  );
  await appendSigningEvent({ signingRequestId, leadId: req.leadId, type: "slack_posted", metadata: { manual: true } });
}

export async function syncSigningRequestFromDocuseal(signingRequestId: string): Promise<SigningRequest> {
  const store = getSignFlowStore();
  const req = await store.getSigningRequest(signingRequestId);
  if (!req) throw new Error("Not found");
  if (!isActiveSigningRequest(req)) throw new Error("This signing request was cancelled.");
  if (req.docusealSubmissionId == null) throw new Error("No DocuSeal submission id on this request.");

  const raw = await getSubmission(req.docusealSubmissionId);
  if (!submissionIsCompleted(raw)) {
    throw new Error("DocuSeal submission is not completed yet.");
  }

  const { pdf, audit } = extractSubmissionDocumentUrls(raw);
  await applyDocusealCompletionToRequest({
    signingRequestId: req.id,
    signedPdfUrl: pdf,
    auditCertificateUrl: audit,
    source: "sync",
  });

  await appendSigningEvent({
    signingRequestId: req.id,
    leadId: req.leadId,
    type: "synced",
    metadata: { source: "docuseal" },
  });

  const updated = await store.getSigningRequest(signingRequestId);
  if (!updated) throw new Error("Not found");
  return updated;
}

export async function applyDocusealCompletionToRequest(input: {
  signingRequestId: string;
  signedPdfUrl: string | null;
  auditCertificateUrl: string | null;
  source?: "docuseal" | "sync";
}): Promise<void> {
  const store = getSignFlowStore();
  const req = await store.getSigningRequest(input.signingRequestId);
  if (!req || !isActiveSigningRequest(req)) return;

  const pdf = input.signedPdfUrl ?? null;
  const audit = input.auditCertificateUrl ?? null;

  if (req.status === "completed") {
    let changed = false;
    if (pdf && !req.signedPdfUrl) {
      req.signedPdfUrl = pdf;
      changed = true;
    }
    if (audit && !req.auditCertificateUrl) {
      req.auditCertificateUrl = audit;
      changed = true;
    }
    if (changed) {
      req.updatedAt = nowIso();
      await store.upsertSigningRequest(req);
    }
    return;
  }

  const t = nowIso();
  req.status = "completed";
  req.completedAt = t;
  req.signedPdfUrl = pdf ?? req.signedPdfUrl;
  req.auditCertificateUrl = audit ?? req.auditCertificateUrl;
  req.reminderEnabled = false;
  req.nextReminderAt = null;
  req.manualFollowUp = false;
  req.lastActivityAt = t;
  req.updatedAt = t;
  await store.upsertSigningRequest(req);

  const lead = await store.getLead(req.leadId);
  if (lead) {
    lead.status = "signed";
    lead.updatedAt = t;
    await store.upsertLead(lead);
  }

  await appendSigningEvent({
    signingRequestId: req.id,
    leadId: req.leadId,
    type: "signed",
    metadata: { source: input.source ?? "docuseal" },
  });

  const appSettings = await store.getAppSettings();
  const completionSettings = mergeCompletionNotifications(appSettings);
  const documentUrl = req.signedPdfUrl ?? req.signingUrl ?? "";

  if (completionSettings.thankYouSmsEnabled && req.phone?.trim()) {
    try {
      await sendSms(req.phone, thankYouSmsFromSettings(appSettings, req.clientName));
      await appendSigningEvent({
        signingRequestId: req.id,
        leadId: req.leadId,
        type: "sms_sent",
        metadata: { kind: "thank_you" },
      });
    } catch (e) {
      await appendSigningEvent({
        signingRequestId: req.id,
        leadId: req.leadId,
        type: "failed",
        metadata: { step: "thank_you_sms", error: String(e) },
      });
    }
  }

  const teamEmails = parseEmailList(completionSettings.teamNotificationEmails);
  if (teamEmails.length > 0) {
    const pdfUrl = req.signedPdfUrl;
    let attachments: EmailAttachment[] | undefined;
    if (pdfUrl) {
      try {
        const pdfBytes = await downloadUrlToBuffer(pdfUrl);
        const base = req.clientName.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-") || "signed";
        attachments = [{ filename: `${base}-signed.pdf`, content: pdfBytes, mimeType: "application/pdf" }];
      } catch (e) {
        await appendSigningEvent({
          signingRequestId: req.id,
          leadId: req.leadId,
          type: "failed",
          metadata: { step: "team_completed_pdf", error: String(e) },
        });
      }
    }
    const { subject, text } = teamCompletedEmailFromSettings(appSettings, {
      clientName: req.clientName,
      templateName: req.templateName,
      documentUrl: documentUrl || "(see attached PDF or check DocuSeal)",
    });
    for (const to of teamEmails) {
      try {
        const mail = await sendTransactionalEmail({ to, subject, textBody: text, attachments });
        if (!mail.ok) throw new Error(mail.error);
        await appendSigningEvent({
          signingRequestId: req.id,
          leadId: req.leadId,
          type: "email_sent",
          metadata: { kind: "team_completed", to, attachedPdf: Boolean(attachments?.length) },
        });
      } catch (e) {
        await appendSigningEvent({
          signingRequestId: req.id,
          leadId: req.leadId,
          type: "failed",
          metadata: { step: "team_completed_email", to, error: String(e) },
        });
      }
    }
  }

  if (process.env.DROPBOX_ACCESS_TOKEN) {
    try {
      await syncSignedArtifactsToDropbox(req.id);
      await appendSigningEvent({ signingRequestId: req.id, leadId: req.leadId, type: "downloaded", metadata: {} });
    } catch (e) {
      await appendSigningEvent({
        signingRequestId: req.id,
        leadId: req.leadId,
        type: "failed",
        metadata: { step: "dropbox", error: String(e) },
      });
    }
  }

  try {
    const latest = await store.getSigningRequest(req.id);
    const dropOk = Boolean(latest?.dropboxSignedPdfPath);
    await postSlackMessage(
      `*Sign Flow* — completed signature\n• ${req.clientName}\n• ${req.templateName}\n• Dropbox: ${dropOk ? "saved" : "skipped (no token or error)"}`,
    );
    await appendSigningEvent({ signingRequestId: req.id, leadId: req.leadId, type: "slack_posted", metadata: { event: "completed" } });
  } catch (e) {
    await appendSigningEvent({
      signingRequestId: req.id,
      leadId: req.leadId,
      type: "failed",
      metadata: { step: "slack", error: String(e) },
    });
  }
}

export async function markSigningViewedFromWebhook(submissionId: number): Promise<void> {
  const store = getSignFlowStore();
  const req = await store.findSigningRequestByDocusealSubmissionId(submissionId);
  if (!req || !isActiveSigningRequest(req)) return;
  if (req.status === "viewed" || req.status === "completed" || req.status === "signed") return;
  if (req.status === "sent") {
    req.status = "viewed";
    req.lastActivityAt = nowIso();
    req.updatedAt = nowIso();
    await store.upsertSigningRequest(req);
    await appendSigningEvent({ signingRequestId: req.id, leadId: req.leadId, type: "viewed", metadata: { submissionId } });
  }
}

export async function runReminderForRequest(req: SigningRequest): Promise<SigningRequest | null> {
  if (!isActiveSigningRequest(req) || !req.reminderEnabled || !req.signingUrl) return null;
  if (
    req.status === "completed" ||
    req.status === "signed" ||
    req.status === "expired" ||
    req.status === "failed" ||
    req.status === "cancelled"
  ) {
    return null;
  }
  const store = getSignFlowStore();
  const appSettings = await store.getAppSettings();
  const outbound = mergeOutboundDelivery(appSettings);
  const reminderSchedule = mergeReminderSchedule(appSettings);
  if (req.reminderCount >= reminderSchedule.maxAutoReminders) {
    req.manualFollowUp = true;
    req.nextReminderAt = null;
    req.updatedAt = nowIso();
    await store.upsertSigningRequest(req);
    return req;
  }
  if (!req.sentAt) return null;
  const next = req.nextReminderAt ? new Date(req.nextReminderAt) : null;
  if (!next || next.getTime() > Date.now()) return null;

  const sentAt = new Date(req.sentAt);
  if (req.phone && req.sentViaSms && outbound.signingSmsEnabled) {
    await sendSms(req.phone, reminderSmsFromSettings(appSettings, req.clientName, req.signingUrl));
  }
  if (req.email && req.sentViaEmail && outbound.signingEmailEnabled) {
    const { subject, text, html } = reminderEmailFromSettings(appSettings, req.clientName, req.signingUrl);
    const mail = await sendTransactionalEmail({ to: req.email, subject, textBody: text, htmlBody: html });
    if (!mail.ok) {
      await appendSigningEvent({
        signingRequestId: req.id,
        leadId: req.leadId,
        type: "failed",
        metadata: { step: "reminder_email", error: mail.error },
      });
    }
  }

  req.reminderCount += 1;
  req.lastReminderAt = nowIso();
  req.lastActivityAt = req.lastReminderAt;
  const nextSlot = computeNextReminderAt({ sentAt, reminderCount: req.reminderCount }, reminderSchedule);
  req.nextReminderAt = nextSlot ? nextSlot.toISOString() : null;
  if (req.reminderCount >= reminderSchedule.maxAutoReminders) {
    req.manualFollowUp = true;
    req.nextReminderAt = null;
  }
  req.updatedAt = nowIso();
  await store.upsertSigningRequest(req);
  await appendSigningEvent({
    signingRequestId: req.id,
    leadId: req.leadId,
    type: "reminder_sent",
    metadata: { count: req.reminderCount },
  });
  return req;
}
