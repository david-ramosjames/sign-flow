import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth/get-session";
import { postSigningSlackUpdate } from "@/server/signing-workflow";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireSessionUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  try {
    await postSigningSlackUpdate(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
