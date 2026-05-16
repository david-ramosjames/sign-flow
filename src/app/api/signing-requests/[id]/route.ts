import { NextResponse } from "next/server";
import { getSignFlowStore } from "@/lib/db";
import { requireSessionUser } from "@/lib/auth/get-session";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireSessionUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const store = getSignFlowStore();
  const item = await store.getSigningRequest(id);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const lead = await store.getLead(item.leadId);
  return NextResponse.json({ item, lead });
}
