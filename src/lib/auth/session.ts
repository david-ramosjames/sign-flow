import { SignJWT, jwtVerify } from "jose";

const COOKIE = "signflow_session";

export function getSessionCookieName() {
  return COOKIE;
}

/** Options used when setting the session cookie — clear must match (esp. `secure`). */
export function sessionCookieSetOptions(maxAgeSeconds = 60 * 60 * 12) {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: maxAgeSeconds,
  };
}

export function sessionCookieClearOptions() {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  };
}

export async function signSessionToken(
  payload: { sub: string; name: string; email?: string },
  secret: string,
) {
  const key = new TextEncoder().encode(secret);
  return await new SignJWT({ name: payload.name, email: payload.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(key);
}

export async function verifySessionToken(token: string, secret: string) {
  const key = new TextEncoder().encode(secret);
  const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
  const ext = payload as { name?: string; email?: string };
  return {
    sub: String(payload.sub ?? ""),
    name: String(ext.name ?? "User"),
    email: typeof ext.email === "string" ? ext.email : undefined,
  };
}
