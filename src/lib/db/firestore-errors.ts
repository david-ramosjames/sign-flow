/** gRPC NOT_FOUND (5) — usually no Firestore DB for this project / wrong database ID. */
export function isFirestoreNotProvisionedError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { code?: number | string; message?: string };
  if (e.code === 5 || e.code === "NOT_FOUND") return true;
  const msg = String(e.message ?? "");
  return /\b5\s+NOT_FOUND\b/i.test(msg) || (msg.includes("NOT_FOUND") && msg.includes("5"));
}
