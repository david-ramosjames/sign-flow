import { NextResponse } from "next/server";
import { z } from "zod";
import { getRelayStore } from "@/lib/db";
import { requireSessionUser } from "@/lib/auth/get-session";
import { createAndSendSigningRequest } from "@/server/signing-request-service";

const postSchema = z.object({
  leadFirstName: z.string().min(1),
  leadLastName: z.string().min(1),
  phone: z.string().optional().nullable(),
  email: z
    .preprocess((v) => (v === "" || v === null || v === undefined ? undefined : v), z.string().email().optional())
    .optional(),
  language: z.enum(["en", "es"]),
  documentTemplateId: z.string().min(1),
  deliveryChannels: z.array(z.enum(["email", "sms"])).min(1),
  staffNotes: z.string().optional().nullable(),
  smsConsentConfirmed: z.boolean(),
  assignedStaffUserId: z.string().optional().nullable(),
});

export async function GET() {
  try {
    await requireSessionUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const store = getRelayStore();
  const items = await store.listSigningRequests();
  const templates = await store.listDocumentTemplates();
  const staff = await store.listStaffUsers();
  const templatesById = Object.fromEntries(templates.map((t) => [t.id, t]));
  const staffById = Object.fromEntries(staff.map((s) => [s.id, s]));
  return NextResponse.json({ items, templatesById, staffById, store: store.isMock ? "mock" : "firestore" });
}

export async function POST(req: Request) {
  let actor: { sub: string; name: string };
  try {
    actor = await requireSessionUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = postSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const email = parsed.data.email ? parsed.data.email.trim() : null;
  const phone = parsed.data.phone ? parsed.data.phone.trim() : null;

  try {
    const created = await createAndSendSigningRequest(
      {
        leadFirstName: parsed.data.leadFirstName,
        leadLastName: parsed.data.leadLastName,
        phone: phone || null,
        email: email || null,
        language: parsed.data.language,
        documentTemplateId: parsed.data.documentTemplateId,
        deliveryChannels: parsed.data.deliveryChannels,
        staffNotes: parsed.data.staffNotes ?? null,
        smsConsentConfirmed: parsed.data.smsConsentConfirmed,
        assignedStaffUserId: parsed.data.assignedStaffUserId ?? null,
      },
      actor,
    );
    return NextResponse.json({ item: created });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
