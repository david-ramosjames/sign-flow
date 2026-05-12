import { NextResponse } from "next/server";
import { z } from "zod";
import { signSessionToken } from "@/lib/auth/session";

const bodySchema = z.object({
  password: z.string().min(1),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const expected = process.env.RELAY_ADMIN_PASSWORD;
  if (!expected) {
    return NextResponse.json(
      { error: "RELAY_ADMIN_PASSWORD is not configured. Add it to your environment to enable login." },
      { status: 500 },
    );
  }

  if (parsed.data.password !== expected) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const secret = process.env.RELAY_SESSION_SECRET ?? "dev-insecure-secret-change-me";
  const token = await signSessionToken({ sub: "relay-staff", name: "Intake Staff" }, secret);

  const res = NextResponse.json({ ok: true });
  res.cookies.set("relay_session", token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 12,
  });
  return res;
}
