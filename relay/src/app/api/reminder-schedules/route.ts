import { NextResponse } from "next/server";
import { z } from "zod";
import { getRelayStore } from "@/lib/db";
import { requireSessionUser } from "@/lib/auth/get-session";
import { nowIso, newId } from "@/lib/time";
import type { ReminderSchedule } from "@/types/models";

const postSchema = z.object({
  name: z.string().min(1),
  active: z.boolean().optional(),
  maxReminders: z.number().int().min(1).max(50).optional(),
  steps: z
    .array(
      z.object({
        id: z.string().optional(),
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
    .min(1),
});

export async function GET() {
  try {
    await requireSessionUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const store = getRelayStore();
  return NextResponse.json({ items: await store.listReminderSchedules() });
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

  const t = nowIso();
  const doc: ReminderSchedule = {
    id: newId("sched"),
    name: parsed.data.name.trim(),
    active: parsed.data.active ?? true,
    steps: parsed.data.steps.map((s) => ({
      id: s.id && s.id.length ? s.id : newId("step"),
      kind: s.kind,
      delayMinutes: s.delayMinutes,
      morningHour: s.morningHour,
      minDelayMinutes: s.minDelayMinutes,
      channel: s.channel,
      messageTemplateId: s.messageTemplateId,
      sendWindowStart: s.sendWindowStart,
      sendWindowEnd: s.sendWindowEnd,
    })),
    maxReminders: parsed.data.maxReminders ?? parsed.data.steps.length,
    createdAt: t,
    updatedAt: t,
  };
  const store = getRelayStore();
  await store.upsertReminderSchedule(doc);
  return NextResponse.json({ item: doc });
}
