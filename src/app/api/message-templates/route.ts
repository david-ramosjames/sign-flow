import { NextResponse } from "next/server";
import { z } from "zod";
import { getRelayStore } from "@/lib/db";
import { requireSessionUser } from "@/lib/auth/get-session";
import { nowIso, newId } from "@/lib/time";
import type { MessageTemplate } from "@/types/models";

const postSchema = z.object({
  name: z.string().min(1),
  channel: z.enum(["sms", "email", "both"]),
  language: z.enum(["en", "es"]),
  body: z.string().min(1),
  active: z.boolean().optional(),
});

export async function GET() {
  try {
    await requireSessionUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const store = getRelayStore();
  return NextResponse.json({ items: await store.listMessageTemplates() });
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
  const doc: MessageTemplate = {
    id: newId("msgtpl"),
    name: parsed.data.name.trim(),
    channel: parsed.data.channel,
    language: parsed.data.language,
    body: parsed.data.body,
    active: parsed.data.active ?? true,
    createdAt: t,
    updatedAt: t,
  };
  const store = getRelayStore();
  await store.upsertMessageTemplate(doc);
  return NextResponse.json({ item: doc });
}
