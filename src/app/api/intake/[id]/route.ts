// Signing status for a request created via POST /api/intake (server-to-server, bearer token).
// Checks DocuSeal directly when not yet completed, so callers don't depend on webhook timing.

import { NextResponse } from "next/server";
import { intakeTokenOk } from "@/lib/auth/intake-token";
import { getSignFlowStore } from "@/lib/db";
import { isCancelledSigningRequest } from "@/lib/signing-request-active";
import { syncSigningRequestFromDocuseal } from "@/server/signing-workflow";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!intakeTokenOk(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const store = getSignFlowStore();
  let item = await store.getSigningRequest(id);
  if (!item || !item.externalRef) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!isCancelledSigningRequest(item) && (item.status === "sent" || item.status === "viewed")) {
    try {
      item = await syncSigningRequestFromDocuseal(id);
    } catch {
      // Not completed yet (or DocuSeal unreachable): report what we have.
    }
  }

  const signed = item.status === "completed" || item.status === "signed";
  return NextResponse.json({
    ok: true,
    id: item.id,
    externalRef: item.externalRef,
    status: isCancelledSigningRequest(item) ? "cancelled" : item.status,
    viewed: signed || item.status === "viewed",
    signed,
    completedAt: item.completedAt,
    sentViaSms: item.sentViaSms,
    sentViaEmail: item.sentViaEmail,
  });
}
