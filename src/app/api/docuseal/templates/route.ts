import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth/get-session";
import { docusealAdminTemplateUrl, ensureHttpUrlBase, listTemplates } from "@/services/docuseal-client";
import type { DocuSealTemplateSummary } from "@/types/models";

export async function GET() {
  try {
    await requireSessionUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const rows = await listTemplates();
    const adminBase = process.env.DOCUSEAL_ADMIN_BASE_URL?.trim();
    const items: DocuSealTemplateSummary[] = rows.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug ?? null,
      archivedAt: t.archived_at ?? null,
      updatedAt: t.updated_at ?? null,
      folderName: t.folder_name ?? null,
      adminUrl:
        docusealAdminTemplateUrl(t.id) ??
        (adminBase ? `${ensureHttpUrlBase(adminBase)}/templates/${t.id}` : null),
    }));
    return NextResponse.json({ items });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load templates";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
