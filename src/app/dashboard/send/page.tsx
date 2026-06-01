"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, startTransition } from "react";
import type { DocuSealTemplateSummary } from "@/types/models";

export default function SendSigningRequestPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<DocuSealTemplateSummary[]>([]);
  const [templateId, setTemplateId] = useState<string>("");
  const [clientName, setClientName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [language, setLanguage] = useState<"en" | "es">("en");
  const [sendSms, setSendSms] = useState(true);
  const [sendEmail, setSendEmail] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [quoReady, setQuoReady] = useState<boolean | null>(null);

  async function loadTemplates() {
    setLoadingTemplates(true);
    const res = await fetch("/api/docuseal/templates", { credentials: "include" });
    setLoadingTemplates(false);
    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as { error?: string } | null;
      startTransition(() => setError(j?.error ?? "Could not load DocuSeal templates"));
      return;
    }
    const j = (await res.json()) as { items: DocuSealTemplateSummary[] };
    startTransition(() => {
      const list = j.items.filter((t) => !t.archivedAt);
      setTemplates(list);
      setTemplateId((prev) => prev || (list[0] ? String(list[0]!.id) : ""));
    });
  }

  useEffect(() => {
    void loadTemplates();
  }, []);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/app-settings", { credentials: "include" });
      if (!res.ok) return;
      const j = (await res.json()) as {
        env?: { hasQuoApiKey?: boolean; hasQuoFromNumber?: boolean };
      };
      const e = j.env;
      if (!e) return;
      startTransition(() => setQuoReady(Boolean(e.hasQuoApiKey && e.hasQuoFromNumber)));
    })();
  }, []);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Send signing request</h1>
        <p className="mt-1 text-sm text-[color:var(--muted)]">
          Send a secure signing link by SMS and/or email.
        </p>
      </div>

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</div> : null}

      {quoReady === false && sendSms ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          <strong>SMS will not send</strong> until <code className="text-xs">QUO_API_KEY</code> and{" "}
          <code className="text-xs">QUO_FROM_NUMBER</code> (or <code className="text-xs">QUO_PHONE_NUMBER_ID</code>) are
          set — use a number from your Quo workspace, not another provider. US numbers require Quo carrier (A2P)
          registration. For local testing without Quo, set{" "}
          <code className="text-xs">QUO_SMS_MOCK=true</code> or uncheck SMS and use email only.
        </div>
      ) : null}

      <form
        className="space-y-5 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6 shadow-sm"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          const tid = Number(templateId);
          if (!Number.isFinite(tid) || tid <= 0) {
            setError("Select a template.");
            setBusy(false);
            return;
          }
          const res = await fetch("/api/signing-requests", {
            method: "POST",
            credentials: "include",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              clientName,
              phone: phone.trim() || null,
              email: email.trim() || null,
              language,
              templateId: tid,
              sendSms,
              sendEmail,
              reminderEnabled,
            }),
          });
          setBusy(false);
          if (!res.ok) {
            const j = (await res.json().catch(() => null)) as { error?: string } | null;
            setError(j?.error ?? "Request failed");
            return;
          }
          const j = (await res.json()) as { item: { id: string } };
          router.push(`/dashboard/requests/${j.item.id}`);
        }}
      >
        <div>
          <label className="text-sm font-medium text-slate-900">Template</label>
          <select
            required
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            value={templateId}
            disabled={loadingTemplates}
            onChange={(e) => setTemplateId(e.target.value)}
          >
            {loadingTemplates ? <option>Loading…</option> : null}
            {!loadingTemplates && templates.length === 0 ? <option value="">No templates</option> : null}
            {templates.map((t) => (
              <option key={t.id} value={String(t.id)}>
                {t.name} (#{t.id})
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-slate-500">
            Added or renamed a template in DocuSeal?{" "}
            <button
              type="button"
              className="font-medium text-slate-700 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
              onClick={() => void loadTemplates()}
              disabled={loadingTemplates}
            >
              Reload list
            </button>
          </p>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-900">Client name</label>
          <input
            required
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="Jane Doe"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-slate-900">Phone</label>
            <p className="mt-0.5 text-xs text-slate-500">Include country code (e.g. +1 for US).</p>
            <input
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1…"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-900">Email (optional)</label>
            <input
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="client@email.com"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-900">Language</label>
          <div className="mt-2 flex gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="lang" checked={language === "en"} onChange={() => setLanguage("en")} />
              English
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="lang" checked={language === "es"} onChange={() => setLanguage("es")} />
              Spanish
            </label>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
          <div className="text-sm font-semibold text-slate-900">Delivery</div>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={sendSms} onChange={(e) => setSendSms(e.target.checked)} />
            SMS
          </label>
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />
            Email
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm font-medium text-slate-900">
          <input type="checkbox" checked={reminderEnabled} onChange={(e) => setReminderEnabled(e.target.checked)} />
          Send reminders if they have not signed yet
        </label>

        <button
          disabled={busy}
          type="submit"
          className="w-full rounded-xl bg-[color:var(--accent)] px-4 py-3 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50"
        >
          {busy ? "Sending…" : "Send signing request"}
        </button>
      </form>
    </div>
  );
}
