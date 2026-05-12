import { NextResponse } from "next/server";
import { z } from "zod";
import { getRelayStore } from "@/lib/db";
import { requireSessionUser } from "@/lib/auth/get-session";
import { nowIso, newId } from "@/lib/time";
import type { DocumentTemplate } from "@/types/models";

const postSchema = z.object({
  name: z.string().min(1),
  adobeLibraryDocumentId: z.string().optional().nullable(),
  adobeWorkflowId: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  matterType: z.string().min(1),
  language: z.enum(["en", "es"]),
  requiredFields: z.array(z.string()).optional(),
  active: z.boolean().optional(),
});

export async function GET() {
  try {
    await requireSessionUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const store = getRelayStore();
  return NextResponse.json({ items: await store.listDocumentTemplates() });
}

export async function POST(req: Request) {
  try {
    await requireSessionUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const json = await req.json().catch(() => null);
  const parsed = postSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const store = getRelayStore();
  const t = nowIso();
  const doc: DocumentTemplate = {
    id: newId("tpl"),
    name: parsed.data.name.trim(),
    adobeLibraryDocumentId: parsed.data.adobeLibraryDocumentId?.trim() || null,
    adobeWorkflowId: parsed.data.adobeWorkflowId?.trim() || null,
    description: (parsed.data.description ?? "").trim(),
    matterType: parsed.data.matterType.trim(),
    language: parsed.data.language,
    requiredFields: parsed.data.requiredFields ?? [],
    active: parsed.data.active ?? true,
    createdAt: t,
    updatedAt: t,
  };
  await store.upsertDocumentTemplate(doc);
  return NextResponse.json({ item: doc });
}
