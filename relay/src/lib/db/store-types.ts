import type {
  AppSettings,
  DocumentTemplate,
  MessageTemplate,
  RelayEvent,
  ReminderSchedule,
  SigningRequest,
  StaffUser,
} from "@/types/models";

export type StoreSnapshot = {
  signingRequests: SigningRequest[];
  documentTemplates: DocumentTemplate[];
  reminderSchedules: ReminderSchedule[];
  messageTemplates: MessageTemplate[];
  events: RelayEvent[];
  staffUsers: StaffUser[];
  appSettings: AppSettings | null;
};

export interface RelayStore {
  isMock: boolean;
  snapshot(): Promise<StoreSnapshot>;
  getSigningRequest(id: string): Promise<SigningRequest | null>;
  listSigningRequests(): Promise<SigningRequest[]>;
  upsertSigningRequest(doc: SigningRequest): Promise<void>;
  getDocumentTemplate(id: string): Promise<DocumentTemplate | null>;
  listDocumentTemplates(): Promise<DocumentTemplate[]>;
  upsertDocumentTemplate(doc: DocumentTemplate): Promise<void>;
  getReminderSchedule(id: string): Promise<ReminderSchedule | null>;
  listReminderSchedules(): Promise<ReminderSchedule[]>;
  upsertReminderSchedule(doc: ReminderSchedule): Promise<void>;
  getMessageTemplate(id: string): Promise<MessageTemplate | null>;
  listMessageTemplates(): Promise<MessageTemplate[]>;
  upsertMessageTemplate(doc: MessageTemplate): Promise<void>;
  listEventsForSigningRequest(signingRequestId: string): Promise<RelayEvent[]>;
  appendEvent(ev: RelayEvent): Promise<void>;
  listStaffUsers(): Promise<StaffUser[]>;
  upsertStaffUser(doc: StaffUser): Promise<void>;
  getAppSettings(): Promise<AppSettings | null>;
  upsertAppSettings(doc: AppSettings): Promise<void>;
}
