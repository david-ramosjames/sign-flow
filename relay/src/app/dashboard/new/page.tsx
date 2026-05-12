"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, startTransition } from "react";
import type { DocumentTemplate, StaffUser } from "@/types/models";
import { defaultSmsBody } from "@/lib/default-messages";
import { formatPhoneNational } from "@/lib/phone";

export default function NewSigningRequestPage() {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [language, setLanguage] = useState<"en" | "es">("en");
  const [channels, setChannels] = useState<{ email: boolean; sms: boolean }>({ email: true, sms: false });
  const [notes, setNotes] = useState("");
  const [smsConsent, setSmsConsent] = useState(false);
  const [assignedStaffUserId, setAssignedStaffUserId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const tRes = await fetch("/api/document-templates", { credentials: "include" });
      if (tRes.ok) {
        let tJson = (await tRes.json()) as { items: DocumentTemplate[] };
        if (tJson.items.length === 0) {
          await fetch("/api/seed", { method: "POST", credentials: "include" });
          const tRes2 = await fetch("/api/document-templates", { credentials: "include" });
          if (tRes2.ok) tJson = (await tRes2.json()) as { items: DocumentTemplate[] };
        }
        startTransition(() => {
          setTemplates(tJson.items.filter((x) => x.active));
          if (!templateId && tJson.items[0]) setTemplateId(tJson.items[0]!.id);
        });
      }
      const sRes = await fetch("/api/staff", { credentials: "include" });
      if (sRes.ok) {
        const sJson = (await sRes.json()) as { items: StaffUser[] };
        startTransition(() => {
          setStaff(sJson.items.filter((x) => x.active));
          if (!assignedStaffUserId && sJson.items[0]) setAssignedStaffUserId(sJson.items[0]!.id);
        });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, []);

  const previewLink = "https://example.invalid/signing-preview";

  const smsPreview = useMemo(() => {
    return defaultSmsBody(language, first.trim() || "{{first_name}}", previewLink);
  }, [language, first]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const deliveryChannels = [
      ...(channels.email ? (["email"] as const) : []),
      ...(channels.sms ? (["sms"] as const) : []),
    ];
    const res = await fetch("/api/signing-requests", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        leadFirstName: first,
        leadLastName: last,
        phone: phone.trim() || null,
        email: email.trim() || null,
        language,
        documentTemplateId: templateId,
        deliveryChannels,
        staffNotes: notes.trim() || null,
        smsConsentConfirmed: smsConsent,
        assignedStaffUserId: assignedStaffUserId || null,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as { error?: unknown } | null;
      const msg = typeof j?.error === "string" ? j.error : "Could not send";
      setError(msg);
      return;
    }
    const j = (await res.json()) as { item: { id: string } };
    window.location.href = `/dashboard/requests/${j.item.id}`;
  }

  const phonePreview = phone.trim() ? formatPhoneNational(phone) : "";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">New signing request</h1>
          <p className="mt-1 text-sm text-[color:var(--muted)]">Adobe sends the official agreement email when email is enabled.</p>
        </div>
        <Link href="/dashboard" className="text-sm font-medium text-[color:var(--accent)] hover:underline">
          Back
        </Link>
      </div>

      <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-5 shadow-sm lg:col-span-3">
          {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</div> : null}

          <div>
            <label className="text-sm font-medium text-slate-900">Document / template</label>
            <select
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              required
            >
              {templates.length === 0 ? <option value="">No templates — run seed (auto) or visit Admin → Templates</option> : null}
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-[color:var(--muted)]">Template IDs are configured in Admin.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-slate-900">First name</label>
              <input
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                value={first}
                onChange={(e) => setFirst(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-900">Last name</label>
              <input
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                value={last}
                onChange={(e) => setLast(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-slate-900">Phone</label>
              <input
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
                placeholder="(555) 555-5555"
              />
              {phonePreview ? <p className="mt-2 text-xs text-slate-600">Formatted: {phonePreview}</p> : null}
            </div>
            <div>
              <label className="text-sm font-medium text-slate-900">Email (optional)</label>
              <input
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder="name@example.com"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-slate-900">Preferred language</label>
              <select
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                value={language}
                onChange={(e) => setLanguage(e.target.value as "en" | "es")}
              >
                <option value="en">English</option>
                <option value="es">Spanish</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-900">Assigned staff</label>
              <select
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                value={assignedStaffUserId}
                onChange={(e) => setAssignedStaffUserId(e.target.value)}
              >
                <option value="">Unassigned</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.displayName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="text-sm font-medium text-slate-900">Delivery channels</div>
            <div className="mt-3 flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={channels.email} onChange={(e) => setChannels((c) => ({ ...c, email: e.target.checked }))} />
                Email (Adobe official signing email)
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={channels.sms} onChange={(e) => setChannels((c) => ({ ...c, sms: e.target.checked }))} />
                SMS (Twilio link delivery / reminders)
              </label>
            </div>
          </div>

          {channels.sms ? (
            <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
              <input
                className="mt-1"
                type="checkbox"
                checked={smsConsent}
                onChange={(e) => setSmsConsent(e.target.checked)}
                required={channels.sms}
              />
              <span>
                Lead has provided permission to receive text messages about their case/documents.
                <span className="mt-1 block text-xs text-slate-600">Required before sending SMS.</span>
              </span>
            </label>
          ) : null}

          <div>
            <label className="text-sm font-medium text-slate-900">Optional notes</label>
            <textarea
              className="mt-2 min-h-[90px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <button
            disabled={busy || !templateId}
            className="w-full rounded-xl bg-[color:var(--accent)] px-4 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
            type="submit"
          >
            {busy ? "Sending…" : "Send"}
          </button>
        </div>

        <div className="space-y-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-5 shadow-sm lg:col-span-2">
          <div className="text-sm font-semibold text-slate-900">Preview</div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-800">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">SMS</div>
            <p className="mt-2 whitespace-pre-wrap leading-relaxed">{smsPreview}</p>
          </div>
          <p className="text-xs text-[color:var(--muted)]">
            Preview uses a placeholder signing link until Adobe returns a real signing URL in Phase 2.
          </p>
        </div>
      </form>
    </div>
  );
}
