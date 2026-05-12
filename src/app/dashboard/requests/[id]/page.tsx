"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, startTransition } from "react";
import type { DocumentTemplate, RelayEvent, SigningRequest } from "@/types/models";
import { StatusChip } from "@/components/relay/status-chip";

async function postAction(id: string, action: string, note?: string) {
  const res = await fetch(`/api/signing-requests/${id}/actions`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, note }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Action failed");
  return (await res.json()) as { item: SigningRequest };
}

export default function SigningRequestDetailPage() {
  const params = useParams<{ id: string }>();
  const id = String(params.id);
  const [item, setItem] = useState<SigningRequest | null>(null);
  const [template, setTemplate] = useState<DocumentTemplate | null>(null);
  const [events, setEvents] = useState<RelayEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");

  async function refresh() {
    const res = await fetch(`/api/signing-requests/${id}`, { credentials: "include" });
    if (!res.ok) {
      startTransition(() => setError("Not found"));
      return;
    }
    const j = (await res.json()) as { item: SigningRequest; template: DocumentTemplate | null };
    const eRes = await fetch(`/api/signing-requests/${id}/events`, { credentials: "include" });
    const eventsNext = eRes.ok ? (((await eRes.json()) as { events: RelayEvent[] }).events ?? []) : [];
    startTransition(() => {
      setError(null);
      setItem(j.item);
      setTemplate(j.template);
      setEvents(eventsNext);
    });
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (error) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard" className="text-sm font-medium text-[color:var(--accent)] hover:underline">
          Back
        </Link>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">{error}</div>
      </div>
    );
  }

  if (!item) {
    return <div className="text-sm text-slate-600">Loading…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{item.leadFullName}</h1>
            <StatusChip status={item.status} />
          </div>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            Template: <span className="font-medium text-slate-800">{template?.name ?? item.documentTemplateId}</span>
          </p>
        </div>
        <Link href="/dashboard" className="text-sm font-medium text-[color:var(--accent)] hover:underline">
          Back to dashboard
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-5 shadow-sm lg:col-span-1">
          <div className="text-sm font-semibold text-slate-900">Manual actions</div>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm hover:bg-slate-50"
              onClick={async () => {
                try {
                  const j = await postAction(id, "resend_sms");
                  setItem(j.item);
                  await refresh();
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Failed");
                }
              }}
            >
              Resend SMS
            </button>
            {item.deliveryChannels.includes("whatsapp") && item.whatsappConsentConfirmed === true ? (
              <button
                type="button"
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm hover:bg-slate-50"
                onClick={async () => {
                  try {
                    const j = await postAction(id, "resend_whatsapp");
                    setItem(j.item);
                    await refresh();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Failed");
                  }
                }}
              >
                Resend WhatsApp
              </button>
            ) : null}
            <button
              type="button"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm hover:bg-slate-50"
              onClick={async () => {
                try {
                  const j = await postAction(id, "resend_email");
                  setItem(j.item);
                  await refresh();
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Failed");
                }
              }}
            >
              Resend email (mock)
            </button>
            <button
              type="button"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm hover:bg-slate-50"
              onClick={async () => {
                const res = await fetch(`/api/signing-requests/${id}/signing-url`, { credentials: "include" });
                const j = (await res.json()) as { signingUrl?: string; error?: string };
                if (!res.ok) {
                  setError(j.error ?? "No link");
                  return;
                }
                await navigator.clipboard.writeText(j.signingUrl ?? "");
              }}
            >
              Copy signing link
            </button>
            <button
              type="button"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm hover:bg-slate-50"
              onClick={async () => {
                try {
                  const j = await postAction(id, item.remindersPaused ? "resume_reminders" : "pause_reminders");
                  setItem(j.item);
                  await refresh();
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Failed");
                }
              }}
            >
              {item.remindersPaused ? "Resume reminders" : "Pause reminders"}
            </button>
            <button
              type="button"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm hover:bg-slate-50"
              onClick={async () => {
                try {
                  const j = await postAction(id, "cancel_reminders");
                  setItem(j.item);
                  await refresh();
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Failed");
                }
              }}
            >
              Cancel reminder sequence
            </button>
            <button
              type="button"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm hover:bg-slate-50"
              onClick={async () => {
                try {
                  const j = await postAction(id, "mark_contacted");
                  setItem(j.item);
                  await refresh();
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Failed");
                }
              }}
            >
              Mark as contacted
            </button>
          </div>

          <div className="border-t border-[color:var(--border)] pt-4">
            <div className="text-sm font-semibold text-slate-900">Add staff note</div>
            <textarea className="mt-2 min-h-[80px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={note} onChange={(e) => setNote(e.target.value)} />
            <button
              type="button"
              className="mt-2 w-full rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:opacity-95"
              onClick={async () => {
                try {
                  const j = await postAction(id, "add_note", note);
                  setItem(j.item);
                  setNote("");
                  await refresh();
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Failed");
                }
              }}
            >
              Save note
            </button>
          </div>
        </div>

        <div className="space-y-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-5 shadow-sm lg:col-span-2">
          <div className="text-sm font-semibold text-slate-900">Event history</div>
          <div className="space-y-3">
            {events.length === 0 ? <div className="text-sm text-slate-600">No events yet.</div> : null}
            {events.map((ev) => (
              <div key={ev.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-slate-900">{ev.type}</div>
                  <div className="text-xs text-slate-500">{new Date(ev.createdAt).toLocaleString()}</div>
                </div>
                <div className="mt-2 text-sm text-slate-700">{ev.message}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
