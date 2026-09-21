import { NextResponse } from "next/server";
import { isSlackBotConfigured, slackSigningSecret, verifySlackRequest } from "@/lib/slack/config";
import { slackApi, slackPostEphemeral } from "@/lib/slack/api";

export const dynamic = "force-dynamic";

type SlackEventPayload = {
  type?: string;
  challenge?: string;
  event?: {
    type?: string;
    user?: string;
    text?: string;
    channel?: string;
    ts?: string;
    thread_ts?: string;
    bot_id?: string;
  };
};

function wantsSendContract(text: string): boolean {
  const t = text.toLowerCase();
  // Strip bot mention tokens like <@U123>
  const cleaned = t.replace(/<@[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return (
    cleaned.includes("send contract") ||
    cleaned.includes("send a contract") ||
    cleaned === "contract" ||
    cleaned.startsWith("contract ")
  );
}

/**
 * Slack Events API — app_mention opens the contract modal when the message asks to send a contract.
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

  let payload: SlackEventPayload;
  try {
    payload = JSON.parse(rawBody) as SlackEventPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (payload.type === "url_verification" && payload.challenge) {
    return new NextResponse(payload.challenge, {
      status: 200,
      headers: { "content-type": "text/plain" },
    });
  }

  const event = payload.event;
  if (payload.type === "event_callback" && event?.type === "app_mention" && !event.bot_id) {
    const channel = event.channel ?? "";
    const userId = event.user ?? "";
    const text = event.text ?? "";

    if (!wantsSendContract(text)) {
      if (channel && userId) {
        void slackPostEphemeral({
          channel,
          user: userId,
          text: "To send a contract, say `@Sign Flow send contract` (or use `/send-contract`).",
        });
      }
      return NextResponse.json({ ok: true });
    }

    // App mentions don't include trigger_id — open a DM shortcut via response_url isn't available.
    // Use conversations.open + a button is complex; instead reply with instructions to use slash
    // OR use chat.postEphemeral with a link... Slack requires trigger_id for modals.
    // For app_mention we open a message with a button that has trigger_id from interaction.
    // Simplest UX that works: post ephemeral telling them to use /send-contract,
    // AND try response with "please use /send-contract for the form".
    //
    // Better: use shortcuts with global shortcut that has trigger_id.
    // For @mention without trigger_id, Slack cannot open a modal.
    // Work around: post an ephemeral message with a Block Kit button; clicking the button
    // fires a block_actions interaction WITH trigger_id.

    void (async () => {
      if (!channel || !userId) return;
      await slackApi("chat.postEphemeral", {
        channel,
        user: userId,
        text: "Open the contract form:",
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "Ready to send a contract? Tap the button to open the form.",
            },
          },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                action_id: "open_send_contract_modal",
                text: { type: "plain_text", text: "Send contract" },
                style: "primary",
                value: JSON.stringify({
                  channelId: channel,
                  threadTs: event.thread_ts || event.ts || null,
                }),
              },
            ],
          },
        ],
      });
    })();
  }

  return NextResponse.json({ ok: true });
}
