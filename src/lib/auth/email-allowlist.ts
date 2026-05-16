/** If `SIGNFLOW_ALLOWED_GOOGLE_EMAILS` is set, email must be in the comma-separated list (case-insensitive). */
export function isStaffEmailAllowed(email: string): boolean {
  const raw = process.env.SIGNFLOW_ALLOWED_GOOGLE_EMAILS?.trim();
  if (!raw) return true;
  const allowed = new Set(raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean));
  return allowed.has(email.toLowerCase());
}
