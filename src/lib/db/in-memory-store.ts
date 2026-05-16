import type { AppSettings, Lead, SigningEvent, SigningRequest } from "@/types/models";
import type { SignFlowStore, StoreSnapshot } from "./store-types";

function sortByDesc<T>(arr: T[], key: keyof T): T[] {
  return [...arr].sort((a, b) => (String(b[key]) < String(a[key]) ? -1 : 1));
}

export class InMemorySignFlowStore implements SignFlowStore {
  isMock = true;

  leads = new Map<string, Lead>();
  signingRequests = new Map<string, SigningRequest>();
  signingEvents = new Map<string, SigningEvent>();
  appSettings: AppSettings | null = null;

  async snapshot(): Promise<StoreSnapshot> {
    return {
      leads: sortByDesc([...this.leads.values()], "createdAt"),
      signingRequests: sortByDesc([...this.signingRequests.values()], "updatedAt"),
      signingEvents: sortByDesc([...this.signingEvents.values()], "timestamp"),
      appSettings: this.appSettings,
    };
  }

  async getLead(id: string): Promise<Lead | null> {
    return this.leads.get(id) ?? null;
  }

  async listLeads(): Promise<Lead[]> {
    return sortByDesc([...this.leads.values()], "createdAt");
  }

  async upsertLead(doc: Lead): Promise<void> {
    this.leads.set(doc.id, doc);
  }

  async getSigningRequest(id: string): Promise<SigningRequest | null> {
    return this.signingRequests.get(id) ?? null;
  }

  async listSigningRequests(): Promise<SigningRequest[]> {
    return sortByDesc([...this.signingRequests.values()], "updatedAt");
  }

  async upsertSigningRequest(doc: SigningRequest): Promise<void> {
    this.signingRequests.set(doc.id, doc);
  }

  async findSigningRequestByDocusealSubmissionId(submissionId: number): Promise<SigningRequest | null> {
    for (const r of this.signingRequests.values()) {
      if (r.docusealSubmissionId === submissionId) return r;
    }
    return null;
  }

  async listSigningEventsForRequest(signingRequestId: string): Promise<SigningEvent[]> {
    return sortByDesc(
      [...this.signingEvents.values()].filter((e) => e.signingRequestId === signingRequestId),
      "timestamp",
    );
  }

  async appendSigningEvent(ev: SigningEvent): Promise<void> {
    this.signingEvents.set(ev.id, ev);
  }

  async getAppSettings(): Promise<AppSettings | null> {
    return this.appSettings;
  }

  async upsertAppSettings(doc: AppSettings): Promise<void> {
    this.appSettings = doc;
  }
}

let memorySingleton: InMemorySignFlowStore | null = null;

export function getMemoryStore(): InMemorySignFlowStore {
  if (!memorySingleton) memorySingleton = new InMemorySignFlowStore();
  return memorySingleton;
}
