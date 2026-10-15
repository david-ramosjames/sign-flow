import type { SigningRequest } from "@/types/models";

// Sign Flow stays on Firestore. When a contract is sent, reminded, or signed,
// the same phone is updated on the shared Docket lead so Intake Manager can
// show it. No-op until LEADS_SUPABASE_URL and LEADS_SUPABASE_SERVICE_ROLE_KEY
// are set on this service. Those are the Docket project, not a Firebase key.

type LeadRow = {
  id: string;
  signed_case: boolean;
  lead_status: string;
  agreement_status: string | null;
  agreement_sent_at: string | null;
  agreement_reminder_count: number | null;
  agreement_next_reminder_at: string | null;
  agreement_via_sms: boolean | null;
  agreement_via_email: boolean | null;
};

function deliveryFlags(req: SigningRequest): { sms: boolean; email: boolean } {
  if (req.sentViaSms || req.sentViaEmail) {
    return { sms: Boolean(req.sentViaSms), email: Boolean(req.sentViaEmail) };
  }
  if (!req.reminderEnabled) return { sms: false, email: false };
  return { sms: Boolean(req.phone?.trim()), email: Boolean(req.email) };
}

let backfilled = false;

export function leadsSyncConfigured(): boolean {
  return Boolean(process.env.LEADS_SUPABASE_URL && process.env.LEADS_SUPABASE_SERVICE_ROLE_KEY);
}

function toE164(phone: string | null | undefined): string | null {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

function isContract(req: SigningRequest): boolean {
  if (req.formKind === "hipaa" || req.formKind === "sar" || req.formKind === "disbursement") return false;
  if (req.formKind === "contract") return true;
  return /contract|retainer|contingency/i.test(req.templateName || "");
}

function sameInstant(left: string | null | undefined, right: string | null | undefined): boolean {
  if (!left && !right) return true;
  if (!left || !right) return false;
  const a = Date.parse(left);
  const b = Date.parse(right);
  if (Number.isNaN(a) || Number.isNaN(b)) return left === right;
  return a === b;
}

function baseUrl(): string {
  return String(process.env.LEADS_SUPABASE_URL || "").replace(/\/$/, "");
}

async function rest(path: string, init?: RequestInit): Promise<Response> {
  const key = process.env.LEADS_SUPABASE_SERVICE_ROLE_KEY || "";
  return fetch(`${baseUrl()}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

async function findLead(phone: string): Promise<LeadRow | null> {
  const response = await rest(
    `leads?phone_e164=eq.${encodeURIComponent(phone)}&select=id,signed_case,lead_status,agreement_status,agreement_sent_at,agreement_reminder_count,agreement_next_reminder_at,agreement_via_sms,agreement_via_email&order=created_at.desc&limit=8`,
  );
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Lead lookup failed (${response.status}): ${detail.slice(0, 180)}`);
  }
  const rows = (await response.json()) as LeadRow[];
  if (!rows.length) return null;
  const open = rows.find(
    (row) =>
      !row.signed_case &&
      !["Lost", "Referred", "Promoted", "Signed"].includes(row.lead_status),
  );
  return open ?? rows[0];
}

export async function syncSigningRequestToLead(req: SigningRequest): Promise<void> {
  if (!leadsSyncConfigured() || !isContract(req)) return;
  const meaningful = Boolean(req.sentAt) || req.status === "signed" || req.status === "completed";
  if (!meaningful) return;
  const phone = toE164(req.phone);
  if (!phone) return;

  const lead = await findLead(phone);
  if (!lead) return;

  const incomingSent = req.sentAt;
  const storedSent = lead.agreement_sent_at;
  const incomingIsOlder =
    Boolean(storedSent && incomingSent && Date.parse(storedSent) > Date.parse(incomingSent));
  const incomingSigned = req.status === "signed" || req.status === "completed";
  if (incomingIsOlder && !incomingSigned) return;

  const nextStatus = req.status;
  const nextCount = req.reminderCount ?? 0;
  const nextReminder = req.nextReminderAt;
  const via = deliveryFlags(req);
  const unchanged =
    lead.agreement_status === nextStatus &&
    (lead.agreement_reminder_count ?? 0) === nextCount &&
    sameInstant(lead.agreement_next_reminder_at, nextReminder) &&
    sameInstant(lead.agreement_sent_at, incomingSent) &&
    lead.agreement_via_sms === via.sms &&
    lead.agreement_via_email === via.email &&
    (!incomingSigned || lead.signed_case);

  if (unchanged) return;

  const patch: Record<string, unknown> = {};
  if (!incomingIsOlder) {
    patch.agreement_status = nextStatus;
    patch.agreement_sent_at = incomingSent;
    patch.agreement_last_reminder_at = req.lastReminderAt;
    patch.agreement_next_reminder_at = nextReminder;
    patch.agreement_reminder_count = nextCount;
    patch.agreement_signing_url = req.signingUrl;
    patch.agreement_via_sms = via.sms;
    patch.agreement_via_email = via.email;
  }
  if (incomingSigned && !lead.signed_case) {
    patch.signed_case = true;
    patch.signed_at = req.completedAt || req.updatedAt;
    patch.follow_up = false;
    patch.form_fill_closed_at = req.completedAt || req.updatedAt;
    if (lead.lead_status !== "Promoted") patch.lead_status = "Signed";
    const signedOn = req.completedAt || req.updatedAt;
    if (signedOn) patch.date_signed = signedOn.slice(0, 10);
  }
  if (!Object.keys(patch).length) return;

  const saved = await rest(`leads?id=eq.${lead.id}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(patch),
  });
  if (!saved.ok) {
    const detail = await saved.text();
    throw new Error(`Lead update failed (${saved.status}): ${detail.slice(0, 180)}`);
  }

  const eventType = incomingSigned
    ? "agreement_signed"
    : nextCount > (lead.agreement_reminder_count ?? 0)
      ? "agreement_reminder"
      : "agreement_sent";
  const noted = await rest("lead_events", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      lead_id: lead.id,
      event_type: eventType,
      actor: "sign-flow",
      payload: {
        signing_request_id: req.id,
        status: nextStatus,
        reminder_count: nextCount,
        next_reminder_at: nextReminder,
        last_reminder_at: req.lastReminderAt,
        via_sms: via.sms,
        via_email: via.email,
      },
    }),
  });
  if (!noted.ok) {
    const detail = await noted.text();
    console.error(`[lead-sync] Event was not saved (${noted.status}): ${detail.slice(0, 180)}`);
  }

  if (incomingSigned && !lead.signed_case) {
    await rest(`lead_jobs?lead_id=eq.${lead.id}&status=eq.pending`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        status: "skipped",
        detail: "Client signed in Sign Flow.",
      }),
    });
  }
}

export async function syncContractSignals(requests: SigningRequest[]): Promise<void> {
  if (!leadsSyncConfigured() || backfilled) return;
  backfilled = true;
  const contracts = requests
    .filter((req) => isContract(req) && (req.sentAt || req.status === "signed" || req.status === "completed"))
    .sort((a, b) => String(a.updatedAt || "").localeCompare(String(b.updatedAt || "")));
  let mirrored = 0;
  for (const req of contracts) {
    try {
      await syncSigningRequestToLead(req);
      mirrored += 1;
    } catch (error) {
      console.error("[lead-sync] Could not mirror a contract", req.id, error instanceof Error ? error.message : error);
    }
  }
  if (mirrored) console.log(`[lead-sync] Checked ${mirrored} contract requests against the lead table`);
}
