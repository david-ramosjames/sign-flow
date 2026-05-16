import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { getSessionCookieName } from "@/lib/auth/session";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!pathname.startsWith("/dashboard") && !pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  if (process.env.SIGNFLOW_REQUIRE_AUTH !== "true") {
    return NextResponse.next();
  }

  const sessionCookie = getSessionCookieName();
  const token = req.cookies.get(sessionCookie)?.value;
  const secret = process.env.SIGNFLOW_SESSION_SECRET ?? "dev-insecure-secret-change-me";

  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  try {
    await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ["HS256"] });
    return NextResponse.next();
  } catch {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    const res = NextResponse.redirect(url);
    res.cookies.set(sessionCookie, "", { httpOnly: true, path: "/", maxAge: 0 });
    return res;
  }
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};
