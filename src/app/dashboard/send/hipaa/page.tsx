"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, startTransition } from "react";
import { filterHipaaTemplates } from "@/lib/docuseal-prefill";
import type { DocuSealTemplateSummary, HipaaFormPrefill, OutboundDeliverySettings } from "@/types/models";
import { DEFAULT_OUTBOUND_DELIVERY } from "@/lib/outbound-delivery";

function emptyOptional(value: string): string | null {
  const v = value.trim();
  return v ? v : null;
}

export default function SendHipaaPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<DocuSealTemplateSummary[]>([]);
  const [templateId, setTemplateId] = useState<string>("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [otherName, setOtherName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [altPhone, setAltPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [legalAcknowledged, setLegalAcknowledged] = useState(false);
  const [allHealthAcknowledged, setAllHealthAcknowledged] = useState(false);
  const [isMinor, setIsMinor] = useState(false);
  const [nameAuthorizedRepForMinor, setNameAuthorizedRepForMinor] = useState("");
  const [minorRepParent, setMinorRepParent] = useState(false);
  const [minorRepGuardian, setMinorRepGuardian] = useState(false);
  const [minorRepOther, setMinorRepOther] = useState(false);
  const [deliveryPhone, setDeliveryPhone] = useState("");
  const [deliveryEmail, setDeliveryEmail] = useState("");
  const [sendSms, setSendSms] = useState(true);
  const [sendEmail, setSendEmail] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [quoReady, setQuoReady] = useState<boolean | null>(null);
  const [outbound, setOutbound] = useState<OutboundDeliverySettings>(DEFAULT_OUTBOUND_DELIVERY);

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
      const list = filterHipaaTemplates(j.items);
      setTemplates(list);
      setTemplateId((prev) => {
        if (prev && list.some((t) => String(t.id) === prev)) return prev;
        return list[0] ? String(list[0].id) : "";
      });
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
        item?: { outboundDelivery?: OutboundDeliverySettings } | null;
        env?: { hasQuoApiKey?: boolean; hasQuoFromNumber?: boolean };
      };
      const e = j.env;
      const od = { ...DEFAULT_OUTBOUND_DELIVERY, ...(j.item?.outboundDelivery ?? {}) };
      startTransition(() => {
        if (e) setQuoReady(Boolean(e.hasQuoApiKey && e.hasQuoFromNumber));
        setOutbound(od);
        if (!od.signingSmsEnabled) setSendSms(false);
        if (!od.signingEmailEnabled) setSendEmail(false);
        if (od.signingSmsEnabled && !od.signingEmailEnabled) setSendSms(true);
        if (od.signingEmailEnabled && !od.signingSmsEnabled) setSendEmail(true);
      });
    })();
  }, []);

  const canDeliver = outbound.signingSmsEnabled || outbound.signingEmailEnabled;

  function buildHipaaPrefill(): HipaaFormPrefill {
    return {
      lastName: lastName.trim(),
      firstName: firstName.trim(),
      middleName: emptyOptional(middleName),
      otherName: emptyOptional(otherName),
      dateOfBirth: emptyOptional(dateOfBirth),
      address: emptyOptional(address),
      city: emptyOptional(city),
      state: emptyOptional(state),
      zipCode: emptyOptional(zipCode),
      phone: emptyOptional(formPhone),
      altPhone: emptyOptional(altPhone),
      email: emptyOptional(formEmail),
      legalAcknowledged,
      allHealthAcknowledged,
      isMinor,
      nameAuthorizedRepForMinor: isMinor ? emptyOptional(nameAuthorizedRepForMinor) : null,
      minorRepParent: isMinor ? minorRepParent : false,
      minorRepGuardian: isMinor ? minorRepGuardian : false,
      minorRepOther: isMinor ? minorRepOther : false,
    };
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="text-sm text-[color:var(--muted)]">
          <Link href="/dashboard/send" className="font-medium text-[color:var(--brand-navy)] underline underline-offset-2">
            ← All send types
          </Link>
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Send HIPAA form</h1>
        <p className="mt-1 text-sm text-[color:var(--muted)]">
          English only. Pre-fills client information and today&apos;s date (US Central). The client completes the
          signature on the document.
        </p>
      </div>

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</div> : null}

      {!canDeliver ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          <strong>Signing delivery is disabled.</strong> An admin must enable SMS and/or email under{" "}
          <strong>Admin → Messages → Signing request delivery</strong>.
        </div>
      ) : null}

      {quoReady === false && sendSms && outbound.signingSmsEnabled ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          <strong>SMS will not send</strong> until Quo is configured. Include <code className="text-xs">+1</code> on the
          delivery phone number.
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
            setError("Select a HIPAA template.");
            setBusy(false);
            return;
          }
          if (!canDeliver) {
            setError("SMS and email for signing requests are both disabled in admin settings.");
            setBusy(false);
            return;
          }
          if (!sendSms && !sendEmail) {
            setError("Select at least one delivery method.");
            setBusy(false);
            return;
          }
          if (!lastName.trim()) {
            setError("Last name is required.");
            setBusy(false);
            return;
          }
          if (!firstName.trim()) {
            setError("First name is required.");
            setBusy(false);
            return;
          }
          if (!legalAcknowledged) {
            setError("Confirm the legal authorization before sending.");
            setBusy(false);
            return;
          }
          if (!allHealthAcknowledged) {
            setError("Confirm the all-health authorization before sending.");
            setBusy(false);
            return;
          }

          const hipaaPrefill = buildHipaaPrefill();
          const res = await fetch("/api/signing-requests", {
            method: "POST",
            credentials: "include",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              clientName: "",
              dateOfLoss: null,
              hipaaPrefill,
              phone: deliveryPhone.trim() || null,
              email: deliveryEmail.trim() || null,
              language: "en",
              templateId: tid,
              sendSms,
              sendEmail,
              reminderEnabled,
            }),
          });
          setBusy(false);
          if (!res.ok) {
            const j = (await res.json().catch(() => null)) as { error?: string } | null;
            setError(typeof j?.error === "string" ? j.error : "Request failed");
            return;
          }
          const j = (await res.json()) as { item: { id: string } };
          router.push(`/dashboard/requests/${j.item.id}`);
        }}
      >
        <div>
          <label className="text-sm font-medium text-slate-900">HIPAA template</label>
          <select
            required
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            value={templateId}
            disabled={loadingTemplates}
            onChange={(e) => setTemplateId(e.target.value)}
          >
            {loadingTemplates ? <option>Loading…</option> : null}
            {!loadingTemplates && templates.length === 0 ? (
              <option value="">No HIPAA templates — name must include &quot;HIPAA&quot; in DocuSeal</option>
            ) : null}
            {templates.map((t) => (
              <option key={t.id} value={String(t.id)}>
                {t.name}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-slate-500">
            Only templates whose name includes &quot;HIPAA&quot; appear here.{" "}
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

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-slate-900">First name</label>
            <input
              required
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-900">Last name</label>
            <input
              required
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-slate-900">Middle name</label>
            <input
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={middleName}
              onChange={(e) => setMiddleName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-900">Other name</label>
            <input
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={otherName}
              onChange={(e) => setOtherName(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-900">Date of birth</label>
          <p className="mt-0.5 text-xs text-slate-500">Optional — pre-fills month, day, and year on the form.</p>
          <input
            type="date"
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
          />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-900">Address</label>
          <input
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-slate-900">City</label>
            <input
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-900">State</label>
            <input
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={state}
              onChange={(e) => setState(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-900">ZIP code</label>
          <input
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            value={zipCode}
            onChange={(e) => setZipCode(e.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-slate-900">Phone (on form)</label>
            <p className="mt-0.5 text-xs text-slate-500">Pre-filled on the HIPAA document — not used for SMS.</p>
            <input
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={formPhone}
              onChange={(e) => setFormPhone(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-900">Alt phone (on form)</label>
            <input
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={altPhone}
              onChange={(e) => setAltPhone(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-900">Email (on form)</label>
          <p className="mt-0.5 text-xs text-slate-500">Pre-filled on the document — separate from email delivery below.</p>
          <input
            type="email"
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            value={formEmail}
            onChange={(e) => setFormEmail(e.target.value)}
          />
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-3">
          <div className="text-sm font-semibold text-slate-900">Authorizations (required to send)</div>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={legalAcknowledged}
              onChange={(e) => setLegalAcknowledged(e.target.checked)}
            />
            <span>Legal authorization confirmed for this client</span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={allHealthAcknowledged}
              onChange={(e) => setAllHealthAcknowledged(e.target.checked)}
            />
            <span>All-health authorization confirmed for this client</span>
          </label>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-4">
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <input type="checkbox" checked={isMinor} onChange={(e) => setIsMinor(e.target.checked)} />
              This is for a minor
            </label>
            <p className="mt-1 text-xs text-slate-500">
              When checked, today&apos;s date is pre-filled on the minor section. The client still completes signatures.
            </p>
          </div>
          {isMinor ? (
            <>
              <div>
                <label className="text-sm font-medium text-slate-900">Authorized representative for minor</label>
                <input
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={nameAuthorizedRepForMinor}
                  onChange={(e) => setNameAuthorizedRepForMinor(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={minorRepParent} onChange={(e) => setMinorRepParent(e.target.checked)} />
                  Parent
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={minorRepGuardian}
                    onChange={(e) => setMinorRepGuardian(e.target.checked)}
                  />
                  Guardian
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={minorRepOther} onChange={(e) => setMinorRepOther(e.target.checked)} />
                  Other
                </label>
              </div>
            </>
          ) : null}
        </div>

        <div className="border-t border-slate-200 pt-5">
          <h2 className="text-sm font-semibold text-slate-900">Delivery</h2>
          <p className="mt-1 text-xs text-slate-500">How to send the signing link to the client.</p>
        </div>

        {(outbound.signingSmsEnabled || outbound.signingEmailEnabled) && (
          <div
            className={
              outbound.signingSmsEnabled && outbound.signingEmailEnabled
                ? "grid gap-4 sm:grid-cols-2"
                : "space-y-4"
            }
          >
            {outbound.signingSmsEnabled ? (
              <div>
                <label className="text-sm font-medium text-slate-900">Delivery phone</label>
                <p className="mt-0.5 text-xs text-slate-500">Include country code (e.g. +1 for US).</p>
                <input
                  required={sendSms && !sendEmail}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={deliveryPhone}
                  onChange={(e) => setDeliveryPhone(e.target.value)}
                  placeholder="+1…"
                />
              </div>
            ) : null}
            {outbound.signingEmailEnabled ? (
              <div>
                <label className="text-sm font-medium text-slate-900">Delivery email</label>
                <input
                  required={sendEmail && !sendSms}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  type="email"
                  value={deliveryEmail}
                  onChange={(e) => setDeliveryEmail(e.target.value)}
                  placeholder="client@email.com"
                />
              </div>
            ) : null}
          </div>
        )}

        {outbound.signingSmsEnabled && outbound.signingEmailEnabled ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
            <div className="text-sm font-semibold text-slate-900">Delivery method</div>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={sendSms} onChange={(e) => setSendSms(e.target.checked)} />
              SMS
            </label>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />
              Email
            </label>
          </div>
        ) : null}

        <label className="flex items-center gap-2 text-sm font-medium text-slate-900">
          <input type="checkbox" checked={reminderEnabled} onChange={(e) => setReminderEnabled(e.target.checked)} />
          Send reminders if they have not signed yet
        </label>

        <button
          disabled={busy || !canDeliver || (!loadingTemplates && templates.length === 0)}
          type="submit"
          className="w-full rounded-xl bg-[color:var(--accent)] px-4 py-3 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50"
        >
          {busy ? "Sending…" : "Send HIPAA form"}
        </button>
      </form>
    </div>
  );
}
