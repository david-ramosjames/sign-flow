"use client";

import Link from "next/link";
import { useEffect, useState, startTransition } from "react";
import { signOutFirebaseClient } from "@/lib/firebase/client";

const nav = [
  { href: "/dashboard", label: "Requests" },
  { href: "/dashboard/send", label: "Send request" },
  { href: "/dashboard/signed", label: "Signed documents" },
  { href: "/admin", label: "Admin" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const [showSignOut, setShowSignOut] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

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
    <div className="min-h-screen bg-[color:var(--background)]">
      <header className="border-b border-white/10 bg-[color:var(--brand-navy)] text-white shadow-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-white/10 ring-1 ring-white/20">
              {logoFailed ? (
                <span className="text-xs font-bold text-white">RJ</span>
              ) : (
                <img
                  src="/rj-logo.svg"
                  alt="Ramos James Law"
                  width={40}
                  height={40}
                  className="object-contain p-0.5"
                  onError={() => setLogoFailed(true)}
                />
              )}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold tracking-tight">Sign Flow</div>
              <div className="truncate text-xs text-white/70">Ramos James Law · Lead signing</div>
            </div>
          </div>
          <nav className="hidden flex-wrap items-center justify-end gap-1 lg:flex">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="rounded-lg px-3 py-2 text-sm text-white/90 hover:bg-white/10"
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            {showSignOut ? (
              <button
                className="rounded-lg px-3 py-2 text-sm text-white/90 hover:bg-white/10"
                type="button"
                onClick={async () => {
                  await signOutFirebaseClient();
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

      <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
    </div>
  );
}
