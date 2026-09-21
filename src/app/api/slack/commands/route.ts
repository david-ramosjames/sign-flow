import { NextResponse } from "next/server";
import { isSlackBotConfigured, slackSigningSecret, verifySlackRequest } from "@/lib/slack/config";
import { openContractModal } from "@/lib/slack/contract-modal";
import { slackPostEphemeral } from "@/lib/slack/api";

export const dynamic = "force-dynamic";

/**
 * Slack slash command: `/send-contract`
 * Opens the send-contract modal.
 */
export async function POST(req: Request) {
  if (!isSlackBotConfigured()) {
    return NextResponse.json({ error: "Slack bot is not configured" }, { status: 503 });
  }
  const secret = slackSigningSecret()!;
  const rawBody = await req.text();
  const ok = verifySlackRequest({
    signingSecret: secret,
    signature: req.headers.get("x-slack-signature"),
    timestamp: req.headers.get("x-slack-request-timestamp"),
    rawBody,
  });
  if (!ok) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });

  const params = new URLSearchParams(rawBody);
  const triggerId = params.get("trigger_id") ?? "";
  const channelId = params.get("channel_id") ?? "";
  const userId = params.get("user_id") ?? "";
  const userName = params.get("user_name") ?? "Slack user";

  if (!triggerId) {
    return NextResponse.json({ response_type: "ephemeral", text: "Missing trigger_id from Slack." });
  }

  // Respond quickly; open modal asynchronously (Slack requires ~3s).
  void (async () => {
    const opened = await openContractModal({
      triggerId,
      channelId,
      userId,
      userName,
    });
    if (!opened.ok && channelId && userId) {
      await slackPostEphemeral({
        channel: channelId,
        user: userId,
        text: `Could not open the contract form: ${opened.error}`,
      }).catch(() => undefined);
    }
  })();

  return new NextResponse(null, { status: 200 });
}
