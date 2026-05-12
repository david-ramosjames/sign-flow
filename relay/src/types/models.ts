/**
 * Firestore-aligned domain types for Relay (Ramos James Law).
 * Adobe Acrobat Sign remains the legal system of record; these records orchestrate delivery and reminders.
 */

export type SigningRequestStatus =
  | "Draft"
  | "Sent"
  | "Viewed"
  | "Signed"
  | "Completed"
  | "Declined"
  | "Expired"
  | "Failed";

export type DeliveryChannel = "email" | "sms";

export type ReminderChannel = "sms" | "email" | "both";

export type SupportedLanguage = "en" | "es";

export type ReminderStepKind = "relative_minutes" | "next_local_morning";

export type ReminderStep = {
  id: string;
  kind: ReminderStepKind;
  /** Used when kind === "relative_minutes" — minutes after the agreement was first sent. */
  delayMinutes?: number;
  /** Used when kind === "next_local_morning" — local hour (0–23) on the next calendar day after `delayMinutes` optional anchor. */
  morningHour?: number;
  /** Optional anchor: wait at least this many minutes before evaluating "next morning". */
  minDelayMinutes?: number;
  channel: ReminderChannel;
  messageTemplateId?: string;
  sendWindowStart?: string;
  sendWindowEnd?: string;
};

export type SigningRequest = {
  id: string;
  leadFirstName: string;
  leadLastName: string;
  leadFullName: string;
  phone: string | null;
  email: string | null;
  language: SupportedLanguage;
  documentTemplateId: string;
  adobeAgreementId: string | null;
  signingUrl: string | null;
  status: SigningRequestStatus;
  deliveryChannels: DeliveryChannel[];
  remindersEnabled: boolean;
  remindersPaused: boolean;
  reminderScheduleId: string;
  nextReminderAt: string | null;
  lastReminderAt: string | null;
  lastSentAt: string | null;
  reminderCount: number;
  assignedStaffUserId: string | null;
  staffNotes: string | null;
  smsConsentConfirmed: boolean;
  /** When true, reminder engine should surface an intake call task (Phase 2 cron). */
  intakeCallAlert: boolean;
  contactedAt: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type DocumentTemplate = {
  id: string;
  name: string;
  adobeLibraryDocumentId: string | null;
  adobeWorkflowId: string | null;
  description: string;
  matterType: string;
  language: SupportedLanguage;
  requiredFields: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ReminderSchedule = {
  id: string;
  name: string;
  active: boolean;
  steps: ReminderStep[];
  maxReminders: number;
  createdAt: string;
  updatedAt: string;
};

export type MessageTemplateChannel = "sms" | "email" | "both";

export type MessageTemplate = {
  id: string;
  name: string;
  channel: MessageTemplateChannel;
  language: SupportedLanguage;
  body: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type EventType =
  | "created"
  | "adobe_agreement_created"
  | "email_sent"
  | "sms_sent"
  | "reminder_sent"
  | "viewed"
  | "signed"
  | "completed"
  | "declined"
  | "expired"
  | "cancelled"
  | "failed"
  | "paused"
  | "resumed"
  | "staff_note"
  | "contacted"
  | "webhook_received";

export type RelayEvent = {
  id: string;
  signingRequestId: string;
  type: EventType;
  message: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  createdBy: string | null;
};

export type StaffUser = {
  id: string;
  displayName: string;
  email: string;
  role: "admin" | "staff";
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AppSettings = {
  id: "default";
  /** Display-only placeholders; secrets live in env vars. */
  adobeClientIdLast4: string | null;
  twilioConfigured: boolean;
  smsFromNumberOrService: string | null;
  defaultLanguage: SupportedLanguage;
  slackWebhookConfigured: boolean;
  updatedAt: string;
};

export const ADOBE_MERGE_FIELD_KEYS = [
  "first_name",
  "last_name",
  "full_name",
  "phone",
  "email",
  "language",
  "matter_type",
  "date_sent",
  "staff_member",
] as const;

export type AdobeMergeFieldKey = (typeof ADOBE_MERGE_FIELD_KEYS)[number];
