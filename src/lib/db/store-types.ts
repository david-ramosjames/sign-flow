import type { AppSettings, Lead, SigningEvent, SigningRequest } from "@/types/models";

export type StoreSnapshot = {
  leads: Lead[];
  signingRequests: SigningRequest[];
  signingEvents: SigningEvent[];
  appSettings: AppSettings | null;
};

export interface SignFlowStore {
  isMock: boolean;
  snapshot(): Promise<StoreSnapshot>;

  getLead(id: string): Promise<Lead | null>;
  listLeads(): Promise<Lead[]>;
  upsertLead(doc: Lead): Promise<void>;

  getSigningRequest(id: string): Promise<SigningRequest | null>;
  listSigningRequests(): Promise<SigningRequest[]>;
  upsertSigningRequest(doc: SigningRequest): Promise<void>;
  /** Permanently remove request and its events (admin only). */
  purgeSigningRequest(signingRequestId: string): Promise<void>;
  /** Find signing request by DocuSeal submission id. */
  findSigningRequestByDocusealSubmissionId(submissionId: number): Promise<SigningRequest | null>;

  listSigningEventsForRequest(signingRequestId: string): Promise<SigningEvent[]>;
  appendSigningEvent(ev: SigningEvent): Promise<void>;

  getAppSettings(): Promise<AppSettings | null>;
  upsertAppSettings(doc: AppSettings): Promise<void>;
}
