"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, startTransition } from "react";
import { endOfDay, format, isValid, parse, startOfDay } from "date-fns";
import type { Lead, OutboundDeliverySettings, SigningRequest, SigningStatus } from "@/types/models";
import { DEFAULT_OUTBOUND_DELIVERY } from "@/lib/outbound-delivery";
import { postSigningResend } from "@/lib/post-signing-resend";
import { StatusChip } from "@/components/sign-flow/status-chip";

type ApiList = {
  items: SigningRequest[];
  leadsById: Record<string, Lead>;
};

type DateField = "sent" | "created" | "activity";

function parseYmdLocal(s: string): Date | null {
  const t = parse(s.trim(), "yyyy-MM-dd", new Date());
  return isValid(t) ? t : null;
}

function requestDateForField(r: SigningRequest, field: DateField): Date | null {
  const iso = field === "sent" ? r.sentAt : field === "created" ? r.createdAt : r.lastActivityAt;
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function matchesDateRange(r: SigningRequest, field: DateField, dateFrom: string, dateTo: string): boolean {
  const fromS = dateFrom.trim();
  const toS = dateTo.trim();
  if (!fromS && !toS) return true;
  const d = requestDateForField(r, field);
  if (!d) return false;
  if (fromS) {
    const from = parseYmdLocal(fromS);
    if (from && d < startOfDay(from)) return false;
  }
  if (toS) {
    const to = parseYmdLocal(toS);
    if (to && d > endOfDay(to)) return false;
  }
  return true;
}

const STATUS_FILTERS: { id: string; label: string; match: (r: SigningRequest) => boolean }[] = [
  { id: "all", label: "All", match: () => true },
  {
    id: "followup",
    label: "Needs follow-up",
    match: (r) =>
      r.manualFollowUp ||
      (r.reminderEnabled &&
        r.status !== "completed" &&
        r.status !== "expired" &&
        r.status !== "failed" &&
        r.status !== "cancelled"),
  },
  { id: "sent", label: "Sent", match: (r) => r.status === "sent" || r.status === "viewed" },
  { id: "signed", label: "Completed", match: (r) => r.status === "completed" },
  { id: "failed", label: "Failed / expired", match: (r) => r.status === "failed" || r.status === "expired" },
  { id: "cancelled", label: "Cancelled", match: (r) => r.status === "cancelled" },
];

export default function DashboardPage() {
  const [data, setData] = useState<ApiList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [lang, setLang] = useState<"all" | "en" | "es">("all");
  const [templateId, setTemplateId] = useState<string>("all");
  const [nameSearch, setNameSearch] = useState("");
  const [dateField, setDateField] = useState<DateField>("sent");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [templateCatalog, setTemplateCatalog] = useState<{ id: number; name: string }[]>([]);
  const [resendBusy, setResendBusy] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ text: string; ok: boolean } | null>(null);
  const [outbound, setOutbound] = useState<OutboundDeliverySettings>(DEFAULT_OUTBOUND_DELIVERY);

  const load = useCallback(async () => {
    const res = await fetch("/api/signing-requests", { credentials: "include" });
    if (!res.ok) {
      let msg = "Could not load signing requests";
      try {
        const j = (await res.json()) as { error?: string; hint?: string };
        if (j.hint) msg = `${j.error ?? msg}\n\n${j.hint}`;
        else if (j.error) msg = j.error;
      } catch {
        /* ignore */
      }
      startTransition(() => setError(msg));
      return;
    }
    const json = (await res.json()) as ApiList;
    startTransition(() => {
      setError(null);
      setData(json);
    });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/app-settings", { credentials: "include" });
      if (!res.ok) return;
      const j = (await res.json()) as { item?: { outboundDelivery?: OutboundDeliverySettings } | null };
      startTransition(() =>
        setOutbound({ ...DEFAULT_OUTBOUND_DELIVERY, ...(j.item?.outboundDelivery ?? {}) }),
      );
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/docuseal/templates", { credentials: "include" });
      if (!res.ok) return;
      const j = (await res.json()) as { items: { id: number; name: string; archivedAt: string | null }[] };
      const rows = (j.items ?? [])
        .filter((t) => !t.archivedAt)
        .map((t) => ({ id: t.id, name: t.name }));
      startTransition(() => setTemplateCatalog(rows));
    })();
  }, []);

  const templates = useMemo(() => {
    const m = new Map<number, string>();
    for (const t of templateCatalog) m.set(t.id, t.name);
    for (const r of data?.items ?? []) {
      if (!m.has(r.templateId)) m.set(r.templateId, r.templateName);
    }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [data, templateCatalog]);

  const rows = useMemo(() => {
    const items = data?.items ?? [];
    const sf = STATUS_FILTERS.find((f) => f.id === statusFilter)?.match ?? (() => true);
    const q = nameSearch.trim().toLowerCase();
    return items.filter((r) => {
      if (!sf(r)) return false;
      if (lang !== "all" && r.language !== lang) return false;
      if (templateId !== "all" && String(r.templateId) !== templateId) return false;
      if (q) {
        const name = r.clientName.toLowerCase();
        const email = (r.email ?? "").toLowerCase();
        if (!name.includes(q) && !email.includes(q)) return false;
      }
      if (!matchesDateRange(r, dateField, dateFrom, dateTo)) return false;
      return true;
    });
  }, [data, statusFilter, lang, templateId, nameSearch, dateField, dateFrom, dateTo]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Signing requests</h1>
          <p className="mt-1 max-w-2xl text-sm text-[color:var(--muted)]">
            Track DocuSeal submissions, delivery channels, reminders, and Dropbox archive status.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/send"
            className="rounded-xl bg-[color:var(--accent)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-95"
          >
            Send signing request
          </Link>
          <button
            type="button"
            onClick={() => load()}
            className="rounded-xl border border-[color:var(--border)] bg-white px-4 py-2.5 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 whitespace-pre-wrap">{error}</div>
      ) : null}

      {actionFeedback ? (
        <div
          className={`rounded-xl border p-3 text-sm ${
            actionFeedback.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-rose-200 bg-rose-50 text-rose-900 whitespace-pre-wrap"
          }`}
        >
          {actionFeedback.text}
        </div>
      ) : null}

      <div className="flex flex-col gap-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                  statusFilter === f.id ? "bg-[color:var(--brand-navy)] text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="text-xs font-medium text-slate-600 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
            onClick={() => {
              setStatusFilter("all");
              setLang("all");
              setTemplateId("all");
              setNameSearch("");
              setDateField("sent");
              setDateFrom("");
              setDateTo("");
            }}
          >
            Clear filters
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <label className="flex min-w-0 flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">Search</span>
            <input
              type="search"
              placeholder="Client name or email"
              value={nameSearch}
              onChange={(e) => setNameSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">Date field</span>
            <select
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              value={dateField}
              onChange={(e) => setDateField(e.target.value as DateField)}
            >
              <option value="sent">Sent</option>
              <option value="created">Created</option>
              <option value="activity">Last activity</option>
            </select>
          </label>
          <label className="flex min-w-0 flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">From</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">To</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">Language</span>
            <select
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              value={lang}
              onChange={(e) => setLang(e.target.value as "all" | "en" | "es")}
            >
              <option value="all">All languages</option>
              <option value="en">English</option>
              <option value="es">Spanish</option>
            </select>
          </label>
          <label className="flex min-w-0 flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">Template</span>
            <select
              className="w-full max-w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
            >
              <option value="all">All templates</option>
              {templates.map(([id, name]) => (
                <option key={id} value={String(id)}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1040px] w-full border-collapse text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Template</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Delivery</th>
                <th className="px-4 py-3">Last activity</th>
                <th className="px-4 py-3">Next reminder</th>
                <th className="px-4 py-3">Documents</th>
                <th className="px-4 py-3">Dropbox</th>
                <th className="px-4 py-3">Retry send</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-slate-600">
                    {data?.items?.length ? "No requests match these filters." : "No signing requests yet."}
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const lead = data?.leadsById?.[r.leadId];
                  const canResend = Boolean(r.signingUrl) && r.status !== "cancelled";
                  const smsOk = canResend && Boolean(r.phone?.trim()) && outbound.signingSmsEnabled;
                  const emailOk = canResend && Boolean(r.email?.trim()) && outbound.signingEmailEnabled;
                  const showResend = canResend && (outbound.signingSmsEnabled || outbound.signingEmailEnabled);
                  return (
                    <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <Link href={`/dashboard/requests/${r.id}`} className="font-medium text-[color:var(--accent)] hover:underline">
                          {r.clientName}
                        </Link>
                        <div className="text-xs text-slate-500">{lead?.source ?? "—"}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-800">
                        <div className="font-medium">{r.templateName}</div>
                        <div className="text-xs text-slate-500">ID {r.templateId}</div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusChip status={r.status as SigningStatus} />
                        {r.manualFollowUp ? (
                          <div className="mt-1 text-[10px] font-semibold uppercase text-amber-700">Follow-up</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-700">
                        {r.sentViaSms ? <div>SMS</div> : null}
                        {r.sentViaEmail ? <div>Email</div> : null}
                        {!r.sentViaSms && !r.sentViaEmail ? "—" : null}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {r.lastActivityAt ? format(new Date(r.lastActivityAt), "MMM d, h:mm a") : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {r.nextReminderAt ? format(new Date(r.nextReminderAt), "MMM d, h:mm a") : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {r.signingUrl ? (
                          <a className="text-sky-700 hover:underline" href={r.signingUrl} target="_blank" rel="noreferrer">
                            Open link
                          </a>
                        ) : (
                          "—"
                        )}
                        {r.signedPdfUrl ? (
                          <div className="mt-1">
                            <a className="text-emerald-700 hover:underline" href={r.signedPdfUrl} target="_blank" rel="noreferrer">
                              Signed PDF
                            </a>
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {r.dropboxSignedPdfPath ? (
                          <span className="text-emerald-700">Archived</span>
                        ) : r.status === "completed" ? (
                          <span className="text-amber-700">Pending</span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        {!showResend ? (
                          <span className="text-xs text-slate-400">—</span>
                        ) : (
                          <div className="flex flex-col gap-1.5">
                            <button
                              type="button"
                              disabled={!smsOk || resendBusy !== null}
                              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-left text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                              onClick={async () => {
                                setActionFeedback(null);
                                setResendBusy(`${r.id}:sms`);
                                const out = await postSigningResend(r.id, { sms: true, email: false });
                                setResendBusy(null);
                                setActionFeedback(
                                  out.ok
                                    ? { ok: true, text: `SMS resent for ${r.clientName}.` }
                                    : { ok: false, text: out.error },
                                );
                                if (out.ok) void load();
                              }}
                            >
                              {resendBusy === `${r.id}:sms` ? "Sending…" : "SMS"}
                            </button>
                            <button
                              type="button"
                              disabled={!emailOk || resendBusy !== null}
                              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-left text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                              onClick={async () => {
                                setActionFeedback(null);
                                setResendBusy(`${r.id}:email`);
                                const out = await postSigningResend(r.id, { sms: false, email: true });
                                setResendBusy(null);
                                setActionFeedback(
                                  out.ok
                                    ? { ok: true, text: `Email resent for ${r.clientName}.` }
                                    : { ok: false, text: out.error },
                                );
                                if (out.ok) void load();
                              }}
                            >
                              {resendBusy === `${r.id}:email` ? "Sending…" : "Email"}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
