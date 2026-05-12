import { defaultSmsBody } from "@/lib/default-messages";
import { sendSmsMock } from "@/services/twilio-service";
import type { ChannelSendContext } from "./types";

export type SmsSendRecord = {
  sid: string;
  status: string;
  body: string;
  to: string;
};

export async function sendSms(ctx: ChannelSendContext): Promise<SmsSendRecord | null> {
  if (!ctx.smsAllowed || !ctx.leadPhoneE164) return null;
  const body = defaultSmsBody(ctx.language, ctx.firstName, ctx.signingLink);
  // TODO(Phase 2): switch to real Twilio when env present; keep mock fallback for dev.
  return sendSmsMock(ctx.leadPhoneE164, body);
}
