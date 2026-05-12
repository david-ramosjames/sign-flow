import type { DeliveryChannel, SigningRequest, StaffUser, SupportedLanguage } from "@/types/models";
import { getRelayStore } from "@/lib/db";
import { newId, nowIso } from "@/lib/time";
import { formatPhoneE164 } from "@/lib/phone";
import { appendRelayEvent } from "@/services/events-service";
import { createAdobeAgreementMock } from "@/services/adobe-service";
import { sendSms, sendWhatsApp } from "@/services/channels";
import { computeNextReminderAt } from "@/services/reminder-service";

export type CreateSigningRequestInput = {
  leadFirstName: string;
  leadLastName: string;
  phone: string | null;
  email: string | null;
  language: SupportedLanguage;
  documentTemplateId: string;
  deliveryChannels: DeliveryChannel[];
  staffNotes?: string | null;
  smsConsentConfirmed: boolean;
  whatsappConsentConfirmed: boolean;
  assignedStaffUserId?: string | null;
};

export async function createAndSendSigningRequest(input: CreateSigningRequestInput, actor: { sub: string; name: string }) {
  const store = getRelayStore();
  const template = await store.getDocumentTemplate(input.documentTemplateId);
  if (!template || !template.active) {
    throw new Error("Invalid document template");
  }

  const phoneE164 = input.phone ? formatPhoneE164(input.phone) : null;
  if (input.phone && !phoneE164) {
    throw new Error("Invalid phone number");
  }

  if (!input.email && !phoneE164) {
    throw new Error("Provide at least email or phone");
  }

  const wantsSms = input.deliveryChannels.includes("sms");
  if (wantsSms && !input.smsConsentConfirmed) {
    throw new Error("SMS consent confirmation is required");
  }
  if (wantsSms && !phoneE164) {
    throw new Error("Phone is required for SMS delivery");
  }

  const wantsWhatsApp = input.deliveryChannels.includes("whatsapp");
  if (wantsWhatsApp && !input.whatsappConsentConfirmed) {
    throw new Error("WhatsApp consent confirmation is required");
  }
  if (wantsWhatsApp && !phoneE164) {
    throw new Error("Phone is required for WhatsApp delivery");
  }

  const wantsEmail = input.deliveryChannels.includes("email");
  if (wantsEmail && !input.email) {
    throw new Error("Email is required for email delivery");
  }

  const schedules = await store.listReminderSchedules();
  const defaultSchedule = schedules.find((s) => s.active) ?? schedules[0];
  if (!defaultSchedule) {
    throw new Error("No reminder schedule configured");
  }

  let staff: StaffUser | null = null;
  if (input.assignedStaffUserId) {
    const allStaff = await store.listStaffUsers();
    staff = allStaff.find((s) => s.id === input.assignedStaffUserId) ?? null;
  }

  const id = newId("sr");
  const t = nowIso();
  const fullName = `${input.leadFirstName} ${input.leadLastName}`.trim();

  const draft: SigningRequest = {
    id,
    leadFirstName: input.leadFirstName.trim(),
    leadLastName: input.leadLastName.trim(),
    leadFullName: fullName,
    phone: phoneE164,
    email: input.email?.trim() || null,
    language: input.language,
    documentTemplateId: template.id,
    adobeAgreementId: null,
    signingUrl: null,
    status: "Draft",
    deliveryChannels: input.deliveryChannels,
    remindersEnabled: true,
    remindersPaused: false,
    reminderScheduleId: defaultSchedule.id,
    nextReminderAt: null,
    lastReminderAt: null,
    lastSentAt: null,
    reminderCount: 0,
    assignedStaffUserId: input.assignedStaffUserId ?? null,
    staffNotes: input.staffNotes?.trim() || null,
    smsConsentConfirmed: input.smsConsentConfirmed,
    whatsappConsentConfirmed: input.whatsappConsentConfirmed,
    intakeCallAlert: false,
    contactedAt: null,
    createdAt: t,
    updatedAt: t,
    completedAt: null,
  };

  await store.upsertSigningRequest(draft);
  await appendRelayEvent({
    signingRequestId: id,
    type: "created",
    message: "Signing request created",
    createdBy: actor.sub,
  });

  const adobe = await createAdobeAgreementMock({
    template,
    request: { ...draft, status: "Draft" },
    staff,
    sendViaAdobeEmail: wantsEmail,
  });

  const sentAt = new Date();
  const next = computeNextReminderAt(sentAt, defaultSchedule, 0);

  const updated: SigningRequest = {
    ...draft,
    adobeAgreementId: adobe.agreementId,
    signingUrl: adobe.signingUrl,
    status: "Sent",
    lastSentAt: sentAt.toISOString(),
    nextReminderAt: next ? next.toISOString() : null,
    updatedAt: nowIso(),
  };

  await store.upsertSigningRequest(updated);
  await appendRelayEvent({
    signingRequestId: id,
    type: "adobe_agreement_created",
    message: `Adobe agreement created (${adobe.agreementId})`,
    metadata: { agreementId: adobe.agreementId },
    createdBy: actor.sub,
  });

  if (wantsEmail && updated.email) {
    await appendRelayEvent({
      signingRequestId: id,
      type: "email_sent",
      message: "Adobe outbound email send requested (mock)",
      metadata: { to: updated.email },
      createdBy: actor.sub,
    });
  }

  if (wantsSms) {
    const sms = await sendSms({
      signingRequestId: id,
      leadEmail: updated.email,
      leadPhoneE164: updated.phone,
      language: updated.language,
      firstName: updated.leadFirstName,
      signingLink: adobe.signingUrl,
      smsAllowed: wantsSms && input.smsConsentConfirmed,
    });
    if (sms) {
      await appendRelayEvent({
        signingRequestId: id,
        type: "sms_sent",
        message: "SMS sent (mock Twilio)",
        metadata: { sid: sms.sid, to: sms.to, body: sms.body, status: sms.status },
        createdBy: actor.sub,
      });
    }
  }

  if (wantsWhatsApp) {
    const wa = await sendWhatsApp({
      signingRequestId: id,
      leadEmail: updated.email,
      leadPhoneE164: updated.phone,
      language: updated.language,
      firstName: updated.leadFirstName,
      signingLink: adobe.signingUrl,
      smsAllowed: false,
      whatsappAllowed: wantsWhatsApp && input.whatsappConsentConfirmed,
    });
    if (wa) {
      await appendRelayEvent({
        signingRequestId: id,
        type: "whatsapp_sent",
        message: "WhatsApp sent (mock Twilio)",
        metadata: { sid: wa.sid, to: wa.to, body: wa.body, status: wa.status },
        createdBy: actor.sub,
      });
    }
  }

  return updated;
}
