// Template name + document download URLs, so an intake system can read the agreement's
// contents (server-to-server, bearer token).

import { NextResponse } from "next/server";
import { intakeTokenOk } from "@/lib/auth/intake-token";
import { DEFAULT_FIRM_ID } from "@/lib/firm-scope";
import { getFirmDocusealConnection } from "@/lib/firms";
import { getTemplateJson } from "@/services/docuseal-client";

export const dynamic = "force-dynamic";

type TemplateJson = {
  id?: number;
  name?: string;
  documents?: Array<{ filename?: string; url?: string }>;
};

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!intakeTokenOk(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const templateId = Number(id);
  if (!Number.isInteger(templateId) || templateId <= 0) {
    return NextResponse.json({ error: "Invalid template id" }, { status: 400 });
  }
  const firmId = new URL(req.url).searchParams.get("firmId")?.trim() || DEFAULT_FIRM_ID;
  try {
    const t = (await getTemplateJson(templateId, await getFirmDocusealConnection(firmId))) as TemplateJson;
    return NextResponse.json({
      ok: true,
      id: t.id ?? templateId,
      name: t.name ?? "",
      documents: (t.documents ?? [])
        .filter((d) => typeof d.url === "string" && d.url)
        .map((d) => ({ filename: d.filename ?? "document.pdf", url: d.url as string })),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to load template" }, { status: 502 });
  }
}
