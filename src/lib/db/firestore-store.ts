import { getApps, initializeApp, cert, type App } from "firebase-admin/app";
import { getFirestore, type Firestore, type CollectionReference } from "firebase-admin/firestore";
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

function getAdminApp(): App {
  const existing = getApps();
  if (existing.length) return existing[0]!;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Missing FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY for firebase-admin.");
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

function col<T extends Record<string, unknown>>(db: Firestore, name: string): CollectionReference<T> {
  return db.collection(name) as CollectionReference<T>;
}

export class FirestoreRelayStore implements RelayStore {
  isMock = false;
  private db: Firestore;

  constructor() {
    const app = getAdminApp();
    this.db = getFirestore(app);
  }

  async snapshot(): Promise<StoreSnapshot> {
    const [
      signingRequests,
      documentTemplates,
      reminderSchedules,
      messageTemplates,
      events,
      staffUsers,
      appSettings,
    ] = await Promise.all([
      this.listSigningRequests(),
      this.listDocumentTemplates(),
      this.listReminderSchedules(),
      this.listMessageTemplates(),
      this.allEvents(),
      this.listStaffUsers(),
      this.getAppSettings(),
    ]);
    return {
      signingRequests,
      documentTemplates,
      reminderSchedules,
      messageTemplates,
      events,
      staffUsers,
      appSettings,
    };
  }

  private async allEvents(): Promise<RelayEvent[]> {
    const snap = await this.db.collection("events").orderBy("createdAt", "desc").limit(500).get();
    return snap.docs.map((d) => d.data() as RelayEvent);
  }

  async getSigningRequest(id: string): Promise<SigningRequest | null> {
    const doc = await col<SigningRequest>(this.db, "signingRequests").doc(id).get();
    return doc.exists ? (doc.data() as SigningRequest) : null;
  }

  async listSigningRequests(): Promise<SigningRequest[]> {
    const snap = await col<SigningRequest>(this.db, "signingRequests").orderBy("createdAt", "desc").get();
    return snap.docs.map((d) => d.data() as SigningRequest);
  }

  async upsertSigningRequest(doc: SigningRequest): Promise<void> {
    await col<SigningRequest>(this.db, "signingRequests").doc(doc.id).set(doc, { merge: true });
  }

  async getDocumentTemplate(id: string): Promise<DocumentTemplate | null> {
    const doc = await col<DocumentTemplate>(this.db, "documentTemplates").doc(id).get();
    return doc.exists ? (doc.data() as DocumentTemplate) : null;
  }

  async listDocumentTemplates(): Promise<DocumentTemplate[]> {
    const snap = await col<DocumentTemplate>(this.db, "documentTemplates").orderBy("createdAt", "desc").get();
    return snap.docs.map((d) => d.data() as DocumentTemplate);
  }

  async upsertDocumentTemplate(doc: DocumentTemplate): Promise<void> {
    await col<DocumentTemplate>(this.db, "documentTemplates").doc(doc.id).set(doc, { merge: true });
  }

  async deleteDocumentTemplate(id: string): Promise<void> {
    await col<DocumentTemplate>(this.db, "documentTemplates").doc(id).delete();
  }

  async getReminderSchedule(id: string): Promise<ReminderSchedule | null> {
    const doc = await col<ReminderSchedule>(this.db, "reminderSchedules").doc(id).get();
    return doc.exists ? (doc.data() as ReminderSchedule) : null;
  }

  async listReminderSchedules(): Promise<ReminderSchedule[]> {
    const snap = await col<ReminderSchedule>(this.db, "reminderSchedules").orderBy("createdAt", "desc").get();
    return snap.docs.map((d) => d.data() as ReminderSchedule);
  }

  async upsertReminderSchedule(doc: ReminderSchedule): Promise<void> {
    await col<ReminderSchedule>(this.db, "reminderSchedules").doc(doc.id).set(doc, { merge: true });
  }

  async deleteReminderSchedule(id: string): Promise<void> {
    await col<ReminderSchedule>(this.db, "reminderSchedules").doc(id).delete();
  }

  async getMessageTemplate(id: string): Promise<MessageTemplate | null> {
    const doc = await col<MessageTemplate>(this.db, "messageTemplates").doc(id).get();
    return doc.exists ? (doc.data() as MessageTemplate) : null;
  }

  async listMessageTemplates(): Promise<MessageTemplate[]> {
    const snap = await col<MessageTemplate>(this.db, "messageTemplates").orderBy("createdAt", "desc").get();
    return snap.docs.map((d) => d.data() as MessageTemplate);
  }

  async upsertMessageTemplate(doc: MessageTemplate): Promise<void> {
    await col<MessageTemplate>(this.db, "messageTemplates").doc(doc.id).set(doc, { merge: true });
  }

  async listEventsForSigningRequest(signingRequestId: string): Promise<RelayEvent[]> {
    const snap = await this.db
      .collection("events")
      .where("signingRequestId", "==", signingRequestId)
      .orderBy("createdAt", "desc")
      .get();
    return snap.docs.map((d) => d.data() as RelayEvent);
  }

  async appendEvent(ev: RelayEvent): Promise<void> {
    await col<RelayEvent>(this.db, "events").doc(ev.id).set(ev);
  }

  async listStaffUsers(): Promise<StaffUser[]> {
    const snap = await col<StaffUser>(this.db, "staffUsers").orderBy("createdAt", "desc").get();
    return snap.docs.map((d) => d.data() as StaffUser);
  }

  async upsertStaffUser(doc: StaffUser): Promise<void> {
    await col<StaffUser>(this.db, "staffUsers").doc(doc.id).set(doc, { merge: true });
  }

  async getAppSettings(): Promise<AppSettings | null> {
    const doc = await col<AppSettings>(this.db, "appSettings").doc("default").get();
    return doc.exists ? (doc.data() as AppSettings) : null;
  }

  async upsertAppSettings(doc: AppSettings): Promise<void> {
    await col<AppSettings>(this.db, "appSettings").doc("default").set(doc, { merge: true });
  }
}

let firestoreSingleton: FirestoreRelayStore | null = null;

export function getFirestoreStore(): FirestoreRelayStore {
  if (!firestoreSingleton) firestoreSingleton = new FirestoreRelayStore();
  return firestoreSingleton;
}

export function canUseFirestoreAdmin(): boolean {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY,
  );
}
