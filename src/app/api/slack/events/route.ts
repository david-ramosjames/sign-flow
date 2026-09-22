import { after, NextResponse } from "next/server";
import { isSlackBotConfigured, slackSigningSecret, verifySlackRequest } from "@/lib/slack/config";
import { slackApi, slackPostEphemeral, slackPostMessage } from "@/lib/slack/api";

export const dynamic = "force-dynamic";

type SlackEventPayload = {
  type?: string;
  challenge?: string;
  event_id?: string;
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

/** Best-effort dedupe for Slack retries (same event_id within a warm instance). */
const seenEventIds = new Map<string, number>();
const EVENT_DEDUP_TTL_MS = 10 * 60 * 1000;

function claimEventId(eventId: string | undefined): boolean {
  if (!eventId) return true;
  const now = Date.now();
  for (const [id, at] of seenEventIds) {
    if (now - at > EVENT_DEDUP_TTL_MS) seenEventIds.delete(id);
  }
  if (seenEventIds.has(eventId)) return false;
  seenEventIds.set(eventId, now);
  return true;
}

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

async function postToUserDm(opts: {
  userId: string;
  text: string;
  blocks?: Record<string, unknown>[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const opened = await slackApi<{ channel?: { id?: string } }>("conversations.open", {
    users: opts.userId,
  });
  if (!opened.ok) return opened;
  const dmChannel = opened.data.channel?.id;
  if (!dmChannel) return { ok: false, error: "conversations.open missing channel id" };
  return slackPostMessage({
    channel: dmChannel,
    text: opts.text,
    blocks: opts.blocks,
  });
}

/**
 * Prefer a visible thread/channel reply (reliable). Fall back to ephemeral, then DM.
 * Runs after HTTP 200 so Slack does not retry for the 3s timeout.
 */
async function promptSendContract(opts: {
  channel: string;
  userId: string;
  threadTs?: string;
  parentTs?: string;
}): Promise<void> {
  const { channel, userId, threadTs, parentTs } = opts;
  // In a thread use parent ts; otherwise reply in a new thread under the mention.
  const replyThreadTs = threadTs ?? parentTs ?? undefined;
  const blocks = sendContractBlocks(channel, replyThreadTs ?? null);

  const posted = await slackPostMessage({
    channel,
    threadTs: replyThreadTs,
    text: "Open the contract form:",
    blocks,
  });
  if (posted.ok) {
    console.info("[slack/events] posted Send contract button", {
      channel,
      threadTs: replyThreadTs ?? null,
    });
    return;
  }
  console.error("[slack/events] postMessage failed:", posted.error);

  const ephemeral = await slackPostEphemeral({
    channel,
    user: userId,
    threadTs: replyThreadTs,
    text: "Open the contract form:",
    blocks,
  });
  if (ephemeral.ok) {
    console.info("[slack/events] ephemeral Send contract button ok after postMessage failure");
    return;
  }
  console.error("[slack/events] ephemeral failed:", ephemeral.error);

  const dm = await postToUserDm({
    userId,
    text: `Could not post in the channel (${posted.error}). Open the form here:`,
    blocks,
  });
  if (!dm.ok) {
    console.error("[slack/events] DM fallback failed:", dm.error);
  } else {
    console.info("[slack/events] sent Send contract button via DM");
  }
}

/**
 * Slack Events API — app_mention prompts for the contract form.
 * Always ack within ~3s; do Slack API work in after().
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
  const retryNum = req.headers.get("x-slack-retry-num");
  if (retryNum) {
    console.warn("[slack/events] Slack retry", {
      retryNum,
      reason: req.headers.get("x-slack-retry-reason"),
      eventId: payload.event_id,
      eventType: event?.type,
    });
  }

  if (payload.type === "event_callback" && event?.type === "app_mention" && !event.bot_id) {
    if (!claimEventId(payload.event_id)) {
      console.info("[slack/events] duplicate event_id ignored", payload.event_id);
      return NextResponse.json({ ok: true });
    }

    const channel = event.channel ?? "";
    const userId = event.user ?? "";
    const text = event.text ?? "";
    const threadTs = event.thread_ts ?? undefined;

    if (!channel || !userId) {
      return NextResponse.json({ ok: true });
    }

    console.info("[slack/events] app_mention", {
      eventId: payload.event_id,
      channel,
      threadTs: threadTs ?? null,
      wantsSend: wantsSendContract(text),
      textPreview: text.slice(0, 80),
    });

    // Ack first — Slack retries if we await chat.* here and blow the 3s budget.
    after(async () => {
      try {
        if (!wantsSendContract(text)) {
          const hint = await slackPostEphemeral({
            channel,
            user: userId,
            threadTs,
            text: "To send a contract, say `@Sign Flow send contract` (or use `/send-contract`).",
          });
          if (!hint.ok) {
            await slackPostMessage({
              channel,
              threadTs: threadTs ?? event.ts,
              text: "To send a contract, say `@Sign Flow send contract` (or use `/send-contract`).",
            });
          }
          return;
        }

        await promptSendContract({
          channel,
          userId,
          threadTs,
          parentTs: event.ts,
        });
      } catch (e) {
        console.error("[slack/events] handler error", e);
      }
    });
  }

  return NextResponse.json({ ok: true });
}
