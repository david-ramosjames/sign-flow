import { NextResponse } from "next/server";
import { isDocusealWebhookAuthorized, processDocusealWebhookJson } from "@/server/docuseal-webhook";

export async function POST(req: Request) {
  if (!isDocusealWebhookAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const json = await req.json().catch(() => null);
  if (!json) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  try {
    await processDocusealWebhookJson(json);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "webhook error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
