/**
 * Phase 1: Mock Twilio SMS sender.
 * Phase 2: Use `twilio` npm package with TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN and either
 * TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_NUMBER.
 */

export type SendSmsResult = {
  sid: string;
  status: string;
  body: string;
  to: string;
};

export async function sendSmsMock(to: string, body: string): Promise<SendSmsResult> {
  const sid = `SM_MOCK_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  return { sid, status: "queued", body, to };
}
