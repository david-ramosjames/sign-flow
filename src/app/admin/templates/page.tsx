"use client";

import { useCallback, useEffect, useState, startTransition } from "react";
import { format } from "date-fns";
import type { DocuSealTemplateSummary } from "@/types/models";

function collectHttpUrls(value: unknown, out: string[]): void {
  if (value === null || value === undefined) return;
  if (typeof value === "string") {
    if (value.startsWith("http://") || value.startsWith("https://")) out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const v of value) collectHttpUrls(v, out);
    return;
  }
  if (typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) collectHttpUrls(v, out);
  }
}

function firstPdfLikeUrl(json: unknown): string | null {
  const urls: string[] = [];
  collectHttpUrls(json, urls);
  const pdf = urls.find((u) => /\.pdf($|\?)/i.test(u) || u.includes("application/pdf"));
  return pdf ?? urls[0] ?? null;
}

function imagePreviewUrls(json: unknown): string[] {
  const urls: string[] = [];
  collectHttpUrls(json, urls);
  return urls.filter((u) => /\.(png|jpe?g|webp|gif)($|\?)/i.test(u)).slice(0, 6);
}

export default function DocuSealTemplatesPage() {
  const [items, setItems] = useState<DocuSealTemplateSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewId, setViewId] = useState<number | null>(null);
  const [viewJson, setViewJson] = useState<string | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewImages, setViewImages] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/docuseal/templates", { credentials: "include" });
    setLoading(false);
    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as { error?: string } | null;
      startTransition(() => setError(j?.error ?? "Failed to load templates"));
      return;
    }
    const j = (await res.json()) as { items: DocuSealTemplateSummary[] };
    startTransition(() => {
      setItems(j.items);
      setError(null);
    });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openView = async (id: number) => {
    setViewId(id);
    setViewJson(null);
    setViewImages([]);
    setViewLoading(true);
    const res = await fetch(`/api/docuseal/templates/${id}`, { credentials: "include" });
    setViewLoading(false);
    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as { error?: string } | null;
      startTransition(() => setViewJson(j?.error ?? "Failed to load template"));
      return;
    }
    const data = (await res.json()) as unknown;
    startTransition(() => {
      setViewJson(JSON.stringify(data, null, 2));
      setViewImages(imagePreviewUrls(data));
    });
  };

  const downloadTemplate = async (id: number) => {
    let url: string | null = null;
    const docRes = await fetch(`/api/docuseal/templates/${id}/documents`, { credentials: "include" });
    if (docRes.ok) {
      const data = (await docRes.json()) as unknown;
      url = firstPdfLikeUrl(data);
    }
    if (!url) {
      const tRes = await fetch(`/api/docuseal/templates/${id}`, { credentials: "include" });
      if (tRes.ok) {
        const data = (await tRes.json()) as unknown;
        url = firstPdfLikeUrl(data);
      }
    }
    if (url) window.open(url, "_blank", "noopener,noreferrer");
    else alert("No downloadable URL was found in the DocuSeal response. Use “Open in DocuSeal” to export from the console.");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">DocuSeal templates</h1>
          <p className="mt-1 max-w-2xl text-sm text-[color:var(--muted)]">
            Create and edit templates in DocuSeal (signer roles, fields, and layout). This page lists what DocuSeal exposes
            over the API so you can pick template IDs when sending requests. Use View / Download when the API returns
            assets; otherwise open the template in DocuSeal.
          </p>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => load()}
          className="rounded-xl border border-[color:var(--border)] bg-white px-4 py-2.5 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50"
        >
          {loading ? "Loading…" : "Refresh list"}
        </button>
      </div>

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</div> : null}

      <div className="overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] shadow-sm">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Folder</th>
              <th className="px-4 py-3">Updated</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && !loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-600">
                  No templates returned. Check <code className="text-xs">DOCUSEAL_API_KEY</code> and{" "}
                  <code className="text-xs">DOCUSEAL_API_URL</code>.
                </td>
              </tr>
            ) : (
              items.map((t) => (
                <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-medium text-slate-900">{t.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">{t.id}</td>
                  <td className="px-4 py-3 text-slate-700">{t.folderName ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {t.updatedAt ? format(new Date(t.updatedAt), "MMM d, yyyy") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-2 text-xs">
                      <button
                        type="button"
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 font-medium text-slate-800 hover:bg-slate-50"
                        onClick={() => void openView(t.id)}
                      >
                        View
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 font-medium text-slate-800 hover:bg-slate-50"
                        onClick={() => void downloadTemplate(t.id)}
                      >
                        Download
                      </button>
                      {t.adminUrl ? (
                        <a
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 font-medium text-[color:var(--accent)] hover:bg-slate-50"
                          href={t.adminUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          DocuSeal
                        </a>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {viewId !== null ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div className="text-sm font-semibold text-slate-900">Template #{viewId}</div>
              <button
                type="button"
                className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
                onClick={() => {
                  setViewId(null);
                  setViewJson(null);
                }}
              >
                Close
              </button>
            </div>
            <div className="max-h-[calc(90vh-52px)] overflow-auto p-4">
              {viewLoading ? <p className="text-sm text-slate-600">Loading…</p> : null}
              {viewImages.length > 0 ? (
                <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {viewImages.map((src) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={src} src={src} alt="" className="h-40 w-full rounded-lg border border-slate-200 object-contain" />
                  ))}
                </div>
              ) : null}
              {viewJson ? (
                <pre className="whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-3 text-xs text-slate-800 ring-1 ring-slate-200">
                  {viewJson}
                </pre>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
