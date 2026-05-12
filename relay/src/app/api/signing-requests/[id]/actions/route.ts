import { NextResponse } from "next/server";
import { z } from "zod";
import { getRelayStore } from "@/lib/db";
import { requireSessionUser } from "@/lib/auth/get-session";

const actionSchema = z.object({
  action: z.enum(["resend_sms", "resend_email", "pause_reminders", "resume_reminders", "cancel_reminders", "mark_contacted", "add_note"]),
  note: z.string().optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  let actor: { sub: string; name: string };
  try {
    actor = await requireSessionUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = actionSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { applySigningRequestAction } = await import("@/server/signing-request-actions");
  try {
    await applySigningRequestAction({ id, ...parsed.data, actor });
    const store = getRelayStore();
    const item = await store.getSigningRequest(id);
    return NextResponse.json({ ok: true, item });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
