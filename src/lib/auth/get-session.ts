import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/auth/session";

/** When not `true`, dashboard/API run without a login gate (useful for local demos). */
export function isSignFlowAuthRequired(): boolean {
  return process.env.SIGNFLOW_REQUIRE_AUTH === "true";
}

const LOCAL_ACTOR = { sub: "signflow-local", name: "Intake Staff" } as const;

export type SessionUser = { sub: string; name: string; email?: string };

export async function getSessionUser(): Promise<SessionUser | null> {
  if (!isSignFlowAuthRequired()) {
    return { ...LOCAL_ACTOR };
  }

  const secret = process.env.SIGNFLOW_SESSION_SECRET ?? "dev-insecure-secret-change-me";
  const token = (await cookies()).get("signflow_session")?.value;
  if (!token) return null;
  try {
    return await verifySessionToken(token, secret);
  } catch {
    return null;
  }
}

export async function requireSessionUser(): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) throw new Error("Unauthorized");
  return u;
}
