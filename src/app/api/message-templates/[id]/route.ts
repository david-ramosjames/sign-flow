import { NextResponse } from "next/server";
import { z } from "zod";
import { getRelayStore } from "@/lib/db";
import { requireSessionUser } from "@/lib/auth/get-session";
import { nowIso } from "@/lib/time";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  channel: z.enum(["sms", "email", "both"]).optional(),
  language: z.enum(["en", "es"]).optional(),
  body: z.string().min(1).optional(),
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
  const existing = await store.getMessageTemplate(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const updated = { ...existing, ...parsed.data, updatedAt: nowIso() };
  await store.upsertMessageTemplate(updated);
  return NextResponse.json({ item: updated });
}
