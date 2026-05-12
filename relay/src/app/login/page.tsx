"use client";

import { Suspense, useEffect, useState, startTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") || "/dashboard";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (cancelled) return;
      if (res.ok) {
        router.replace(next);
        return;
      }
      startTransition(() => setChecking(false));
    })();
    return () => {
      cancelled = true;
    };
  }, [next, router]);

  if (checking) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
        <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-8 text-center text-sm text-slate-600 shadow-sm">
          Checking access…
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-8 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[color:var(--accent)] text-sm font-semibold text-white">R</div>
          <div>
            <div className="text-lg font-semibold tracking-tight">Relay</div>
            <div className="text-xs text-[color:var(--muted)]">Ramos James Law — internal</div>
          </div>
        </div>

        <p className="mt-4 text-sm text-slate-600">Sign in to continue.</p>

        {error ? <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</div> : null}

        <form
          className="mt-6 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            const res = await fetch("/api/auth/login", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ password }),
            });
            setBusy(false);
            if (!res.ok) {
              const j = (await res.json().catch(() => null)) as { error?: string } | null;
              setError(j?.error ?? "Login failed");
              return;
            }
            router.replace(next);
          }}
        >
          <div>
            <label className="text-sm font-medium text-slate-900">Password</label>
            <input
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <button
            disabled={busy}
            className="w-full rounded-xl bg-[color:var(--accent)] px-4 py-3 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50"
            type="submit"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-sm text-slate-600">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}
