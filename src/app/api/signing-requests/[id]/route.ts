import { NextResponse } from "next/server";
import { getSignFlowStore } from "@/lib/db";
import { isSignFlowAdmin } from "@/lib/auth/is-admin";
import { requireSessionUser } from "@/lib/auth/get-session";
import { normalizeSigningRequestForDisplay } from "@/lib/signing-request-active";
import { purgeSigningRequest } from "@/server/signing-workflow";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireSessionUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const store = getSignFlowStore();
  const raw = await store.getSigningRequest(id);
  if (!raw) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const item = normalizeSigningRequestForDisplay(raw);
  const lead = await store.getLead(item.leadId);
  return NextResponse.json({ item, lead });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  let actor: { sub: string; email?: string };
  try {
    actor = await requireSessionUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSignFlowAdmin(actor.email)) {
    return NextResponse.json(
      { error: "Only admins may permanently delete signing requests. Set SIGNFLOW_ADMIN_EMAILS for your account." },
      { status: 403 },
    );
  }
  const { id } = await ctx.params;
  try {
    await purgeSigningRequest(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: msg }, { status: msg === "Not found" ? 404 : 400 });
  }
}
