import { NextResponse } from "next/server";
import { getRelayStore } from "@/lib/db";
import { requireSessionUser } from "@/lib/auth/get-session";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireSessionUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const store = getRelayStore();
  const item = await store.getSigningRequest(id);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const template = await store.getDocumentTemplate(item.documentTemplateId);
  return NextResponse.json({ item, template });
}
