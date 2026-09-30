/** gRPC NOT_FOUND (5) — usually no Firestore DB for this project / wrong database ID. */
export function isFirestoreNotProvisionedError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { code?: number | string; message?: string; details?: string };
  if (e.code === 5 || e.code === "NOT_FOUND") return true;
  const msg = String(e.message ?? "");
  return /\b5\s+NOT_FOUND\b/i.test(msg) || (msg.includes("NOT_FOUND") && msg.includes("5"));
}

/** gRPC RESOURCE_EXHAUSTED (8) — Firestore read/write quota or rate limit. */
export function isFirestoreQuotaExceededError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { code?: number | string; message?: string; details?: string };
  if (e.code === 8 || e.code === "RESOURCE_EXHAUSTED") return true;
  const blob = `${e.message ?? ""} ${e.details ?? ""}`;
  return /RESOURCE_EXHAUSTED/i.test(blob) || /Quota exceeded/i.test(blob);
}

export function firestoreErrorResponse(err: unknown): { status: number; body: { error: string; hint?: string } } | null {
  if (isFirestoreNotProvisionedError(err)) {
    return {
      status: 503,
      body: {
        error: "Firestore is not available for this project.",
        hint: "Create a Firestore database in Firebase Console, or set USE_MOCK_DB=true for local demos.",
      },
    };
  }
  if (isFirestoreQuotaExceededError(err)) {
    return {
      status: 503,
      body: {
        error: "Sign Flow database quota exceeded (Firestore RESOURCE_EXHAUSTED).",
        hint: "Check Firebase Console → Usage. Daily free-tier limits may have been hit; wait for reset, reduce traffic, or enable billing. Sign-in succeeded but firm data could not be loaded.",
      },
    };
  }
  return null;
}
