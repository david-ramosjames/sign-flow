import { NextResponse } from "next/server";
import { isSlackBotConfigured, slackSigningSecret, verifySlackRequest } from "@/lib/slack/config";
import {
  SLACK_CONTRACT_CALLBACK_ID,
  openContractModal,
  type SlackContractModalMeta,
} from "@/lib/slack/contract-modal";
import { handleContractModalSubmission } from "@/lib/slack/handle-contract-submit";
import { slackPostEphemeral } from "@/lib/slack/api";

export const dynamic = "force-dynamic";

type SlackInteractionPayload = {
  type?: string;
  trigger_id?: string;
  user?: { id?: string; name?: string; username?: string };
  channel?: { id?: string };
  actions?: { action_id?: string; value?: string }[];
  view?: {
    callback_id?: string;
    private_metadata?: string;
    state?: unknown;
  };
};

/**
 * Slack interactivity endpoint (modal submit + “Send contract” button).
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
  const payloadRaw = params.get("payload");
  if (!payloadRaw) return NextResponse.json({ error: "Missing payload" }, { status: 400 });

  let payload: SlackInteractionPayload;
  try {
    payload = JSON.parse(payloadRaw) as SlackInteractionPayload;
  } catch {
    return NextResponse.json({ error: "Invalid payload JSON" }, { status: 400 });
  }

  if (payload.type === "block_actions") {
    const action = payload.actions?.[0];
    if (action?.action_id === "open_send_contract_modal" && payload.trigger_id) {
      let channelId = payload.channel?.id ?? "";
      let threadTs: string | null = null;
      try {
        const v = JSON.parse(action.value || "{}") as { channelId?: string; threadTs?: string | null };
        channelId = v.channelId || channelId;
        threadTs = v.threadTs ?? null;
      } catch {
        /* ignore */
      }
      const userId = payload.user?.id ?? "";
      const userName = payload.user?.username || payload.user?.name || "Slack user";
      const opened = await openContractModal({
        triggerId: payload.trigger_id,
        channelId,
        userId,
        userName,
        threadTs,
      });
      if (!opened.ok && channelId && userId) {
        await slackPostEphemeral({
          channel: channelId,
          user: userId,
          threadTs: threadTs ?? undefined,
          text: `Could not open the contract form: ${opened.error}`,
        }).catch(() => undefined);
      }
    }
    return NextResponse.json({ ok: true });
  }

  if (payload.type === "view_submission" && payload.view?.callback_id === SLACK_CONTRACT_CALLBACK_ID) {
    let meta: SlackContractModalMeta;
    try {
      meta = JSON.parse(payload.view.private_metadata || "{}") as SlackContractModalMeta;
    } catch {
      return NextResponse.json({
        response_action: "errors",
        errors: { client_name: "Could not read form metadata. Try again." },
      });
    }

    const result = await handleContractModalSubmission({
      meta,
      state: (payload.view.state ?? {}) as Parameters<typeof handleContractModalSubmission>[0]["state"],
    });

    if (!result.ok) {
      return NextResponse.json({
        response_action: "errors",
        errors: result.errors,
      });
    }

    return NextResponse.json({ response_action: "clear" });
  }

  return NextResponse.json({ ok: true });
}
