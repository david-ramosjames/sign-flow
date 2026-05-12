import { SignJWT, jwtVerify } from "jose";

const COOKIE = "relay_session";

export function getSessionCookieName() {
  return COOKIE;
}

export async function signSessionToken(payload: { sub: string; name: string }, secret: string) {
  const key = new TextEncoder().encode(secret);
  return await new SignJWT({ name: payload.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(key);
}

export async function verifySessionToken(token: string, secret: string) {
  const key = new TextEncoder().encode(secret);
  const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
  return { sub: String(payload.sub ?? ""), name: String((payload as { name?: string }).name ?? "Staff") };
}
