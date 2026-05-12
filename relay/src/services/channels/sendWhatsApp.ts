import type { ChannelSendContext } from "./types";

/**
 * WhatsApp (Twilio) is intentionally NOT wired in MVP.
 *
 * Important differences vs SMS:
 * - WhatsApp uses a separate Twilio sender prefix (`whatsapp:+...`) and recipient address format.
 * - Many business-initiated conversations require pre-approved WhatsApp Content Templates.
 * - Opt-in requirements are stricter; capture explicit WhatsApp consent separately from SMS TCPA consent.
 *
 * TODO(Phase 3): Implement template-based sends + consent flags + channel selection in UI.
 */
export async function sendWhatsApp(_ctx: ChannelSendContext): Promise<null> {
  void _ctx;
  return null;
}
