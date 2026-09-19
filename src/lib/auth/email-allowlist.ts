/** Default staff domain when `SIGNFLOW_ALLOWED_GOOGLE_EMAILS` is unset/empty. */
const DEFAULT_ALLOWED_DOMAINS = ["ramosjames.com"];

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

/**
 * Staff Google accounts allowed to create a Sign Flow session.
 * - Unset / empty → any `@ramosjames.com` address
 * - `*` → any Google account (local/dev only)
 * - Otherwise → comma-separated emails and/or domains
 */
export function isStaffEmailAllowed(email: string): boolean {
  const raw = process.env.SIGNFLOW_ALLOWED_GOOGLE_EMAILS?.trim();
  if (raw === "*") return true;
  const entries = parseEmailAllowlist(raw);
  if (entries.length === 0) {
    return emailMatchesAllowlist(email, DEFAULT_ALLOWED_DOMAINS);
  }
  return emailMatchesAllowlist(email, entries);
}
