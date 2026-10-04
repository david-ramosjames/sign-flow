// Re-send the signing link for a request created via POST /api/intake, optionally to a
// corrected email / phone (server-to-server, bearer token).

import { NextResponse } from "next/server";
import { z } from "zod";
import { intakeTokenOk } from "@/lib/auth/intake-token";
import { getSignFlowStore } from "@/lib/db";
import { nowIso } from "@/lib/time";
import { resendSigningNotifications } from "@/server/signing-workflow";

export const dynamic = "force-dynamic";

const schema = z.object({
  sms: z.boolean().optional().default(false),
  email: z.boolean().optional().default(false),
  emailAddress: z.string().email().optional(),
  phone: z.string().min(7).max(20).optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!intakeTokenOk(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const d = parsed.data;
  if (!d.sms && !d.email) return NextResponse.json({ error: "Enable at least one of sms or email." }, { status: 400 });

  const store = getSignFlowStore();
  const item = await store.getSigningRequest(id);
  if (!item || !item.externalRef) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (d.emailAddress || d.phone) {
    if (d.emailAddress) item.email = d.emailAddress.trim();
    if (d.phone) item.phone = d.phone.trim();
    item.updatedAt = nowIso();
    await store.upsertSigningRequest(item);
  }

  try {
    const updated = await resendSigningNotifications(id, { sms: d.sms, email: d.email });
    return NextResponse.json({ ok: true, id: updated.id });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}
