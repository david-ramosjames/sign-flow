import type { SupportedLanguage } from "@/types/models";

export type ChannelSendContext = {
  signingRequestId: string;
  leadEmail: string | null;
  leadPhoneE164: string | null;
  language: SupportedLanguage;
  firstName: string;
  signingLink: string;
  /** When false, skip SMS (also used to enforce consent at call site). */
  smsAllowed: boolean;
};

export type EmailPayload = {
  to: string;
  subject: string;
  html: string;
};
