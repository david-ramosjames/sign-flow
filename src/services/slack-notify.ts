export async function postSlackMessage(text: string, blocks?: unknown[]): Promise<boolean> {
  const url = process.env.SLACK_WEBHOOK_URL?.trim();
  if (!url) return false;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(blocks?.length ? { text, blocks } : { text }),
  });
  return res.ok;
}
