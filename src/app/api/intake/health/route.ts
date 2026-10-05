// Connection check for intake systems: confirms the token works and lists firms (with which
// integrations are configured) plus which server env vars are set. Never returns secret values.

import { NextResponse } from "next/server";
import { intakeTokenOk } from "@/lib/auth/intake-token";
import { listAllFirms, toFirmPublic } from "@/lib/firms";

export const dynamic = "force-dynamic";

const ENV_KEYS = [
  "DOCUSEAL_API_URL",
  "DOCUSEAL_API_KEY",
  "DOCUSEAL_WEBHOOK_SECRET",
  "QUO_API_KEY",
  "GMAIL_SERVICE_ACCOUNT_EMAIL",
  "SENDGRID_API_KEY",
  "SIGNFLOW_EMAIL_PUBLIC_ORIGIN",
  "CRON_SECRET",
] as const;

export async function GET(req: Request) {
  if (!intakeTokenOk(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const firms = await Promise.all((await listAllFirms()).map(toFirmPublic));
  return NextResponse.json({
    ok: true,
    firms: firms.map((f) => {
      const { memberEmails: _omit, ...rest } = f;
      return rest;
    }),
    env: Object.fromEntries(ENV_KEYS.map((k) => [k, Boolean(process.env[k]?.trim())])),
  });
}
