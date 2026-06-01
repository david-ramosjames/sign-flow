"use client";

import { Suspense, useEffect, useState, startTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithGooglePopup } from "@/lib/firebase/client";

function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") || "/dashboard";
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [logoFailed, setLogoFailed] = useState(false);

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
          <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-[color:var(--brand-navy)] ring-1 ring-black/10">
            {logoFailed ? (
              <span className="text-xs font-bold text-white">RJ</span>
            ) : (
              <img
                src="/rj-logo.svg"
                alt=""
                width={40}
                height={40}
                className="object-contain p-0.5"
                onError={() => setLogoFailed(true)}
              />
            )}
          </div>
          <div>
            <div className="text-lg font-semibold tracking-tight text-slate-900">Sign Flow</div>
            <div className="text-xs text-[color:var(--muted)]">Ramos James Law · Retainers</div>
          </div>
        </div>

        <p className="mt-4 text-sm text-slate-600">Ramos James Law accounts only.</p>

        {error ? <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</div> : null}

        <div className="mt-6">
          <button
            type="button"
            disabled={busy}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50"
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                const idToken = await signInWithGooglePopup();
                const res = await fetch("/api/auth/session", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({ idToken }),
                });
                if (!res.ok) {
                  const j = (await res.json().catch(() => null)) as { error?: string } | null;
                  setError(j?.error ?? "Sign-in failed");
                  setBusy(false);
                  return;
                }
                router.replace(next);
              } catch (e) {
                const code = typeof e === "object" && e && "code" in e ? String((e as { code?: string }).code) : "";
                if (code === "auth/popup-closed-by-user") {
                  setError("Sign-in was cancelled.");
                } else if (e instanceof Error && e.message.includes("NEXT_PUBLIC_FIREBASE")) {
                  setError("Firebase web config is missing. Add NEXT_PUBLIC_FIREBASE_* variables and restart the dev server.");
                } else {
                  setError(e instanceof Error ? e.message : "Sign-in failed");
                }
                setBusy(false);
              }
            }}
          >
            <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden>
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            {busy ? "Signing in…" : "Continue with Google"}
          </button>
        </div>
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
