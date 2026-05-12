import { defaultSmsBody } from "@/lib/default-messages";
import { sendWhatsAppMock } from "@/services/twilio-service";
import type { ChannelSendContext } from "./types";

export type WhatsAppSendRecord = {
  sid: string;
  status: string;
  body: string;
  to: string;
};

/**
 * WhatsApp via Twilio (MVP: mock). Uses the same retainer SMS copy as SMS until dedicated templates exist.
 * Production: use approved WhatsApp Content Templates + `TWILIO_WHATSAPP_FROM` / Messaging Service with WhatsApp sender.
 */
export async function sendWhatsApp(ctx: ChannelSendContext): Promise<WhatsAppSendRecord | null> {
  if (ctx.whatsappAllowed !== true || !ctx.leadPhoneE164) return null;
  const body = defaultSmsBody(ctx.language, ctx.firstName, ctx.signingLink);
  return sendWhatsAppMock(ctx.leadPhoneE164, body);
}
