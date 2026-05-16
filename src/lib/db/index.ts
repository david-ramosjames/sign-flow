import { getMemoryStore } from "./in-memory-store";
import { canUseFirestoreAdmin, getFirestoreStore } from "./firestore-store";
import type { SignFlowStore } from "./store-types";

/**
 * Returns Firestore-backed store when service-account env is present; otherwise in-memory (dev/MVP).
 * Set USE_MOCK_DB=true to force mock even if Firebase credentials exist (e.g. Firestore not provisioned).
 * Optional FIRESTORE_DATABASE_ID selects a non-default Firestore database.
 */
export function getSignFlowStore(): SignFlowStore {
  const forceMock = process.env.USE_MOCK_DB === "true";
  if (!forceMock && canUseFirestoreAdmin()) {
    try {
      return getFirestoreStore();
    } catch {
      return getMemoryStore();
    }
  }
  return getMemoryStore();
}

export type { SignFlowStore, StoreSnapshot } from "./store-types";
