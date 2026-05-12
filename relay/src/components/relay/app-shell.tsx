"use client";

import Link from "next/link";
import { useEffect, useState, startTransition } from "react";

const nav = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/new", label: "New request" },
  { href: "/admin/settings", label: "Admin" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const [showSignOut, setShowSignOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (!res.ok || cancelled) return;
      const j = (await res.json()) as { authRequired?: boolean };
      if (j.authRequired) startTransition(() => setShowSignOut(true));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen">
      <header className="border-b border-[color:var(--border)] bg-[color:var(--card)]/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[color:var(--accent)] text-sm font-semibold text-white">
              R
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight">Relay</div>
              <div className="text-xs text-[color:var(--muted)]">Ramos James Law</div>
            </div>
          </div>
          <nav className="hidden items-center gap-2 sm:flex">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            {showSignOut ? (
              <button
                className="rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                type="button"
                onClick={async () => {
                  await fetch("/api/auth/logout", { method: "POST" });
                  window.location.href = "/login";
                }}
              >
                Sign out
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
