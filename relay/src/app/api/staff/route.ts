import { NextResponse } from "next/server";
import { z } from "zod";
import { getRelayStore } from "@/lib/db";
import { requireSessionUser } from "@/lib/auth/get-session";
import { nowIso, newId } from "@/lib/time";
import type { StaffUser } from "@/types/models";

const postSchema = z.object({
  displayName: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["admin", "staff"]).optional(),
  active: z.boolean().optional(),
});

export async function GET() {
  try {
    await requireSessionUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const store = getRelayStore();
  return NextResponse.json({ items: await store.listStaffUsers() });
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
  const doc: StaffUser = {
    id: newId("staff"),
    displayName: parsed.data.displayName.trim(),
    email: parsed.data.email.trim().toLowerCase(),
    role: parsed.data.role ?? "staff",
    active: parsed.data.active ?? true,
    createdAt: t,
    updatedAt: t,
  };
  const store = getRelayStore();
  await store.upsertStaffUser(doc);
  return NextResponse.json({ item: doc });
}
