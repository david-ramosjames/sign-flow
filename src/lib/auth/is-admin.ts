/** Comma-separated admin emails in `SIGNFLOW_ADMIN_EMAILS` may permanently delete signing requests. */
export function isSignFlowAdmin(email: string | undefined): boolean {
  if (!email?.trim()) return false;
  const raw = process.env.SIGNFLOW_ADMIN_EMAILS?.trim();
  if (!raw) return false;
  const allowed = new Set(raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean));
  return allowed.has(email.trim().toLowerCase());
}
