"use client";

import { useEffect, useState, startTransition } from "react";
import type { MessageTemplate } from "@/types/models";

export default function AdminMessagesPage() {
  const [items, setItems] = useState<MessageTemplate[]>([]);

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
        <p className="mt-1 text-sm text-[color:var(--muted)]">Reminder copy per channel/language (supports merge tokens like SMS defaults).</p>
      </div>

      <div className="space-y-3">
        {items.map((m) => (
          <div key={m.id} className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold text-slate-900">{m.name}</div>
              <div className="text-xs text-slate-600">
                {m.channel} · {m.language.toUpperCase()} · {m.active ? "active" : "inactive"}
              </div>
            </div>
            <pre className="mt-3 whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800">{m.body}</pre>
          </div>
        ))}
      </div>
    </div>
  );
}
