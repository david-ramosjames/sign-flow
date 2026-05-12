"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, startTransition } from "react";
import type { DocumentTemplate, SigningRequest, StaffUser } from "@/types/models";
import { StatusChip } from "@/components/relay/status-chip";

type ApiList = {
  items: SigningRequest[];
  templatesById: Record<string, DocumentTemplate>;
  staffById: Record<string, StaffUser>;
  store: string;
};

function formatChannels(ch: SigningRequest["deliveryChannels"]) {
  const parts: string[] = [];
  if (ch.includes("email")) parts.push("Email");
  if (ch.includes("sms")) parts.push("SMS");
  return parts.join(" · ");
}

export default function DashboardPage() {
  const [data, setData] = useState<ApiList | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const load = async () => {
        const res = await fetch("/api/signing-requests", { credentials: "include" });
        if (!res.ok) {
          if (!cancelled) startTransition(() => setError("Could not load signing requests"));
          return null;
        }
        const json = (await res.json()) as ApiList;
        if (!cancelled) {
          startTransition(() => {
            setError(null);
            setData(json);
          });
        }
        return json;
      };

      const first = await load();
      if (cancelled) return;
      if (first && first.items.length === 0) {
        await fetch("/api/seed", { method: "POST", credentials: "include" });
        await load();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = useMemo(() => data?.items ?? [], [data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Lead signing</h1>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            Send agreements through Adobe. Follow up by SMS when email is not enough.
          </p>
          {data?.store === "mock" ? (
            <p className="mt-2 text-xs text-amber-900">
              Running with in-memory data. Configure Firebase service account env vars or set <code>USE_MOCK_DB=true</code>{" "}
              explicitly for local demos.
            </p>
          ) : null}
        </div>
        <Link
          href="/dashboard/new"
          className="inline-flex items-center justify-center rounded-xl bg-[color:var(--accent)] px-5 py-3 text-sm font-semibold text-white shadow-sm ring-1 ring-black/5 hover:opacity-95"
        >
          Send contract
        </Link>
      </div>

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">{error}</div> : null}

      <div className="overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] shadow-sm">
        <div className="border-b border-[color:var(--border)] px-4 py-3">
          <div className="text-sm font-semibold text-slate-900">Signing requests</div>
          <div className="text-xs text-[color:var(--muted)]">Columns match intake workflow: channels, status, reminders.</div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-4 py-3">Lead</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Document</th>
                <th className="px-4 py-3">Channels</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last sent</th>
                <th className="px-4 py-3">Next reminder</th>
                <th className="px-4 py-3">Assigned</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--border)]">
              {rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-10 text-sm text-slate-600" colSpan={10}>
                    No requests yet. Click <span className="font-medium">Send contract</span> to create one.
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const tpl = data?.templatesById?.[r.documentTemplateId];
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {r.leadFullName}
                        <div className="text-xs font-normal text-slate-500">{r.language === "es" ? "Spanish" : "English"}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{r.phone ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-700">{r.email ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-700">{tpl?.name ?? r.documentTemplateId}</td>
                      <td className="px-4 py-3 text-slate-700">{formatChannels(r.deliveryChannels)}</td>
                      <td className="px-4 py-3">
                        <StatusChip status={r.status} />
                      </td>
                      <td className="px-4 py-3 text-slate-700">{r.lastSentAt ? new Date(r.lastSentAt).toLocaleString() : "—"}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {r.nextReminderAt ? new Date(r.nextReminderAt).toLocaleString() : "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {r.assignedStaffUserId ? data?.staffById?.[r.assignedStaffUserId]?.displayName ?? r.assignedStaffUserId : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Link className="font-medium text-[color:var(--accent)] hover:underline" href={`/dashboard/requests/${r.id}`}>
                          Open
                        </Link>
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
