import { NextResponse } from "next/server";
import { requireFirmSession } from "@/lib/auth/firm-session";
import { getSignFlowStore } from "@/lib/db";
import { emptyFirmSecrets, pruneSelectableQuoPhoneNumberIds, toFirmPublic } from "@/lib/firms";
import { listQuoPhoneNumbers } from "@/services/quo-service";
import { nowIso } from "@/lib/time";
import type { FirmSecrets, QuoPhoneNumberOption } from "@/types/models";

async function requireAdmin() {
  const session = await requireFirmSession();
  if (!session.isAdmin) throw new Error("Forbidden");
  return session;
}

/** Import Quo phone numbers for a firm using its stored (or env) API key. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
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

  const now = nowIso();
  const existing = (await store.getFirmSecrets(id)) ?? emptyFirmSecrets(id, now);
  const apiKey = existing.quoApiKey?.trim() || process.env.QUO_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Save a Quo API key for this firm (or set QUO_API_KEY in env) before importing numbers." },
      { status: 400 },
    );
  }

  try {
    const listed = await listQuoPhoneNumbers(apiKey);
    const numbers: QuoPhoneNumberOption[] = listed.map((n) => ({
      id: n.id,
      number: n.number,
      name: n.name,
    }));

    const stillValid = (pnId: string | null | undefined) =>
      Boolean(pnId && numbers.some((n) => n.id === pnId));

    let contractDefault = existing.quoDefaultContractPhoneNumberId;
    let generalDefault = existing.quoDefaultGeneralPhoneNumberId;
    if (!stillValid(contractDefault)) contractDefault = numbers[0]?.id ?? null;
    if (!stillValid(generalDefault)) generalDefault = numbers[0]?.id ?? null;

    // Preserve which numbers staff may pick; drop ids Quo no longer returns.
    // New numbers are not auto-enabled — admins opt them in under Firms.
    const selectableIds = pruneSelectableQuoPhoneNumberIds(numbers, existing.quoSelectablePhoneNumberIds);

    // Keep legacy phoneNumberId in sync with general default for older code paths.
    const secrets: FirmSecrets = {
      ...existing,
      firmId: id,
      quoPhoneNumbers: numbers,
      quoSelectablePhoneNumberIds: selectableIds,
      quoDefaultContractPhoneNumberId: contractDefault,
      quoDefaultGeneralPhoneNumberId: generalDefault,
      quoPhoneNumberId: generalDefault ?? existing.quoPhoneNumberId,
      quoFromNumber: numbers.find((n) => n.id === (generalDefault ?? contractDefault))?.number ?? existing.quoFromNumber,
      updatedAt: now,
    };
    await store.upsertFirmSecrets(secrets);

    return NextResponse.json({
      item: await toFirmPublic(firm),
      imported: numbers.length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Import failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
