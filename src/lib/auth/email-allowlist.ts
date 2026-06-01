/** Parse comma-separated allowlist entries (emails and/or domains). */
export function parseEmailAllowlist(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Match allowlist entries:
 * - Full email: `david@ramosjames.com`
 * - Domain: `ramosjames.com` or `@ramosjames.com` (any `@thatdomain` address)
 */
export function emailMatchesAllowlist(email: string, entries: string[]): boolean {
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) return false;

  for (const entry of entries) {
    if (entry.includes("@") && !entry.startsWith("@")) {
      if (normalized === entry) return true;
      continue;
    }
    const domain = entry.replace(/^@/, "");
    if (domain && normalized.endsWith(`@${domain}`)) return true;
  }
  return false;
}

/** If `SIGNFLOW_ALLOWED_GOOGLE_EMAILS` is set, email must match an entry (exact or domain). */
export function isStaffEmailAllowed(email: string): boolean {
  const entries = parseEmailAllowlist(process.env.SIGNFLOW_ALLOWED_GOOGLE_EMAILS);
  if (entries.length === 0) return true;
  return emailMatchesAllowlist(email, entries);
}
