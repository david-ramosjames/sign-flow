"use client";

import { useEffect, useState, startTransition } from "react";
import type { DocumentTemplate } from "@/types/models";

export default function AdminTemplatesPage() {
  const [items, setItems] = useState<DocumentTemplate[]>([]);
  const [name, setName] = useState("");
  const [matter, setMatter] = useState("Retainer");
  const [libId, setLibId] = useState("");
  const [wfId, setWfId] = useState("");
  const [desc, setDesc] = useState("");

  async function refresh() {
    const res = await fetch("/api/document-templates", { credentials: "include" });
    if (res.ok) {
      const j = (await res.json()) as { items: DocumentTemplate[] };
      startTransition(() => setItems(j.items));
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Document templates</h1>
        <p className="mt-1 text-sm text-[color:var(--muted)]">Map retainer and related agreements to Adobe library document IDs or workflow IDs.</p>
      </div>

      <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6 shadow-sm">
        <div className="text-sm font-semibold text-slate-900">Add template</div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Matter type" value={matter} onChange={(e) => setMatter(e.target.value)} />
          <input
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm sm:col-span-2"
            placeholder="Adobe library document ID"
            value={libId}
            onChange={(e) => setLibId(e.target.value)}
          />
          <input
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm sm:col-span-2"
            placeholder="Adobe workflow ID (optional)"
            value={wfId}
            onChange={(e) => setWfId(e.target.value)}
          />
          <textarea className="min-h-[70px] rounded-xl border border-slate-200 px-3 py-2 text-sm sm:col-span-2" placeholder="Description" value={desc} onChange={(e) => setDesc(e.target.value)} />
        </div>
        <button
          type="button"
          className="mt-4 rounded-xl bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
          onClick={async () => {
            await fetch("/api/document-templates", {
              method: "POST",
              credentials: "include",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                name,
                matterType: matter,
                adobeLibraryDocumentId: libId || null,
                adobeWorkflowId: wfId || null,
                description: desc,
                language: "en",
                requiredFields: ["first_name", "last_name"],
                active: true,
              }),
            });
            setName("");
            setLibId("");
            setWfId("");
            setDesc("");
            await refresh();
          }}
        >
          Save template
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] shadow-sm">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Matter</th>
              <th className="px-4 py-3">Library ID</th>
              <th className="px-4 py-3">Active</th>
              <th className="px-4 py-3 w-28" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--border)]">
            {items.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50/70">
                <td className="px-4 py-3 font-medium text-slate-900">{t.name}</td>
                <td className="px-4 py-3 text-slate-700">{t.matterType}</td>
                <td className="px-4 py-3 text-xs text-slate-700">{t.adobeLibraryDocumentId ?? t.adobeWorkflowId ?? "—"}</td>
                <td className="px-4 py-3 text-slate-700">{t.active ? "Yes" : "No"}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    className="text-xs font-medium text-rose-700 hover:underline"
                    onClick={async () => {
                      if (!confirm(`Delete template “${t.name}”? Existing requests that used it keep their history; new sends should pick another template.`)) return;
                      const res = await fetch(`/api/document-templates/${t.id}`, { method: "DELETE", credentials: "include" });
                      if (res.ok) await refresh();
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
