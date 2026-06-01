import { NextResponse } from "next/server";
import { z } from "zod";
import { getSignFlowStore } from "@/lib/db";
import { isFirestoreNotProvisionedError } from "@/lib/db/firestore-errors";
import { requireSessionUser } from "@/lib/auth/get-session";
import { mergeOutboundDelivery } from "@/lib/outbound-delivery";
import { normalizeSigningRequestForDisplay } from "@/lib/signing-request-active";
import { createLeadAndSigningRequest } from "@/server/signing-workflow";

const postSchema = z.object({
  clientName: z.string().min(1),
  phone: z.string().optional().nullable(),
  email: z
    .preprocess((v) => (v === "" || v === null || v === undefined ? undefined : v), z.string().email().optional())
    .optional(),
  language: z.enum(["en", "es"]),
  templateId: z.coerce.number().int().positive(),
  sendSms: z.boolean(),
  sendEmail: z.boolean(),
  reminderEnabled: z.boolean(),
  source: z.string().optional(),
  assignedTo: z.string().optional().nullable(),
});

export async function GET() {
  try {
    await requireSessionUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const store = getSignFlowStore();
  try {
    const items = (await store.listSigningRequests()).map(normalizeSigningRequestForDisplay);
    const leads = await store.listLeads();
    const leadsById = Object.fromEntries(leads.map((l) => [l.id, l]));
    return NextResponse.json({ items, leadsById, store: store.isMock ? "mock" : "firestore" });
  } catch (e) {
    if (isFirestoreNotProvisionedError(e)) {
      return NextResponse.json(
        {
          error: "Firestore returned NOT_FOUND for this project.",
          hint: "Create a Firestore database in the Firebase Console (same project as FIREBASE_PROJECT_ID), set FIRESTORE_DATABASE_ID if you use a non-default database, or set USE_MOCK_DB=true to use in-memory data locally.",
        },
        { status: 503 },
      );
    }
    throw e;
  }
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

  const phone = parsed.data.phone?.trim() || null;
  const email = parsed.data.email?.trim() || null;

  if (parsed.data.sendSms && !phone) {
    return NextResponse.json({ error: "Phone is required when SMS is selected." }, { status: 400 });
  }
  if (parsed.data.sendEmail && !email) {
    return NextResponse.json({ error: "Email is required when email delivery is selected." }, { status: 400 });
  }

  const appSettings = await getSignFlowStore().getAppSettings();
  const outbound = mergeOutboundDelivery(appSettings);
  if (parsed.data.sendSms && !outbound.signingSmsEnabled) {
    return NextResponse.json(
      { error: "SMS for signing requests is disabled in Admin → Messages." },
      { status: 400 },
    );
  }
  if (parsed.data.sendEmail && !outbound.signingEmailEnabled) {
    return NextResponse.json(
      { error: "Email for signing requests is disabled in Admin → Messages." },
      { status: 400 },
    );
  }

  try {
    const { lead, signingRequest } = await createLeadAndSigningRequest(
      {
        clientName: parsed.data.clientName,
        phone,
        email,
        language: parsed.data.language,
        source: parsed.data.source ?? "dashboard",
        templateId: parsed.data.templateId,
        sendSms: parsed.data.sendSms,
        sendEmail: parsed.data.sendEmail,
        reminderEnabled: parsed.data.reminderEnabled,
        assignedTo: parsed.data.assignedTo ?? null,
      },
      actor,
    );
    return NextResponse.json({ item: normalizeSigningRequestForDisplay(signingRequest), lead });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
