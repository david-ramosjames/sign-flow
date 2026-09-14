import { NextResponse } from "next/server";
import { z } from "zod";
import { requireFirmSession } from "@/lib/auth/firm-session";
import { getSignFlowStore } from "@/lib/db";
import { nowIso } from "@/lib/time";
import { DEFAULT_FIRM_ID, CLEAR_FIRM_SECRET } from "@/lib/firm-scope";
import { emptyFirmSecrets, parseMemberEmails, pruneSelectableQuoPhoneNumberIds, toFirmPublic } from "@/lib/firms";
import type { FirmSecrets } from "@/types/models";

async function requireAdmin() {
  const session = await requireFirmSession();
  if (!session.isAdmin) throw new Error("Forbidden");
  return session;
}

const keep = (incoming: string | null | undefined, current: string | null): string | null => {
  if (incoming == null) return current;
  const t = incoming.trim();
  if (t === CLEAR_FIRM_SECRET) return null;
  if (!t || t === "********") return current;
  return t;
};

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  logoUrl: z.string().optional().nullable(),
  memberEmails: z.string().optional(),
  docusealApiUrl: z.string().optional().nullable(),
  docusealApiKey: z.string().optional().nullable(),
  docusealAdminBaseUrl: z.string().optional().nullable(),
  docusealWebhookSecret: z.string().optional().nullable(),
  quoApiKey: z.string().optional().nullable(),
  quoFromNumber: z.string().optional().nullable(),
  quoPhoneNumberId: z.string().optional().nullable(),
  quoWebhookSecret: z.string().optional().nullable(),
  quoDefaultContractPhoneNumberId: z.string().optional().nullable(),
  quoDefaultGeneralPhoneNumberId: z.string().optional().nullable(),
  quoSelectablePhoneNumberIds: z.array(z.string()).optional().nullable(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unauthorized";
    return NextResponse.json({ error: msg }, { status: msg === "Forbidden" ? 403 : 401 });
  }

  const { id } = await ctx.params;
  const store = getSignFlowStore();
  const firm = await store.getFirm(id);
  if (!firm) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const now = nowIso();
  if (parsed.data.name) firm.name = parsed.data.name.trim();
  if (parsed.data.logoUrl !== undefined) firm.logoUrl = parsed.data.logoUrl?.trim() || null;
  if (parsed.data.memberEmails !== undefined) firm.memberEmails = parseMemberEmails(parsed.data.memberEmails);
  firm.updatedAt = now;
  await store.upsertFirm(firm);

  const existing = (await store.getFirmSecrets(id)) ?? emptyFirmSecrets(id, now);
  const numbers = existing.quoPhoneNumbers ?? [];
  const selectableIds =
    parsed.data.quoSelectablePhoneNumberIds !== undefined
      ? pruneSelectableQuoPhoneNumberIds(numbers, parsed.data.quoSelectablePhoneNumberIds ?? [])
      : pruneSelectableQuoPhoneNumberIds(numbers, existing.quoSelectablePhoneNumberIds);
  const selectableSet =
    selectableIds == null ? null : new Set(selectableIds);
  const inSelectable = (id: string | null) =>
    !id || selectableSet == null || selectableSet.has(id);
  let contractDefault =
    parsed.data.quoDefaultContractPhoneNumberId !== undefined
      ? parsed.data.quoDefaultContractPhoneNumberId?.trim() || null
      : existing.quoDefaultContractPhoneNumberId ?? null;
  let generalDefault =
    parsed.data.quoDefaultGeneralPhoneNumberId !== undefined
      ? parsed.data.quoDefaultGeneralPhoneNumberId?.trim() || null
      : existing.quoDefaultGeneralPhoneNumberId ?? null;
  if (!inSelectable(contractDefault)) contractDefault = selectableIds?.[0] ?? null;
  if (!inSelectable(generalDefault)) generalDefault = selectableIds?.[0] ?? null;
  const primaryId = generalDefault ?? contractDefault;
  const primaryNumber = numbers.find((n) => n.id === primaryId)?.number ?? null;
  const secrets: FirmSecrets = {
    ...existing,
    firmId: id,
    docusealApiUrl: keep(parsed.data.docusealApiUrl, existing.docusealApiUrl),
    docusealApiKey: keep(parsed.data.docusealApiKey, existing.docusealApiKey),
    docusealAdminBaseUrl: keep(parsed.data.docusealAdminBaseUrl, existing.docusealAdminBaseUrl),
    docusealWebhookSecret: keep(parsed.data.docusealWebhookSecret, existing.docusealWebhookSecret),
    quoApiKey: keep(parsed.data.quoApiKey, existing.quoApiKey),
    quoFromNumber:
      parsed.data.quoFromNumber !== undefined
        ? keep(parsed.data.quoFromNumber, existing.quoFromNumber)
        : primaryNumber ?? existing.quoFromNumber,
    quoPhoneNumberId:
      parsed.data.quoPhoneNumberId !== undefined
        ? keep(parsed.data.quoPhoneNumberId, existing.quoPhoneNumberId)
        : primaryId ?? existing.quoPhoneNumberId,
    quoPhoneNumbers: existing.quoPhoneNumbers ?? null,
    quoSelectablePhoneNumberIds: selectableIds,
    quoDefaultContractPhoneNumberId: contractDefault,
    quoDefaultGeneralPhoneNumberId: generalDefault,
    quoWebhookSecret: keep(parsed.data.quoWebhookSecret, existing.quoWebhookSecret ?? null),
    updatedAt: now,
  };
  await store.upsertFirmSecrets(secrets);

  return NextResponse.json({ item: await toFirmPublic(firm) });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unauthorized";
    return NextResponse.json({ error: msg }, { status: msg === "Forbidden" ? 403 : 401 });
  }
  const { id } = await ctx.params;
  if (id === DEFAULT_FIRM_ID) {
    return NextResponse.json({ error: "The default firm cannot be deleted." }, { status: 400 });
  }
  const store = getSignFlowStore();
  const firm = await store.getFirm(id);
  if (!firm) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await store.deleteFirm(id);
  return NextResponse.json({ ok: true });
}
