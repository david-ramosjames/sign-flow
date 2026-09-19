import { NextResponse } from "next/server";
import { getSessionCookieName, sessionCookieClearOptions } from "@/lib/auth/session";
import { FIRM_COOKIE } from "@/lib/firm-scope";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  const clear = sessionCookieClearOptions();
  res.cookies.set(getSessionCookieName(), "", clear);
  res.cookies.set(FIRM_COOKIE, "", clear);
  return res;
}
