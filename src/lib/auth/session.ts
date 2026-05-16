import { SignJWT, jwtVerify } from "jose";

const COOKIE = "signflow_session";

export function getSessionCookieName() {
  return COOKIE;
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
