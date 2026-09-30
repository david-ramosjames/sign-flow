import { NextResponse } from "next/server";
import { isSignFlowAdmin } from "@/lib/auth/is-admin";
import { getSessionUser, isSignFlowAuthRequired } from "@/lib/auth/get-session";
import { firestoreErrorResponse, isFirestoreQuotaExceededError } from "@/lib/db/firestore-errors";
import { defaultFirmRecord } from "@/lib/firm-scope";
import { firmsAccessibleTo, resolveActiveFirm, toFirmPublic } from "@/lib/firms";
import { nowIso } from "@/lib/time";

export async function GET() {
  const authRequired = isSignFlowAuthRequired();
  const u = await getSessionUser();
  if (!u) {
    return NextResponse.json(
      { user: null, authRequired, isAdmin: false, firm: null, firms: [] },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const isAdmin = isSignFlowAdmin(u.email);
    const [firm, accessible] = await Promise.all([
      resolveActiveFirm(u.email, isAdmin),
      firmsAccessibleTo(u.email, isAdmin),
    ]);
    const [firmPublic, firms] = await Promise.all([
      toFirmPublic(firm),
      Promise.all(accessible.map(toFirmPublic)),
    ]);
    return NextResponse.json(
      {
        user: u,
        authRequired,
        isAdmin,
        firm: { id: firmPublic.id, name: firmPublic.name, logoUrl: firmPublic.logoUrl },
        firms: firms.map((f) => ({ id: f.id, name: f.name, logoUrl: f.logoUrl })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    const fs = firestoreErrorResponse(err);
    if (fs && isFirestoreQuotaExceededError(err)) {
      const fallback = defaultFirmRecord(nowIso());
      return NextResponse.json(
        {
          user: u,
          authRequired,
          isAdmin: isSignFlowAdmin(u.email),
          firm: { id: fallback.id, name: fallback.name, logoUrl: fallback.logoUrl },
          firms: [{ id: fallback.id, name: fallback.name, logoUrl: fallback.logoUrl }],
          degraded: true,
          warning: fs.body.error,
          hint: fs.body.hint,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (fs) {
      return NextResponse.json(fs.body, { status: fs.status, headers: { "Cache-Control": "no-store" } });
    }
    throw err;
  }
}
