import { NextResponse } from "next/server";
import { z } from "zod";
import { getRelayStore } from "@/lib/db";
import { requireSessionUser } from "@/lib/auth/get-session";
import { nowIso } from "@/lib/time";
import type { DocumentTemplate } from "@/types/models";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  adobeLibraryDocumentId: z.string().nullable().optional(),
  adobeWorkflowId: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  matterType: z.string().min(1).optional(),
  language: z.enum(["en", "es"]).optional(),
  requiredFields: z.array(z.string()).optional(),
  active: z.boolean().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireSessionUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const store = getRelayStore();
  const existing = await store.getDocumentTemplate(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const updated: DocumentTemplate = {
    ...existing,
    ...parsed.data,
    description: parsed.data.description ?? existing.description,
    updatedAt: nowIso(),
  };
  await store.upsertDocumentTemplate(updated);
  return NextResponse.json({ item: updated });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireSessionUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const store = getRelayStore();
  const existing = await store.getDocumentTemplate(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await store.deleteDocumentTemplate(id);
  return NextResponse.json({ ok: true });
}
