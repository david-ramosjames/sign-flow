import { getRelayStore } from "@/lib/db";
import { nowIso } from "@/lib/time";
import { appendRelayEvent } from "@/services/events-service";
import { sendSms } from "@/services/channels";
import { createAdobeAgreementMock } from "@/services/adobe-service";

export async function applySigningRequestAction(input: {
  id: string;
  action:
    | "resend_sms"
    | "resend_email"
    | "pause_reminders"
    | "resume_reminders"
    | "cancel_reminders"
    | "mark_contacted"
    | "add_note";
  note?: string;
  actor: { sub: string; name: string };
}) {
  const store = getRelayStore();
  const req = await store.getSigningRequest(input.id);
  if (!req) throw new Error("Not found");

  if (input.action === "resend_sms") {
    if (!req.phone) throw new Error("No phone on file");
    if (!req.signingUrl) throw new Error("No signing link");
    if (!req.smsConsentConfirmed) throw new Error("SMS consent not recorded");
    const sms = await sendSms({
      signingRequestId: req.id,
      leadEmail: req.email,
      leadPhoneE164: req.phone,
      language: req.language,
      firstName: req.leadFirstName,
      signingLink: req.signingUrl,
      smsAllowed: true,
    });
    if (!sms) throw new Error("SMS not sent");
    await appendRelayEvent({
      signingRequestId: req.id,
      type: "sms_sent",
      message: "SMS resent (mock Twilio)",
      metadata: { sid: sms.sid, to: sms.to, body: sms.body, manual: true },
      createdBy: input.actor.sub,
    });
    await store.upsertSigningRequest({ ...req, updatedAt: nowIso() });
    return { ok: true as const };
  }

  if (input.action === "resend_email") {
    await appendRelayEvent({
      signingRequestId: req.id,
      type: "email_sent",
      message: "Email resend requested (mock — Phase 2: Adobe resend/CORRECT API)",
      metadata: { to: req.email, manual: true },
      createdBy: input.actor.sub,
    });
    await store.upsertSigningRequest({ ...req, updatedAt: nowIso() });
    return { ok: true as const };
  }

  if (input.action === "pause_reminders") {
    await store.upsertSigningRequest({ ...req, remindersPaused: true, updatedAt: nowIso() });
    await appendRelayEvent({
      signingRequestId: req.id,
      type: "paused",
      message: "Reminders paused",
      createdBy: input.actor.sub,
    });
    return { ok: true as const };
  }

  if (input.action === "resume_reminders") {
    await store.upsertSigningRequest({ ...req, remindersPaused: false, updatedAt: nowIso() });
    await appendRelayEvent({
      signingRequestId: req.id,
      type: "resumed",
      message: "Reminders resumed",
      createdBy: input.actor.sub,
    });
    return { ok: true as const };
  }

  if (input.action === "cancel_reminders") {
    await store.upsertSigningRequest({
      ...req,
      remindersEnabled: false,
      nextReminderAt: null,
      updatedAt: nowIso(),
    });
    await appendRelayEvent({
      signingRequestId: req.id,
      type: "paused",
      message: "Reminder sequence cancelled",
      createdBy: input.actor.sub,
    });
    return { ok: true as const };
  }

  if (input.action === "mark_contacted") {
    await store.upsertSigningRequest({ ...req, contactedAt: nowIso(), updatedAt: nowIso() });
    await appendRelayEvent({
      signingRequestId: req.id,
      type: "contacted",
      message: "Marked as contacted",
      createdBy: input.actor.sub,
    });
    return { ok: true as const };
  }

  if (input.action === "add_note") {
    const note = (input.note ?? "").trim();
    if (!note) throw new Error("Note required");
    await store.upsertSigningRequest({
      ...req,
      staffNotes: [req.staffNotes, note].filter(Boolean).join("\n---\n"),
      updatedAt: nowIso(),
    });
    await appendRelayEvent({
      signingRequestId: req.id,
      type: "staff_note",
      message: note,
      createdBy: input.actor.sub,
    });
    return { ok: true as const };
  }

  return { ok: false as const };
}

/** Returns signing URL, creating a mock agreement if missing (dev only). */
export async function ensureSigningUrl(reqId: string) {
  const store = getRelayStore();
  const req = await store.getSigningRequest(reqId);
  if (!req) throw new Error("Not found");
  if (req.signingUrl) return req.signingUrl;
  const template = await store.getDocumentTemplate(req.documentTemplateId);
  if (!template) throw new Error("Missing template");
  const staffList = await store.listStaffUsers();
  const staff = req.assignedStaffUserId ? staffList.find((s) => s.id === req.assignedStaffUserId) ?? null : null;
  const adobe = await createAdobeAgreementMock({
    template,
    request: req,
    staff,
    sendViaAdobeEmail: false,
  });
  await store.upsertSigningRequest({
    ...req,
    adobeAgreementId: adobe.agreementId,
    signingUrl: adobe.signingUrl,
    updatedAt: nowIso(),
  });
  return adobe.signingUrl;
}
