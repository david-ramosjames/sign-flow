import { getFirestore, type Firestore, type CollectionReference } from "firebase-admin/firestore";
import { getFirebaseAdminApp } from "@/lib/firebase/admin-app";
import type { AppSettings, Lead, SigningEvent, SigningRequest } from "@/types/models";
import type { SignFlowStore, StoreSnapshot } from "./store-types";

function col<T extends Record<string, unknown>>(db: Firestore, name: string): CollectionReference<T> {
  return db.collection(name) as CollectionReference<T>;
}

export class FirestoreSignFlowStore implements SignFlowStore {
  isMock = false;
  private db: Firestore;

  constructor() {
    const app = getFirebaseAdminApp();
    const databaseId = process.env.FIRESTORE_DATABASE_ID?.trim();
    this.db = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
  }

  async snapshot(): Promise<StoreSnapshot> {
    const [leads, signingRequests, signingEvents, appSettings] = await Promise.all([
      this.listLeads(),
      this.listSigningRequests(),
      this.allSigningEvents(),
      this.getAppSettings(),
    ]);
    return { leads, signingRequests, signingEvents, appSettings };
  }

  private async allSigningEvents(): Promise<SigningEvent[]> {
    const snap = await this.db.collection("signingEvents").orderBy("timestamp", "desc").limit(500).get();
    return snap.docs.map((d) => d.data() as SigningEvent);
  }

  async getLead(id: string): Promise<Lead | null> {
    const doc = await col<Lead>(this.db, "leads").doc(id).get();
    return doc.exists ? (doc.data() as Lead) : null;
  }

  async listLeads(): Promise<Lead[]> {
    const snap = await col<Lead>(this.db, "leads").orderBy("createdAt", "desc").get();
    return snap.docs.map((d) => d.data() as Lead);
  }

  async upsertLead(doc: Lead): Promise<void> {
    await col<Lead>(this.db, "leads").doc(doc.id).set(doc, { merge: true });
  }

  async getSigningRequest(id: string): Promise<SigningRequest | null> {
    const doc = await col<SigningRequest>(this.db, "signingRequests").doc(id).get();
    return doc.exists ? (doc.data() as SigningRequest) : null;
  }

  async listSigningRequests(): Promise<SigningRequest[]> {
    const snap = await col<SigningRequest>(this.db, "signingRequests").orderBy("updatedAt", "desc").get();
    return snap.docs.map((d) => d.data() as SigningRequest);
  }

  async upsertSigningRequest(doc: SigningRequest): Promise<void> {
    await col<SigningRequest>(this.db, "signingRequests").doc(doc.id).set(doc, { merge: true });
  }

  async purgeSigningRequest(signingRequestId: string): Promise<void> {
    const eventsSnap = await this.db
      .collection("signingEvents")
      .where("signingRequestId", "==", signingRequestId)
      .get();
    const batch = this.db.batch();
    for (const doc of eventsSnap.docs) {
      batch.delete(doc.ref);
    }
    batch.delete(col<SigningRequest>(this.db, "signingRequests").doc(signingRequestId));
    await batch.commit();
  }

  async findSigningRequestByDocusealSubmissionId(submissionId: number): Promise<SigningRequest | null> {
    const snap = await this.db
      .collection("signingRequests")
      .where("docusealSubmissionId", "==", submissionId)
      .limit(1)
      .get();
    if (snap.empty) return null;
    return snap.docs[0]!.data() as SigningRequest;
  }

  async listSigningEventsForRequest(signingRequestId: string): Promise<SigningEvent[]> {
    const snap = await this.db
      .collection("signingEvents")
      .where("signingRequestId", "==", signingRequestId)
      .get();
    const rows = snap.docs.map((d) => d.data() as SigningEvent);
    rows.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return rows;
  }

  async appendSigningEvent(ev: SigningEvent): Promise<void> {
    await col<SigningEvent>(this.db, "signingEvents").doc(ev.id).set(ev);
  }

  async getAppSettings(): Promise<AppSettings | null> {
    const doc = await col<AppSettings>(this.db, "appSettings").doc("default").get();
    return doc.exists ? (doc.data() as AppSettings) : null;
  }

  async upsertAppSettings(doc: AppSettings): Promise<void> {
    await col<AppSettings>(this.db, "appSettings").doc("default").set(doc, { merge: true });
  }
}

let firestoreSingleton: FirestoreSignFlowStore | null = null;

export function getFirestoreStore(): FirestoreSignFlowStore {
  if (!firestoreSingleton) firestoreSingleton = new FirestoreSignFlowStore();
  return firestoreSingleton;
}

export function canUseFirestoreAdmin(): boolean {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY,
  );
}
