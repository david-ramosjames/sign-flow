import { timingSafeEqual } from "node:crypto";

/** Server-to-server auth for /api/intake/*: `Authorization: Bearer $SIGNFLOW_INTAKE_TOKEN`. */
export function intakeTokenOk(req: Request): boolean {
  const expected = process.env.SIGNFLOW_INTAKE_TOKEN;
  if (!expected) return false;
  const header = req.headers.get("authorization") ?? "";
  const provided = /^Bearer\s+(.+)$/i.exec(header)?.[1]?.trim() ?? "";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
