import { NextResponse } from "next/server";
import { isSlackBotConfigured, slackSigningSecret, verifySlackRequest } from "@/lib/slack/config";
import { slackPostEphemeral, slackPostMessage } from "@/lib/slack/api";

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
  // Strip bot mention tokens like <@U123> or <@U123|name>
  const cleaned = t.replace(/<@[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return (
    cleaned.includes("send contract") ||
    cleaned.includes("send a contract") ||
    cleaned === "contract" ||
    cleaned.startsWith("contract ")
  );
}

function sendContractBlocks(channel: string, threadTs: string | null) {
  return [
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
            threadTs,
          }),
        },
      ],
    },
  ] as Record<string, unknown>[];
}

/**
 * Post the “Send contract” prompt. Prefer ephemeral (only the mentioning user).
 * Await before responding — Slack allows ~3s and Vercel may drop after()-style work.
 */
async function promptSendContract(opts: {
  channel: string;
  userId: string;
  threadTs?: string;
  parentTs?: string;
}): Promise<void> {
  const { channel, userId, threadTs, parentTs } = opts;
  const replyThreadTs = threadTs ?? parentTs ?? null;
  const blocks = sendContractBlocks(channel, replyThreadTs);

  const ephemeral = await slackPostEphemeral({
    channel,
    user: userId,
    threadTs,
    text: "Open the contract form:",
    blocks,
  });
  if (ephemeral.ok) return;

  // Retry without thread_ts (some workspaces reject ephemeral+thread_ts).
  if (threadTs) {
    const retry = await slackPostEphemeral({
      channel,
      user: userId,
      text: "Open the contract form:",
      blocks,
    });
    if (retry.ok) {
      console.warn("[slack/events] ephemeral ok without thread_ts; prior error:", ephemeral.error);
      return;
    }
    console.error("[slack/events] ephemeral failed:", ephemeral.error, "retry:", retry.error);
  } else {
    console.error("[slack/events] ephemeral failed:", ephemeral.error);
  }

  // Last resort: visible thread/channel reply so the user still gets a button.
  const posted = await slackPostMessage({
    channel,
    threadTs: replyThreadTs ?? undefined,
    text: "Open the contract form:",
    blocks,
  });
  if (!posted.ok) {
    console.error("[slack/events] postMessage fallback failed:", posted.error);
  }
}

/**
 * Slack Events API — app_mention opens the contract modal when the message asks to send a contract.
 */
export async function POST(req: Request) {
  const secret = slackSigningSecret();
  if (!secret) {
    return NextResponse.json({ error: "SLACK_SIGNING_SECRET is not configured" }, { status: 503 });
  }

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

  // Slack Event Subscriptions URL verification (must return the challenge as plain text).
  if (payload.type === "url_verification" && payload.challenge) {
    return new NextResponse(payload.challenge, {
      status: 200,
      headers: { "content-type": "text/plain" },
    });
  }

  if (!isSlackBotConfigured()) {
    return NextResponse.json({ error: "Slack bot is not fully configured" }, { status: 503 });
  }

  const event = payload.event;
  if (payload.type === "event_callback" && event?.type === "app_mention" && !event.bot_id) {
    const channel = event.channel ?? "";
    const userId = event.user ?? "";
    const text = event.text ?? "";
    const threadTs = event.thread_ts ?? undefined;

    if (!channel || !userId) {
      return NextResponse.json({ ok: true });
    }

    if (!wantsSendContract(text)) {
      await slackPostEphemeral({
        channel,
        user: userId,
        threadTs,
        text: "To send a contract, say `@Sign Flow send contract` (or use `/send-contract`).",
      });
      return NextResponse.json({ ok: true });
    }

    // App mentions have no trigger_id — modal opens after the user taps the button
    // (block_actions interaction includes trigger_id).
    await promptSendContract({
      channel,
      userId,
      threadTs,
      parentTs: event.ts,
    });
  }

  return NextResponse.json({ ok: true });
}
