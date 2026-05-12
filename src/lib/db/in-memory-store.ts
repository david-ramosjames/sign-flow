import type {
  AppSettings,
  DocumentTemplate,
  MessageTemplate,
  RelayEvent,
  ReminderSchedule,
  SigningRequest,
  StaffUser,
} from "@/types/models";
import type { RelayStore, StoreSnapshot } from "./store-types";

function sortByCreatedAtDesc<T extends { createdAt: string }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export class InMemoryRelayStore implements RelayStore {
  isMock = true;

  signingRequests = new Map<string, SigningRequest>();
  documentTemplates = new Map<string, DocumentTemplate>();
  reminderSchedules = new Map<string, ReminderSchedule>();
  messageTemplates = new Map<string, MessageTemplate>();
  events = new Map<string, RelayEvent>();
  staffUsers = new Map<string, StaffUser>();
  appSettings: AppSettings | null = null;

  async snapshot(): Promise<StoreSnapshot> {
    return {
      signingRequests: sortByCreatedAtDesc([...this.signingRequests.values()]),
      documentTemplates: sortByCreatedAtDesc([...this.documentTemplates.values()]),
      reminderSchedules: sortByCreatedAtDesc([...this.reminderSchedules.values()]),
      messageTemplates: sortByCreatedAtDesc([...this.messageTemplates.values()]),
      events: sortByCreatedAtDesc([...this.events.values()]),
      staffUsers: sortByCreatedAtDesc([...this.staffUsers.values()]),
      appSettings: this.appSettings,
    };
  }

  async getSigningRequest(id: string): Promise<SigningRequest | null> {
    return this.signingRequests.get(id) ?? null;
  }

  async listSigningRequests(): Promise<SigningRequest[]> {
    return sortByCreatedAtDesc([...this.signingRequests.values()]);
  }

  async upsertSigningRequest(doc: SigningRequest): Promise<void> {
    this.signingRequests.set(doc.id, doc);
  }

  async getDocumentTemplate(id: string): Promise<DocumentTemplate | null> {
    return this.documentTemplates.get(id) ?? null;
  }

  async listDocumentTemplates(): Promise<DocumentTemplate[]> {
    return sortByCreatedAtDesc([...this.documentTemplates.values()]);
  }

  async upsertDocumentTemplate(doc: DocumentTemplate): Promise<void> {
    this.documentTemplates.set(doc.id, doc);
  }

  async deleteDocumentTemplate(id: string): Promise<void> {
    this.documentTemplates.delete(id);
  }

  async getReminderSchedule(id: string): Promise<ReminderSchedule | null> {
    return this.reminderSchedules.get(id) ?? null;
  }

  async listReminderSchedules(): Promise<ReminderSchedule[]> {
    return sortByCreatedAtDesc([...this.reminderSchedules.values()]);
  }

  async upsertReminderSchedule(doc: ReminderSchedule): Promise<void> {
    this.reminderSchedules.set(doc.id, doc);
  }

  async deleteReminderSchedule(id: string): Promise<void> {
    this.reminderSchedules.delete(id);
  }

  async getMessageTemplate(id: string): Promise<MessageTemplate | null> {
    return this.messageTemplates.get(id) ?? null;
  }

  async listMessageTemplates(): Promise<MessageTemplate[]> {
    return sortByCreatedAtDesc([...this.messageTemplates.values()]);
  }

  async upsertMessageTemplate(doc: MessageTemplate): Promise<void> {
    this.messageTemplates.set(doc.id, doc);
  }

  async listEventsForSigningRequest(signingRequestId: string): Promise<RelayEvent[]> {
    return sortByCreatedAtDesc([...this.events.values()].filter((e) => e.signingRequestId === signingRequestId));
  }

  async appendEvent(ev: RelayEvent): Promise<void> {
    this.events.set(ev.id, ev);
  }

  async listStaffUsers(): Promise<StaffUser[]> {
    return sortByCreatedAtDesc([...this.staffUsers.values()]);
  }

  async upsertStaffUser(doc: StaffUser): Promise<void> {
    this.staffUsers.set(doc.id, doc);
  }

  async getAppSettings(): Promise<AppSettings | null> {
    return this.appSettings;
  }

  async upsertAppSettings(doc: AppSettings): Promise<void> {
    this.appSettings = doc;
  }
}

let memorySingleton: InMemoryRelayStore | null = null;

export function getMemoryStore(): InMemoryRelayStore {
  if (!memorySingleton) memorySingleton = new InMemoryRelayStore();
  return memorySingleton;
}
