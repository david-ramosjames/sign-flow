"use client";

import Link from "next/link";
import { useEffect, useState, startTransition } from "react";
import { format } from "date-fns";
import type { Lead, SigningRequest } from "@/types/models";

export default function SignedDocumentsPage() {
  const [items, setItems] = useState<SigningRequest[]>([]);
  const [leadsById, setLeadsById] = useState<Record<string, Lead>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/signing-requests", { credentials: "include" });
      if (!res.ok) {
        if (!cancelled) startTransition(() => setError("Could not load data"));
        return;
      }
      const json = (await res.json()) as { items: SigningRequest[]; leadsById: Record<string, Lead> };
      if (cancelled) return;
      const done = json.items.filter((r) => r.status === "completed");
      startTransition(() => {
        setItems(done);
        setLeadsById(json.leadsById);
        setError(null);
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Signed documents</h1>
        <p className="mt-1 text-sm text-[color:var(--muted)]">
          Completed DocuSeal submissions with links to signed PDFs, audit certificates, and Dropbox archive paths.
        </p>
      </div>

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</div> : null}

      <div className="overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] shadow-sm">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Template</th>
              <th className="px-4 py-3">Completed</th>
              <th className="px-4 py-3">Signed PDF</th>
              <th className="px-4 py-3">Audit</th>
              <th className="px-4 py-3">Dropbox</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-600">
                  No completed signings yet.
                </td>
              </tr>
            ) : (
              items.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <Link className="font-medium text-[color:var(--accent)] hover:underline" href={`/dashboard/requests/${r.id}`}>
                      {r.clientName}
                    </Link>
                    {(() => {
                      const src = leadsById[r.leadId]?.source;
                      return src && src !== "dashboard" ? (
                        <div className="text-xs text-slate-500">{src}</div>
                      ) : null;
                    })()}
                  </td>
                  <td className="px-4 py-3">{r.templateName}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {r.completedAt ? format(new Date(r.completedAt), "MMM d, yyyy h:mm a") : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {r.signedPdfUrl ? (
                      <a className="text-sky-700 hover:underline" href={r.signedPdfUrl} target="_blank" rel="noreferrer">
                        DocuSeal
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {r.auditCertificateUrl ? (
                      <a className="text-sky-700 hover:underline" href={r.auditCertificateUrl} target="_blank" rel="noreferrer">
                        Certificate
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {r.dropboxSignedPdfLink ? (
                      <a className="text-emerald-700 hover:underline" href={r.dropboxSignedPdfLink} target="_blank" rel="noreferrer">
                        Open link
                      </a>
                    ) : r.dropboxSignedPdfPath ? (
                      <code className="text-[11px]">{r.dropboxSignedPdfPath}</code>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <RequestActions id={r.id} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RequestActions({ id }: { id: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        className="text-left text-[color:var(--accent)] hover:underline"
        onClick={async () => {
          setMsg(null);
          const res = await fetch(`/api/signing-requests/${id}/sync-dropbox`, { method: "POST", credentials: "include" });
          setMsg(res.ok ? "Dropbox sync queued." : "Sync failed");
        }}
      >
        Re-sync Dropbox
      </button>
      {msg ? <span className="text-[10px] text-slate-500">{msg}</span> : null}
    </div>
  );
}
