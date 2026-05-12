import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/auth/session";

/** When not `true`, dashboard/API run without a login gate (re-enable for production). */
export function isRelayAuthRequired(): boolean {
  return process.env.RELAY_REQUIRE_AUTH === "true";
}

const LOCAL_ACTOR = { sub: "relay-local", name: "Intake Staff" } as const;

export async function getSessionUser(): Promise<{ sub: string; name: string } | null> {
  if (!isRelayAuthRequired()) {
    return { ...LOCAL_ACTOR };
  }

  const secret = process.env.RELAY_SESSION_SECRET ?? "dev-insecure-secret-change-me";
  const token = (await cookies()).get("relay_session")?.value;
  if (!token) return null;
  try {
    return await verifySessionToken(token, secret);
  } catch {
    return null;
  }
}

export async function requireSessionUser(): Promise<{ sub: string; name: string }> {
  const u = await getSessionUser();
  if (!u) throw new Error("Unauthorized");
  return u;
}
