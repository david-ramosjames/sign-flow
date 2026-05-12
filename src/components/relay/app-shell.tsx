"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, startTransition } from "react";

const nav = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/new", label: "New retainer" },
  { href: "/admin/settings", label: "Admin" },
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
    <div className="min-h-screen">
      <header className="border-b border-white/10 bg-[color:var(--brand-navy)] text-white shadow-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-white/10 ring-1 ring-white/20">
              {logoFailed ? (
                <span className="text-xs font-bold text-white">RJ</span>
              ) : (
                <Image
                  src="/rj-logo.png"
                  alt="Ramos James Law"
                  width={40}
                  height={40}
                  className="object-contain p-0.5"
                  priority
                  onError={() => setLogoFailed(true)}
                />
              )}
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight">Sign Flow</div>
              <div className="text-xs text-white/70">Ramos James Law · Retainers</div>
            </div>
          </div>
          <nav className="hidden items-center gap-1 sm:flex">
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
          <div className="flex items-center gap-2">
            {showSignOut ? (
              <button
                className="rounded-lg px-3 py-2 text-sm text-white/90 hover:bg-white/10"
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
