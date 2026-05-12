import { getMemoryStore } from "./in-memory-store";
import { canUseFirestoreAdmin, getFirestoreStore } from "./firestore-store";
import type { RelayStore } from "./store-types";

/**
 * Returns Firestore-backed store when service-account env is present; otherwise in-memory (dev/MVP).
 * Set USE_MOCK_DB=true to force mock even if Firebase credentials exist.
 */
export function getRelayStore(): RelayStore {
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

export type { RelayStore, StoreSnapshot } from "./store-types";
