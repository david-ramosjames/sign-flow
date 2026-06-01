"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, startTransition } from "react";
import { format } from "date-fns";
import type { Lead, OutboundDeliverySettings, SigningEvent, SigningRequest, SigningStatus } from "@/types/models";
import { DEFAULT_OUTBOUND_DELIVERY } from "@/lib/outbound-delivery";
import { postSigningResend } from "@/lib/post-signing-resend";
import { StatusChip } from "@/components/sign-flow/status-chip";

export default function SigningRequestDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = String(params.id);
  const [item, setItem] = useState<SigningRequest | null>(null);
  const [lead, setLead] = useState<Lead | null>(null);
  const [events, setEvents] = useState<SigningEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; ok: boolean } | null>(null);
  const [resendBusy, setResendBusy] = useState<"sms" | "email" | null>(null);
  const [syncBusy, setSyncBusy] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [purgeBusy, setPurgeBusy] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [outbound, setOutbound] = useState<OutboundDeliverySettings>(DEFAULT_OUTBOUND_DELIVERY);

  const isCancelled = item?.status === "cancelled";

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/signing-requests/${id}`, { credentials: "include" });
    if (!res.ok) {
      startTransition(() => setError("Not found"));
      return;
    }
    const j = (await res.json()) as { item: SigningRequest; lead: Lead | null };
    const eRes = await fetch(`/api/signing-requests/${id}/events`, { credentials: "include" });
    const eventsNext = eRes.ok ? (((await eRes.json()) as { events: SigningEvent[] }).events ?? []) : [];
    startTransition(() => {
      setError(null);
      setItem(j.item);
      setLead(j.lead);
      setEvents(eventsNext);
    });
  }, [id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    void (async () => {
      const meRes = await fetch("/api/auth/me", { credentials: "include" });
      if (meRes.ok) {
        const me = (await meRes.json()) as { isAdmin?: boolean };
        startTransition(() => setIsAdmin(Boolean(me.isAdmin)));
      }
    })();
  }, []);

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

  if (error || !item) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-900">
        {error ?? "Loading…"}{" "}
        <Link href="/dashboard" className="font-medium text-rose-950 underline">
          Back
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/dashboard" className="text-xs font-medium text-[color:var(--accent)] hover:underline">
            ← All requests
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{item.clientName}</h1>
          <p className="text-sm text-[color:var(--muted)]">
            {item.templateName} · DocuSeal submission {item.docusealSubmissionId ?? "—"}
          </p>
        </div>
        <StatusChip status={item.status as SigningStatus} />
      </div>

      {feedback ? (
        <div
          className={`rounded-xl border p-3 text-sm ${
            feedback.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-rose-200 bg-rose-50 text-rose-900 whitespace-pre-wrap"
          }`}
        >
          {feedback.text}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-5 shadow-sm lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-900">Details</h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase text-slate-500">Phone</dt>
              <dd className="text-slate-800">{item.phone ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-slate-500">Email</dt>
              <dd className="text-slate-800">{item.email ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-slate-500">Language</dt>
              <dd className="text-slate-800">{item.language}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-slate-500">Lead source</dt>
              <dd className="text-slate-800">{lead?.source ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-slate-500">Sent</dt>
              <dd className="text-slate-800">{item.sentAt ? format(new Date(item.sentAt), "MMM d, yyyy h:mm a") : "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-slate-500">Next reminder</dt>
              <dd className="text-slate-800">{item.nextReminderAt ? format(new Date(item.nextReminderAt), "MMM d, h:mm a") : "—"}</dd>
            </div>
          </dl>
          {item.signingUrl ? (
            <a
              href={item.signingUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex rounded-xl bg-[color:var(--brand-navy)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-95"
            >
              Open signing link
            </a>
          ) : null}
        </div>

        <div className="space-y-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Actions</h2>
          <button
            type="button"
            disabled={
              isCancelled || !item.signingUrl || !item.phone?.trim() || !outbound.signingSmsEnabled || resendBusy !== null
            }
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={async () => {
              setFeedback(null);
              setResendBusy("sms");
              const out = await postSigningResend(id, { sms: true, email: false });
              setResendBusy(null);
              setFeedback(out.ok ? { ok: true, text: "SMS resent." } : { ok: false, text: out.error });
              if (out.ok) void refresh();
            }}
          >
            {resendBusy === "sms" ? "Sending SMS…" : "Retry SMS"}
          </button>
          <button
            type="button"
            disabled={
              isCancelled ||
              !item.signingUrl ||
              !item.email?.trim() ||
              !outbound.signingEmailEnabled ||
              resendBusy !== null
            }
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={async () => {
              setFeedback(null);
              setResendBusy("email");
              const out = await postSigningResend(id, { sms: false, email: true });
              setResendBusy(null);
              setFeedback(out.ok ? { ok: true, text: "Email resent." } : { ok: false, text: out.error });
              if (out.ok) void refresh();
            }}
          >
            {resendBusy === "email" ? "Sending email…" : "Retry email"}
          </button>
          <button
            type="button"
            disabled={!item.docusealSubmissionId || syncBusy}
            className="w-full rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-950 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={async () => {
              setFeedback(null);
              setSyncBusy(true);
              const res = await fetch(`/api/signing-requests/${id}/sync-docuseal`, {
                method: "POST",
                credentials: "include",
              });
              setSyncBusy(false);
              if (!res.ok) {
                const j = (await res.json().catch(() => null)) as { error?: string } | null;
                setFeedback({ ok: false, text: j?.error ?? "Could not sync from DocuSeal." });
                return;
              }
              setFeedback({
                ok: true,
                text: "Synced from DocuSeal. Status, thank-you SMS, and team emails run if configured.",
              });
              void refresh();
            }}
          >
            {syncBusy ? "Syncing from DocuSeal…" : "Refresh from DocuSeal"}
          </button>
          <button
            type="button"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
            onClick={async () => {
              setFeedback(null);
              const res = await fetch(`/api/signing-requests/${id}/sync-dropbox`, { method: "POST", credentials: "include" });
              setFeedback(res.ok ? { ok: true, text: "Dropbox sync complete." } : { ok: false, text: "Dropbox sync failed." });
              void refresh();
            }}
          >
            Re-sync to Dropbox
          </button>
          <button
            type="button"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
            onClick={async () => {
              setFeedback(null);
              const res = await fetch(`/api/signing-requests/${id}/post-slack`, { method: "POST", credentials: "include" });
              setFeedback(res.ok ? { ok: true, text: "Posted to Slack." } : { ok: false, text: "Slack post failed." });
              void refresh();
            }}
          >
            Post to Slack
          </button>
          {!isCancelled && item.status !== "completed" ? (
            <button
              type="button"
              disabled={cancelBusy}
              className="w-full rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-40"
              onClick={async () => {
                if (
                  !window.confirm(
                    `Cancel this signing request for ${item.clientName}? It will stay on the list as cancelled and reminders will stop.`,
                  )
                ) {
                  return;
                }
                setFeedback(null);
                setCancelBusy(true);
                const res = await fetch(`/api/signing-requests/${id}/cancel`, {
                  method: "POST",
                  credentials: "include",
                });
                setCancelBusy(false);
                if (!res.ok) {
                  const j = (await res.json().catch(() => null)) as { error?: string } | null;
                  setFeedback({ ok: false, text: j?.error ?? "Could not cancel request." });
                  return;
                }
                setFeedback({ ok: true, text: "Request cancelled." });
                void refresh();
              }}
            >
              {cancelBusy ? "Cancelling…" : "Cancel request"}
            </button>
          ) : null}
          {isAdmin ? (
            <button
              type="button"
              disabled={purgeBusy}
              className="w-full rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-950 hover:bg-rose-100 disabled:opacity-40"
              onClick={async () => {
                if (
                  !window.confirm(
                    `Permanently delete this signing request for ${item.clientName}? It will be removed completely from Sign Flow. This cannot be undone.`,
                  )
                ) {
                  return;
                }
                setFeedback(null);
                setPurgeBusy(true);
                const res = await fetch(`/api/signing-requests/${id}`, {
                  method: "DELETE",
                  credentials: "include",
                });
                setPurgeBusy(false);
                if (!res.ok) {
                  const j = (await res.json().catch(() => null)) as { error?: string } | null;
                  setFeedback({ ok: false, text: j?.error ?? "Could not delete request." });
                  return;
                }
                router.push("/dashboard");
              }}
            >
              {purgeBusy ? "Deleting…" : "Delete permanently (admin)"}
            </button>
          ) : null}
          {isCancelled ? (
            <p className="text-xs text-slate-500">Cancelled — no further reminders or resends.</p>
          ) : item.status === "completed" ? (
            <p className="text-xs text-slate-500">Completed requests cannot be cancelled.</p>
          ) : (
            <p className="text-xs text-slate-500">
              Cancel keeps the request on the dashboard. Admins can delete permanently.
            </p>
          )}
        </div>
      </div>

      {(item.signedPdfUrl || item.auditCertificateUrl) && (
        <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Signed files (DocuSeal)</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-sky-800">
            {item.signedPdfUrl ? (
              <li>
                <a href={item.signedPdfUrl} target="_blank" rel="noreferrer" className="hover:underline">
                  Signed PDF
                </a>
              </li>
            ) : null}
            {item.auditCertificateUrl ? (
              <li>
                <a href={item.auditCertificateUrl} target="_blank" rel="noreferrer" className="hover:underline">
                  Audit certificate
                </a>
              </li>
            ) : null}
          </ul>
        </div>
      )}

      <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Activity</h2>
        <ul className="mt-4 space-y-3">
          {events.map((ev) => (
            <li key={ev.id} className="border-b border-slate-100 pb-3 text-sm last:border-0">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium capitalize text-slate-900">{ev.type.replace(/_/g, " ")}</span>
                <span className="text-xs text-slate-500">{format(new Date(ev.timestamp), "MMM d, yyyy h:mm:ss a")}</span>
              </div>
              {Object.keys(ev.metadata).length ? (
                <pre className="mt-1 max-h-24 overflow-auto rounded-lg bg-slate-50 p-2 text-[11px] text-slate-700">
                  {JSON.stringify(ev.metadata, null, 2)}
                </pre>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
