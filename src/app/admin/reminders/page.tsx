"use client";

import { useEffect, useState, startTransition } from "react";
import type { ReminderSchedule } from "@/types/models";
import { describeReminderStep } from "@/services/reminder-service";

export default function AdminRemindersPage() {
  const [items, setItems] = useState<ReminderSchedule[]>([]);

  async function refresh() {
    const res = await fetch("/api/reminder-schedules", { credentials: "include" });
    if (res.ok) {
      const j = (await res.json()) as { items: ReminderSchedule[] };
      startTransition(() => setItems(j.items));
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Reminder schedules</h1>
        <p className="mt-1 text-sm text-[color:var(--muted)]">
          Schedules drive retainer follow-up timing. Phase 2 cron will read these steps, re-check Adobe status, then send via Twilio (SMS/WhatsApp) or email.
        </p>
      </div>

      <div className="space-y-4">
        {items.map((s) => (
          <div key={s.id} className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">{s.name}</div>
                <div className="mt-1 text-xs text-slate-600">
                  Max reminders: {s.maxReminders} · Active: {s.active ? "yes" : "no"}
                </div>
              </div>
              <button
                type="button"
                className="text-xs font-medium text-rose-700 hover:underline"
                onClick={async () => {
                  if (!confirm(`Delete schedule “${s.name}”? Signing requests that reference it may need their schedule reassigned.`)) return;
                  const res = await fetch(`/api/reminder-schedules/${s.id}`, { method: "DELETE", credentials: "include" });
                  if (res.ok) await refresh();
                }}
              >
                Delete schedule
              </button>
            </div>
            <ol className="mt-4 space-y-2 text-sm text-slate-700">
              {s.steps.map((st, idx) => (
                <li key={st.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <span className="font-medium text-slate-900">
                    {idx + 1}. {st.channel.toUpperCase()}
                  </span>{" "}
                  — {describeReminderStep(st)}
                </li>
              ))}
            </ol>
            <p className="mt-3 text-xs text-slate-600">
              Updates: PATCH <code className="text-xs">/api/reminder-schedules/[id]</code> (steps editor can be added here later).
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
