import { isSmsStopKeyword, normalizePhoneE164 } from "@/lib/phone";

/**
 * Parse inbound SMS mirrored to Slack by Quo Router (or similar) bots.
 * Example:
 *   :speech_balloon: *New Text Message*
 *   From: +14255333925
 *   To: Leads (+15127643037)
 *   Message: STOP
 */
export function parseQuoRouterSlackInbound(text: string): { fromPhone: string; body: string } | null {
  if (!/new text message/i.test(text)) return null;

  const fromMatch = text.match(/^\s*From:\s*(\+[\d\s()-]+)/im);
  const msgMatch = text.match(/^\s*Message:\s*(.+)$/im);
  if (!fromMatch || !msgMatch) return null;

  const body = msgMatch[1]!.trim();
  if (!isSmsStopKeyword(body)) return null;

  const fromPhone = normalizePhoneE164(fromMatch[1]!.trim());
  if (!fromPhone) return null;

  return { fromPhone, body };
}
