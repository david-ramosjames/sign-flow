import { NextResponse } from "next/server";
import { z } from "zod";
import { getRelayStore } from "@/lib/db";
import { requireSessionUser } from "@/lib/auth/get-session";
import { nowIso } from "@/lib/time";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  active: z.boolean().optional(),
  maxReminders: z.number().int().min(1).max(50).optional(),
  steps: z
    .array(
      z.object({
        id: z.string(),
        kind: z.enum(["relative_minutes", "next_local_morning"]),
        delayMinutes: z.number().optional(),
        morningHour: z.number().optional(),
        minDelayMinutes: z.number().optional(),
        channel: z.enum(["sms", "email", "both"]),
        messageTemplateId: z.string().optional(),
        sendWindowStart: z.string().optional(),
        sendWindowEnd: z.string().optional(),
      }),
    )
    .optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireSessionUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const store = getRelayStore();
  const existing = await store.getReminderSchedule(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const updated = { ...existing, ...parsed.data, updatedAt: nowIso() };
  await store.upsertReminderSchedule(updated);
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
  const existing = await store.getReminderSchedule(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await store.deleteReminderSchedule(id);
  return NextResponse.json({ ok: true });
}
