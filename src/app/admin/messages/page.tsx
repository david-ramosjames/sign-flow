"use client";

import { useEffect, useState, startTransition } from "react";
import type { MessageTemplate, MessageTemplateChannel, SupportedLanguage } from "@/types/models";

function MessageEditor({
  m,
  onSaved,
  onCancel,
}: {
  m: MessageTemplate;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(m.name);
  const [channel, setChannel] = useState<MessageTemplateChannel>(m.channel);
  const [language, setLanguage] = useState<SupportedLanguage>(m.language);
  const [body, setBody] = useState(m.body);
  const [active, setActive] = useState(m.active);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="mt-4 space-y-3 border-t border-[color:var(--border)] pt-4">
      {err ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-2 text-xs text-rose-900">{err}</div> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs font-medium text-slate-600">Name</label>
          <input
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-medium text-slate-600">Channel</label>
            <select
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={channel}
              onChange={(e) => setChannel(e.target.value as MessageTemplateChannel)}
            >
              <option value="sms">sms</option>
              <option value="email">email</option>
              <option value="both">both</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Language</label>
            <select
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={language}
              onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}
            >
              <option value="en">EN</option>
              <option value="es">ES</option>
            </select>
          </div>
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-slate-600">Body (merge tokens e.g. {"{{first_name}}"}, {"{{signing_link}}"})</label>
        <textarea
          className="mt-1 min-h-[140px] w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        Active
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          className="rounded-xl bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50"
          onClick={async () => {
            setBusy(true);
            setErr(null);
            const res = await fetch(`/api/message-templates/${m.id}`, {
              method: "PATCH",
              credentials: "include",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ name, channel, language, body, active }),
            });
            setBusy(false);
            if (!res.ok) {
              setErr("Save failed");
              return;
            }
            onSaved();
          }}
        >
          {busy ? "Saving…" : "Save changes"}
        </button>
        <button type="button" className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function AdminMessagesPage() {
  const [items, setItems] = useState<MessageTemplate[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/message-templates", { credentials: "include" });
    if (res.ok) {
      const j = (await res.json()) as { items: MessageTemplate[] };
      startTransition(() => setItems(j.items));
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Message templates</h1>
        <p className="mt-1 text-sm text-[color:var(--muted)]">
          Reminder and outbound copy per channel (supports merge tokens such as <code className="text-xs">{"{{first_name}}"}</code>,{" "}
          <code className="text-xs">{"{{signing_link}}"}</code>).
        </p>
      </div>

      <div className="space-y-3">
        {items.map((m) => (
          <div key={m.id} className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold text-slate-900">{m.name}</div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-xs text-slate-600">
                  {m.channel} · {m.language.toUpperCase()} · {m.active ? "active" : "inactive"}
                </div>
                {editingId !== m.id ? (
                  <button
                    type="button"
                    className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    onClick={() => setEditingId(m.id)}
                  >
                    Edit
                  </button>
                ) : null}
              </div>
            </div>
            {editingId === m.id ? (
              <MessageEditor
                m={m}
                onSaved={() => {
                  setEditingId(null);
                  void refresh();
                }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <pre className="mt-3 whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800">{m.body}</pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
