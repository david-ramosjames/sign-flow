import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth/get-session";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireSessionUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const { ensureSigningUrl } = await import("@/server/signing-request-actions");
  try {
    const url = await ensureSigningUrl(id);
    return NextResponse.json({ signingUrl: url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
