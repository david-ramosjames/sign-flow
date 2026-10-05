// Active DocuSeal templates for a firm, so intake systems can pick which agreement to send
// (server-to-server, bearer token).

import { NextResponse } from "next/server";
import { intakeTokenOk } from "@/lib/auth/intake-token";
import { DEFAULT_FIRM_ID } from "@/lib/firm-scope";
import { getFirmDocusealConnection } from "@/lib/firms";
import { listTemplates } from "@/services/docuseal-client";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!intakeTokenOk(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const firmId = new URL(req.url).searchParams.get("firmId")?.trim() || DEFAULT_FIRM_ID;
  try {
    const rows = await listTemplates(await getFirmDocusealConnection(firmId));
    return NextResponse.json({
      ok: true,
      templates: rows
        .filter((t) => !t.archived_at)
        .map((t) => ({ id: t.id, name: t.name, folder: t.folder_name ?? null })),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to list templates" }, { status: 502 });
  }
}
