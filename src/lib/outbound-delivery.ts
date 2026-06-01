import type { AppSettings, OutboundDeliverySettings } from "@/types/models";

/** App-wide toggles for client-facing signing links (initial send, resend, reminders). */
export const DEFAULT_OUTBOUND_DELIVERY: OutboundDeliverySettings = {
  signingSmsEnabled: true,
  signingEmailEnabled: true,
};

export function mergeOutboundDelivery(settings: AppSettings | null): OutboundDeliverySettings {
  return {
    ...DEFAULT_OUTBOUND_DELIVERY,
    ...(settings?.outboundDelivery ?? {}),
  };
}

export function isSigningSmsOutboundEnabled(settings: AppSettings | null): boolean {
  return mergeOutboundDelivery(settings).signingSmsEnabled;
}

export function isSigningEmailOutboundEnabled(settings: AppSettings | null): boolean {
  return mergeOutboundDelivery(settings).signingEmailEnabled;
}
