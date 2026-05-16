import { NextResponse } from "next/server";
import { getSessionUser, isSignFlowAuthRequired } from "@/lib/auth/get-session";

export async function GET() {
  const authRequired = isSignFlowAuthRequired();
  const u = await getSessionUser();
  if (!u) return NextResponse.json({ user: null, authRequired }, { status: 401 });
  return NextResponse.json({ user: u, authRequired });
}
