"use client";

import { useEffect, useState, startTransition } from "react";
import { CLEAR_FIRM_SECRET, DEFAULT_FIRM_ID } from "@/lib/firm-scope";
import type { QuoPhoneNumberOption } from "@/types/models";

type FirmPublic = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  memberEmails: string[];
  docusealConfigured: boolean;
  quoConfigured: boolean;
  usesEnvDocuseal: boolean;
  usesEnvQuo: boolean;
  docusealApiUrl: string | null;
  docusealAdminBaseUrl: string | null;
  quoFromNumber: string | null;
  quoPhoneNumberId: string | null;
  quoPhoneNumbers: QuoPhoneNumberOption[];
  quoSelectablePhoneNumberIds: string[] | null;
  quoDefaultContractPhoneNumberId: string | null;
  quoDefaultGeneralPhoneNumberId: string | null;
  hasDocusealApiKey: boolean;
  hasDocusealWebhookSecret: boolean;
  hasQuoApiKey: boolean;
  hasQuoWebhookSecret: boolean;
};

const emptyForm = {
  name: "",
  logoUrl: "",
  memberEmails: "",
  docusealApiUrl: "",
  docusealApiKey: "",
  docusealAdminBaseUrl: "",
  docusealWebhookSecret: "",
  quoApiKey: "",
  quoWebhookSecret: "",
  quoSelectablePhoneNumberIds: [] as string[],
  quoDefaultContractPhoneNumberId: "",
  quoDefaultGeneralPhoneNumberId: "",
};

function formFromFirm(f: FirmPublic) {
  const numbers = f.quoPhoneNumbers ?? [];
  const selectable =
    f.quoSelectablePhoneNumberIds == null
      ? numbers.map((n) => n.id)
      : f.quoSelectablePhoneNumberIds.filter((id) => numbers.some((n) => n.id === id));
  return {
    name: f.name,
    logoUrl: f.logoUrl ?? "",
    memberEmails: f.memberEmails.join("\n"),
    docusealApiUrl: f.docusealApiUrl ?? "",
    docusealAdminBaseUrl: f.docusealAdminBaseUrl ?? "",
    docusealApiKey: "",
    docusealWebhookSecret: "",
    quoApiKey: "",
    quoWebhookSecret: "",
    quoSelectablePhoneNumberIds: selectable,
    quoDefaultContractPhoneNumberId: f.quoDefaultContractPhoneNumberId ?? "",
    quoDefaultGeneralPhoneNumberId: f.quoDefaultGeneralPhoneNumberId ?? "",
  };
}

function phoneLabel(n: QuoPhoneNumberOption): string {
  const name = n.name?.trim();
  return name ? `${name} (${n.number})` : n.number;
}

export default function AdminFirmsPage() {
  const [items, setItems] = useState<FirmPublic[]>([]);
  const [selectedId, setSelectedId] = useState<string | "new">(DEFAULT_FIRM_ID);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [origin, setOrigin] = useState("");

  async function load() {
    const res = await fetch("/api/admin/firms", { credentials: "include" });
    if (res.status === 403) {
      startTransition(() => setForbidden(true));
      return;
    }
    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as { error?: string } | null;
      startTransition(() => setError(j?.error ?? "Could not load firms"));
      return;
    }
    const j = (await res.json()) as { items: FirmPublic[] };
    startTransition(() => {
      setItems(j.items);
      setForbidden(false);
    });
  }

  async function clearSecret(field: "docusealWebhookSecret" | "quoWebhookSecret", label: string) {
    if (selectedId === "new") return;
    if (!confirm(`Clear the saved ${label} for this firm?`)) return;
    setBusy(true);
    setError(null);
    setOk(null);
    const res = await fetch(`/api/admin/firms/${selectedId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ [field]: CLEAR_FIRM_SECRET }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(typeof j?.error === "string" ? j.error : "Clear failed");
      return;
    }
    setOk(`${label} cleared.`);
    setForm((f) => ({ ...f, [field]: "" }));
    await load();
  }

  async function importQuoNumbers() {
    if (selectedId === "new") return;
    setImporting(true);
    setError(null);
    setOk(null);
    const res = await fetch(`/api/admin/firms/${selectedId}/quo-import`, {
      method: "POST",
      credentials: "include",
    });
    setImporting(false);
    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(typeof j?.error === "string" ? j.error : "Import failed");
      return;
    }
    const j = (await res.json()) as { item: FirmPublic; imported: number };
    setOk(
      j.imported === 0
        ? "Quo returned no phone numbers for this API key."
        : `Imported ${j.imported} Quo number${j.imported === 1 ? "" : "s"}. Check which ones staff can send from, then set defaults.`,
    );
    await load();
    setForm(formFromFirm(j.item));
  }

  useEffect(() => {
    setOrigin(window.location.origin);
    void load();
  }, []);

  useEffect(() => {
    if (selectedId === "new") {
      setForm(emptyForm);
      return;
    }
    const f = items.find((x) => x.id === selectedId);
    if (!f) return;
    setForm(formFromFirm(f));
  }, [selectedId, items]);

  const selected = items.find((x) => x.id === selectedId);
  const phoneNumbers = selected?.quoPhoneNumbers ?? [];
  const selectableNumbers = phoneNumbers.filter((n) => form.quoSelectablePhoneNumberIds.includes(n.id));
  const docusealWebhookPath =
    selectedId === "new"
      ? ""
      : selectedId === DEFAULT_FIRM_ID
        ? `${origin}/api/webhooks/docuseal`
        : `${origin}/api/webhooks/docuseal/${selectedId}`;
  const quoWebhookPath =
    selectedId === "new"
      ? ""
      : selectedId === DEFAULT_FIRM_ID
        ? `${origin}/api/webhooks/quo`
        : `${origin}/api/webhooks/quo/${selectedId}`;

  if (forbidden) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
        Only global admins can manage firms. Add your Google email to{" "}
        <code className="text-xs">SIGNFLOW_ADMIN_EMAILS</code>.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Firms</h1>
        <p className="mt-1 text-sm text-[color:var(--muted)]">
          Each firm has its own DocuSeal instance, requests, and message templates. Staff only see firms you grant
          them. Ramos James is the default — everyone who can sign in can use it unless you restrict the list.
        </p>
      </div>

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</div> : null}
      {ok ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{ok}</div> : null}

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <div className="space-y-2">
          {items.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`w-full rounded-xl px-3 py-2 text-left text-sm ${
                selectedId === f.id ? "bg-[color:var(--brand-navy)] text-white" : "bg-white text-slate-800 hover:bg-slate-50 border border-slate-200"
              }`}
              onClick={() => setSelectedId(f.id)}
            >
              <div className="font-medium">{f.name}</div>
              <div className={selectedId === f.id ? "text-xs text-white/70" : "text-xs text-slate-500"}>
                {f.memberEmails.length ? `${f.memberEmails.length} people` : f.id === DEFAULT_FIRM_ID ? "All staff" : "Admins only"}
              </div>
            </button>
          ))}
          <button
            type="button"
            className={`w-full rounded-xl border border-dashed px-3 py-2 text-left text-sm ${
              selectedId === "new" ? "border-[color:var(--brand-navy)] bg-slate-50 font-medium" : "border-slate-300 text-slate-700 hover:bg-slate-50"
            }`}
            onClick={() => setSelectedId("new")}
          >
            + Add firm
          </button>
        </div>

        <form
          className="space-y-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-5 shadow-sm"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            setOk(null);
            const body = {
              name: form.name.trim(),
              logoUrl: form.logoUrl.trim() || null,
              memberEmails: form.memberEmails,
              docusealApiUrl: form.docusealApiUrl.trim() || null,
              docusealApiKey: form.docusealApiKey.trim() || null,
              docusealAdminBaseUrl: form.docusealAdminBaseUrl.trim() || null,
              docusealWebhookSecret: form.docusealWebhookSecret.trim() || null,
              quoApiKey: form.quoApiKey.trim() || null,
              quoWebhookSecret: form.quoWebhookSecret.trim() || null,
              quoSelectablePhoneNumberIds: form.quoSelectablePhoneNumberIds,
              quoDefaultContractPhoneNumberId: form.quoDefaultContractPhoneNumberId.trim() || null,
              quoDefaultGeneralPhoneNumberId: form.quoDefaultGeneralPhoneNumberId.trim() || null,
            };
            const res =
              selectedId === "new"
                ? await fetch("/api/admin/firms", {
                    method: "POST",
                    credentials: "include",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify(body),
                  })
                : await fetch(`/api/admin/firms/${selectedId}`, {
                    method: "PATCH",
                    credentials: "include",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify(body),
                  });
            setBusy(false);
            if (!res.ok) {
              const j = (await res.json().catch(() => null)) as { error?: string } | null;
              setError(typeof j?.error === "string" ? j.error : "Save failed");
              return;
            }
            const j = (await res.json()) as { item: FirmPublic };
            setOk(
              selectedId === "new"
                ? "Firm created. Save a Quo API key, then Import Quo numbers to set SMS defaults."
                : "Firm saved. API keys stay hidden after reload — leave those fields blank to keep the stored values.",
            );
            await load();
            setSelectedId(j.item.id);
          }}
        >
          <div>
            <label className="text-sm font-medium text-slate-900">Firm name</label>
            <input
              required
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Acme Injury Law"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-900">Logo URL</label>
            <input
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={form.logoUrl}
              onChange={(e) => setForm((f) => ({ ...f, logoUrl: e.target.value }))}
              placeholder="https://…/logo.png"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-900">Who can switch to this firm</label>
            <p className="mt-0.5 text-xs text-slate-500">
              One email or domain per line. Leave blank on Ramos James for all staff. On other firms, blank means
              admins only.
            </p>
            <textarea
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              rows={4}
              value={form.memberEmails}
              onChange={(e) => setForm((f) => ({ ...f, memberEmails: e.target.value }))}
              placeholder={"lawyer@otherfirm.com\notherfirm.com"}
            />
          </div>

          <div className="border-t border-slate-100 pt-4">
            <div className="text-sm font-semibold text-slate-900">DocuSeal</div>
            <p className="mt-1 text-xs text-slate-500">
              {selected?.hasDocusealApiKey
                ? "This firm has a stored DocuSeal API key. Leave key/secret fields blank to keep them."
                : selected?.usesEnvDocuseal
                  ? "Currently using the shared DOCUSEAL_* environment variables. Paste this firm’s own API URL and key to connect a separate DocuSeal."
                  : "Add this firm’s DocuSeal API URL and key."}
            </p>
            <label className="mt-3 block text-sm font-medium text-slate-900">API URL</label>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={form.docusealApiUrl}
              onChange={(e) => setForm((f) => ({ ...f, docusealApiUrl: e.target.value }))}
              placeholder="https://docuseal.otherfirm.com"
            />
            <label className="mt-3 block text-sm font-medium text-slate-900">API key</label>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              type="password"
              autoComplete="off"
              value={form.docusealApiKey}
              onChange={(e) => setForm((f) => ({ ...f, docusealApiKey: e.target.value }))}
              placeholder={
                selected?.hasDocusealApiKey ? "Saved — leave blank to keep, or paste a new key" : ""
              }
            />
            {selected?.hasDocusealApiKey ? (
              <p className="mt-1 text-xs text-emerald-700">API key is saved for this firm.</p>
            ) : null}
            <label className="mt-3 block text-sm font-medium text-slate-900">Admin / signing URL</label>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={form.docusealAdminBaseUrl}
              onChange={(e) => setForm((f) => ({ ...f, docusealAdminBaseUrl: e.target.value }))}
              placeholder="https://docuseal.otherfirm.com"
            />
            <label className="mt-3 block text-sm font-medium text-slate-900">Webhook secret</label>
            <div className="mt-1 flex flex-wrap gap-2">
              <input
                className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                type="password"
                autoComplete="off"
                value={form.docusealWebhookSecret}
                onChange={(e) => setForm((f) => ({ ...f, docusealWebhookSecret: e.target.value }))}
                placeholder={
                  selected?.hasDocusealWebhookSecret
                    ? "Saved — leave blank to keep, or paste a new secret"
                    : ""
                }
              />
              {selectedId !== "new" && selected?.hasDocusealWebhookSecret ? (
                <button
                  type="button"
                  disabled={busy}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  onClick={() => void clearSecret("docusealWebhookSecret", "DocuSeal webhook secret")}
                >
                  Clear
                </button>
              ) : null}
            </div>
            {selected?.hasDocusealWebhookSecret ? (
              <p className="mt-1 text-xs text-emerald-700">Webhook secret is saved for this firm.</p>
            ) : null}
            {docusealWebhookPath ? (
              <p className="mt-3 text-xs text-slate-600">
                Point this firm’s DocuSeal webhook to{" "}
                <code className="break-all rounded bg-slate-100 px-1 text-[11px]">{docusealWebhookPath}</code>
              </p>
            ) : null}
          </div>

          <div className="border-t border-slate-100 pt-4">
            <div className="text-sm font-semibold text-slate-900">SMS (Quo)</div>
            <p className="mt-1 text-xs text-slate-500">
              {selected?.hasQuoApiKey
                ? "This firm has a stored Quo API key. Leave the key blank to keep it. Import numbers from Quo, then set defaults for contracts vs other sends."
                : selected?.usesEnvQuo
                  ? "Using the shared Quo env key until you add this firm’s own API key. You can still import numbers with the env key."
                  : "Add this firm’s Quo API key, import numbers, then choose defaults."}
            </p>
            <label className="mt-3 block text-sm font-medium text-slate-900">Quo API key</label>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              type="password"
              autoComplete="off"
              value={form.quoApiKey}
              onChange={(e) => setForm((f) => ({ ...f, quoApiKey: e.target.value }))}
              placeholder={selected?.hasQuoApiKey ? "Saved — leave blank to keep, or paste a new key" : ""}
            />
            {selected?.hasQuoApiKey ? (
              <p className="mt-1 text-xs text-emerald-700">Quo API key is saved for this firm.</p>
            ) : null}

            {selectedId !== "new" ? (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={busy || importing}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                  onClick={() => void importQuoNumbers()}
                >
                  {importing ? "Importing…" : "Import Quo numbers"}
                </button>
                <span className="text-xs text-slate-500">
                  {phoneNumbers.length
                    ? `${phoneNumbers.length} number${phoneNumbers.length === 1 ? "" : "s"} saved for this firm`
                    : "No numbers imported yet"}
                </span>
              </div>
            ) : (
              <p className="mt-3 text-xs text-slate-500">Create the firm first, then import Quo numbers.</p>
            )}

            {phoneNumbers.length > 0 ? (
              <div className="mt-4 space-y-4">
                <div>
                  <div className="text-sm font-medium text-slate-900">Send-from options</div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Only checked numbers appear in the Send SMS from dropdown on send forms. Uncheck numbers staff
                    should not use.
                  </p>
                  <div className="mt-2 max-h-56 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                    {phoneNumbers.map((n) => {
                      const checked = form.quoSelectablePhoneNumberIds.includes(n.id);
                      return (
                        <label key={n.id} className="flex items-start gap-2 text-sm text-slate-800">
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={checked}
                            onChange={(e) => {
                              const on = e.target.checked;
                              setForm((f) => {
                                const nextIds = on
                                  ? [...f.quoSelectablePhoneNumberIds, n.id]
                                  : f.quoSelectablePhoneNumberIds.filter((id) => id !== n.id);
                                let contract = f.quoDefaultContractPhoneNumberId;
                                let general = f.quoDefaultGeneralPhoneNumberId;
                                if (!nextIds.includes(contract)) contract = nextIds[0] ?? "";
                                if (!nextIds.includes(general)) general = nextIds[0] ?? "";
                                return {
                                  ...f,
                                  quoSelectablePhoneNumberIds: nextIds,
                                  quoDefaultContractPhoneNumberId: contract,
                                  quoDefaultGeneralPhoneNumberId: general,
                                };
                              });
                            }}
                          />
                          <span>{phoneLabel(n)}</span>
                        </label>
                      );
                    })}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="text-xs font-medium text-slate-700 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          quoSelectablePhoneNumberIds: phoneNumbers.map((n) => n.id),
                        }))
                      }
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      className="text-xs font-medium text-slate-700 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          quoSelectablePhoneNumberIds: [],
                          quoDefaultContractPhoneNumberId: "",
                          quoDefaultGeneralPhoneNumberId: "",
                        }))
                      }
                    >
                      Clear all
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-900">Default for contracts</label>
                    <p className="mt-0.5 text-xs text-slate-500">Used on Send contract unless staff pick another.</p>
                    <select
                      className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      value={form.quoDefaultContractPhoneNumberId}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, quoDefaultContractPhoneNumberId: e.target.value }))
                      }
                      disabled={selectableNumbers.length === 0}
                    >
                      <option value="">Select…</option>
                      {selectableNumbers.map((n) => (
                        <option key={n.id} value={n.id}>
                          {phoneLabel(n)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-900">Default for other sends</label>
                    <p className="mt-0.5 text-xs text-slate-500">HIPAA, SAR, disbursement, and other one-time forms.</p>
                    <select
                      className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      value={form.quoDefaultGeneralPhoneNumberId}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, quoDefaultGeneralPhoneNumberId: e.target.value }))
                      }
                      disabled={selectableNumbers.length === 0}
                    >
                      <option value="">Select…</option>
                      {selectableNumbers.map((n) => (
                        <option key={n.id} value={n.id}>
                          {phoneLabel(n)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ) : null}

            <label className="mt-4 block text-sm font-medium text-slate-900">Quo webhook secret (STOP)</label>
            <p className="mt-0.5 text-xs text-slate-500">
              Required when this firm uses its own Quo workspace. Paste the signing secret Quo shows when you create the
              webhook (often <code className="text-[11px]">whsec_…</code>).
            </p>
            <div className="mt-1 flex flex-wrap gap-2">
              <input
                className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                type="password"
                autoComplete="off"
                value={form.quoWebhookSecret}
                onChange={(e) => setForm((f) => ({ ...f, quoWebhookSecret: e.target.value }))}
                placeholder={
                  selected?.hasQuoWebhookSecret
                    ? "Saved — leave blank to keep, or paste a new secret"
                    : ""
                }
              />
              {selectedId !== "new" && selected?.hasQuoWebhookSecret ? (
                <button
                  type="button"
                  disabled={busy}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  onClick={() => void clearSecret("quoWebhookSecret", "Quo webhook secret")}
                >
                  Clear
                </button>
              ) : null}
            </div>
            {selected?.hasQuoWebhookSecret ? (
              <p className="mt-1 text-xs text-emerald-700">Quo webhook secret is saved for this firm.</p>
            ) : null}
            {quoWebhookPath ? (
              <p className="mt-3 text-xs text-slate-600">
                Point this firm’s Quo <code className="text-[11px]">message.received</code> webhook to{" "}
                <code className="break-all rounded bg-slate-100 px-1 text-[11px]">{quoWebhookPath}</code>
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              disabled={busy}
              type="submit"
              className="rounded-xl bg-[color:var(--accent)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50"
            >
              {busy ? "Saving…" : selectedId === "new" ? "Create firm" : "Save firm"}
            </button>
            {selectedId !== "new" && selectedId !== DEFAULT_FIRM_ID ? (
              <button
                type="button"
                disabled={busy}
                className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-900 hover:bg-rose-100 disabled:opacity-50"
                onClick={async () => {
                  if (!confirm(`Delete ${selected?.name ?? "this firm"}? Existing requests stay in the database but will be hidden.`)) {
                    return;
                  }
                  setBusy(true);
                  const res = await fetch(`/api/admin/firms/${selectedId}`, {
                    method: "DELETE",
                    credentials: "include",
                  });
                  setBusy(false);
                  if (!res.ok) {
                    const j = (await res.json().catch(() => null)) as { error?: string } | null;
                    setError(typeof j?.error === "string" ? j.error : "Delete failed");
                    return;
                  }
                  setOk("Firm deleted.");
                  setSelectedId(DEFAULT_FIRM_ID);
                  await load();
                }}
              >
                Delete
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}
