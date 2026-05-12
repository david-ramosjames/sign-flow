import type { EmailPayload } from "./types";

/**
 * Email delivery provider.
 * MVP: Adobe sends the official signing email when the email channel is selected.
 * This function is reserved for reminder emails or operational mail from Relay in later phases.
 */
export async function sendEmail(payload: EmailPayload): Promise<{ ok: boolean; providerId?: string }> {
  void payload;
  // TODO(Phase 2): Optional Resend/SendGrid for reminder emails, or rely on Adobe reminder emails only.
  return { ok: true };
}
