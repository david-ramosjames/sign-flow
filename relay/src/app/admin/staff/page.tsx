"use client";

import { useEffect, useState, startTransition } from "react";
import type { StaffUser } from "@/types/models";

export default function AdminStaffPage() {
  const [items, setItems] = useState<StaffUser[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");

  async function refresh() {
    const res = await fetch("/api/staff", { credentials: "include" });
    if (res.ok) {
      const j = (await res.json()) as { items: StaffUser[] };
      startTransition(() => setItems(j.items));
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Staff users</h1>
        <p className="mt-1 text-sm text-[color:var(--muted)]">
          MVP uses a shared password login. Staff records are used for assignment + merge fields.
        </p>
      </div>

      <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6 shadow-sm">
        <div className="text-sm font-semibold text-slate-900">Add staff</div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <button
          type="button"
          className="mt-4 rounded-xl bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
          onClick={async () => {
            await fetch("/api/staff", {
              method: "POST",
              credentials: "include",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ displayName, email, role: "staff", active: true }),
            });
            setDisplayName("");
            setEmail("");
            await refresh();
          }}
        >
          Save
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] shadow-sm">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--border)]">
            {items.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50/70">
                <td className="px-4 py-3 font-medium text-slate-900">{s.displayName}</td>
                <td className="px-4 py-3 text-slate-700">{s.email}</td>
                <td className="px-4 py-3 text-slate-700">{s.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
