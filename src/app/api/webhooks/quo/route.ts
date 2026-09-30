import { NextResponse } from "next/server";
import { authorizeQuoWebhook, processQuoWebhookJson } from "@/server/quo-webhook";

export const dynamic = "force-dynamic";

/**
 * Shared Quo / OpenPhone inbound message webhook (env secret / default workspace).
 * Configure `message.received` → https://your-host/api/webhooks/quo
 * Per-firm Quo accounts should use `/api/webhooks/quo/{firmId}` instead.
 */
export async function POST(req: Request) {
  const rawBody = await req.text();
  const auth = await authorizeQuoWebhook(req, rawBody);
  if (!auth.ok) {
    console.warn("[quo/webhook] unauthorized", {
      reason: auth.reason,
      scheme: "scheme" in auth ? auth.scheme : undefined,
      hasWebhookId: Boolean(req.headers.get("webhook-id")),
      hasOpenPhoneSignature: Boolean(
        req.headers.get("openphone-signature") ?? req.headers.get("OpenPhone-Signature"),
      ),
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const result = await processQuoWebhookJson(json);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "webhook error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
