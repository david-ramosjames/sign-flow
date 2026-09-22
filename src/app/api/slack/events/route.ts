import { waitUntil } from "@vercel/functions";
import { NextResponse } from "next/server";
import { isSlackBotConfigured, slackSigningSecret, verifySlackRequest } from "@/lib/slack/config";
import { slackApi, slackPostEphemeral, slackPostMessage } from "@/lib/slack/api";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type SlackEventPayload = {
  type?: string;
  challenge?: string;
  event_id?: string;
  authorizations?: { user_id?: string }[];
  event?: {
    type?: string;
    user?: string;
    text?: string;
    channel?: string;
    ts?: string;
    thread_ts?: string;
    bot_id?: string;
    subtype?: string;
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

async function promptSendContract(opts: {
  channel: string;
  userId: string;
  threadTs?: string;
  parentTs?: string;
}): Promise<void> {
  const { channel, userId, threadTs, parentTs } = opts;
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
  console.error("[slack/events] postMessage failed:", posted.error, { channel, userId });

  const ephemeral = await slackPostEphemeral({
    channel,
    user: userId,
    threadTs: replyThreadTs,
    text: "Open the contract form:",
    blocks,
  });
  if (ephemeral.ok) {
    console.info("[slack/events] ephemeral ok after postMessage failure");
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
    // One more breadcrumb for ops: auth.test shows which bot/token is live.
    const auth = await slackApi<{ user_id?: string; team?: string; error?: string }>("auth.test", {});
    console.error("[slack/events] auth.test", auth);
  } else {
    console.info("[slack/events] sent Send contract button via DM");
  }
}

async function handleMention(opts: {
  channel: string;
  userId: string;
  text: string;
  threadTs?: string;
  parentTs?: string;
}): Promise<void> {
  if (!wantsSendContract(opts.text)) {
    const hint = await slackPostMessage({
      channel: opts.channel,
      threadTs: opts.threadTs ?? opts.parentTs,
      text: "To send a contract, say `@Sign Flow send contract` (or use `/send-contract`).",
    });
    if (!hint.ok) {
      console.error("[slack/events] hint postMessage failed:", hint.error);
      await postToUserDm({
        userId: opts.userId,
        text: "To send a contract, say `@Sign Flow send contract` (or use `/send-contract`).",
      });
    }
    return;
  }

  await promptSendContract(opts);
}

/**
 * Slack Events API — app_mention (and mention-in-message fallback) → contract form button.
 *
 * Ack strategy: start work immediately, keep it alive with waitUntil, and also wait up to
 * ~2.5s in-request so a warm function usually finishes before Slack’s 3s retry window.
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

  console.info("[slack/events] inbound", {
    payloadType: payload.type,
    eventType: event?.type,
    subtype: event?.subtype ?? null,
    eventId: payload.event_id ?? null,
    channel: event?.channel ?? null,
    threadTs: event?.thread_ts ?? null,
    hasBotId: Boolean(event?.bot_id),
    retryNum: retryNum ?? null,
    retryReason: req.headers.get("x-slack-retry-reason"),
    textPreview: (event?.text ?? "").slice(0, 100),
  });

  if (payload.type !== "event_callback" || !event) {
    return NextResponse.json({ ok: true });
  }

  // Ignore bot/system message noise.
  if (event.bot_id || event.subtype === "bot_message" || event.subtype === "message_changed") {
    return NextResponse.json({ ok: true });
  }

  const botUserId = payload.authorizations?.[0]?.user_id;
  const isAppMention = event.type === "app_mention";
  const isMessageMention =
    event.type === "message" &&
    Boolean(event.text) &&
    (botUserId ? event.text!.includes(`<@${botUserId}>`) : /<@[A-Z0-9]+>/i.test(event.text!));

  if (!isAppMention && !isMessageMention) {
    return NextResponse.json({ ok: true });
  }

  if (!claimEventId(payload.event_id)) {
    console.info("[slack/events] duplicate event_id ignored", payload.event_id);
    return NextResponse.json({ ok: true });
  }

  const channel = event.channel ?? "";
  const userId = event.user ?? "";
  const text = event.text ?? "";
  if (!channel || !userId) {
    return NextResponse.json({ ok: true });
  }

  const work = handleMention({
    channel,
    userId,
    text,
    threadTs: event.thread_ts,
    parentTs: event.ts,
  }).catch((e) => {
    console.error("[slack/events] handler error", e);
  });

  // Keep the invocation alive on Vercel after we return.
  waitUntil(work);

  // Usually finish before Slack’s 3s timeout so retries are rare on warm starts.
  await Promise.race([work, new Promise<void>((r) => setTimeout(r, 2500))]);

  return NextResponse.json({ ok: true });
}
