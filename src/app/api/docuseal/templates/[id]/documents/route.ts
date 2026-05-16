import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth/get-session";
import { listTemplateDocuments } from "@/services/docuseal-client";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireSessionUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const templateId = Number(id);
  if (!Number.isFinite(templateId) || templateId <= 0) {
    return NextResponse.json({ error: "Invalid template id" }, { status: 400 });
  }
  try {
    const json = await listTemplateDocuments(templateId);
    return NextResponse.json(json);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load documents";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
