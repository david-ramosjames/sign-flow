import { slackBotToken } from "@/lib/slack/config";

export async function slackApi<T = unknown>(
  method: string,
  body: Record<string, unknown>,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const token = slackBotToken();
  if (!token) return { ok: false, error: "SLACK_BOT_TOKEN is not configured." };

  const res = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => null)) as
    | (T & { ok?: boolean; error?: string })
    | null;
  if (!res.ok) {
    return { ok: false, error: `Slack HTTP ${res.status}` };
  }
  if (!json || json.ok === false) {
    return { ok: false, error: json?.error ?? "Slack API error" };
  }
  return { ok: true, data: json as T };
}

export async function slackPostEphemeral(opts: {
  channel: string;
  user: string;
  text: string;
}): Promise<void> {
  await slackApi("chat.postEphemeral", {
    channel: opts.channel,
    user: opts.user,
    text: opts.text,
  });
}

export async function slackPostMessage(opts: {
  channel: string;
  text: string;
  threadTs?: string;
}): Promise<void> {
  await slackApi("chat.postMessage", {
    channel: opts.channel,
    text: opts.text,
    ...(opts.threadTs ? { thread_ts: opts.threadTs } : {}),
  });
}
