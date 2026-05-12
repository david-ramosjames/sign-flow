import { NextResponse } from "next/server";
import { getRelayStore } from "@/lib/db";
import { appendRelayEvent } from "@/services/events-service";
import { mapAdobeWebhookToRelayStatus } from "@/services/adobe-service";
import { nowIso } from "@/lib/time";

/**
 * Acrobat Sign webhooks (Phase 2):
 * - Verify Adobe signature / client id per Adobe documentation.
 * - Parse event payload and update the matching signing request by `adobeAgreementId`.
 *
 * For MVP this endpoint accepts a JSON body for local testing:
 * { "agreementId": "...", "eventType": "AGREEMENT_VIEWED" }
 */
export async function POST(req: Request) {
  // TODO(Phase 2): Verify webhook authenticity (shared secret / signature headers).
  const json = (await req.json().catch(() => null)) as { agreementId?: string; eventType?: string; raw?: unknown };
  const mapped = mapAdobeWebhookToRelayStatus({ agreementId: json?.agreementId, eventType: json?.eventType, raw: json });

  if (!json?.agreementId) {
    return NextResponse.json({ ok: false, error: "agreementId required" }, { status: 400 });
  }

  const store = getRelayStore();
  const all = await store.listSigningRequests();
  const match = all.find((s) => s.adobeAgreementId === json.agreementId);
  if (!match) {
    return NextResponse.json({ ok: true, note: "No matching signing request (ignored)" });
  }

  const status = mapped.status ?? match.status;
  const stopReminders = ["Completed", "Signed", "Declined", "Expired"].includes(status);
  const completedAt =
    status === "Completed" || status === "Signed"
      ? nowIso()
      : status === "Declined" || status === "Expired"
        ? nowIso()
        : match.completedAt;

  await store.upsertSigningRequest({
    ...match,
    status,
    remindersEnabled: stopReminders ? false : match.remindersEnabled,
    remindersPaused: stopReminders ? true : match.remindersPaused,
    nextReminderAt: stopReminders ? null : match.nextReminderAt,
    completedAt,
    updatedAt: nowIso(),
  });

  if (mapped.event) {
    await appendRelayEvent({
      signingRequestId: match.id,
      type: mapped.event,
      message: `Adobe webhook: ${json.eventType ?? "unknown"}`,
      metadata: { raw: json },
      createdBy: null,
    });
  }

  if (status === "Completed" || status === "Signed") {
    const hook = process.env.SLACK_WEBHOOK_URL;
    if (hook) {
      // TODO(Phase 3): Post a formatted Slack message with lead name + template + agreement id.
      void hook;
    }
  }

  return NextResponse.json({ ok: true, status });
}
