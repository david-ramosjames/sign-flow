"use client";

import { useEffect, useState, startTransition } from "react";

type SettingsResponse = {
  item: {
    id: "default";
    adobeClientIdLast4: string | null;
    twilioConfigured: boolean;
    smsFromNumberOrService: string | null;
    defaultLanguage: "en" | "es";
    slackWebhookConfigured: boolean;
    updatedAt: string;
  } | null;
  env: Record<string, boolean>;
};

export default function AdminSettingsPage() {
  const [data, setData] = useState<SettingsResponse | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/app-settings", { credentials: "include" });
      if (res.ok) {
        const json = (await res.json()) as SettingsResponse;
        startTransition(() => setData(json));
      }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Integrations</h1>
        <p className="mt-1 text-sm text-[color:var(--muted)]">
          Credentials are never stored in Firestore. Use environment variables in hosting (Vercel, Cloud Run, etc.).
        </p>
      </div>

      <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6 shadow-sm">
        <div className="text-sm font-semibold text-slate-900">Environment checklist</div>
        <ul className="mt-4 space-y-2 text-sm text-slate-700">
          {data ? (
            Object.entries(data.env).map(([k, v]) => (
              <li key={k} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
                <code className="text-xs">{k}</code>
                <span className={v ? "text-emerald-700" : "text-slate-500"}>{v ? "present" : "missing"}</span>
              </li>
            ))
          ) : (
            <li className="text-sm text-slate-600">Loading…</li>
          )}
        </ul>
        <div className="mt-4 text-xs text-slate-600">
          Required for Phase 2: <code>ADOBE_*</code> and <code>TWILIO_*</code>. Optional: <code>SLACK_WEBHOOK_URL</code>,{" "}
          <code>CRON_SECRET</code>.
        </div>
      </div>

      <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6 shadow-sm">
        <div className="text-sm font-semibold text-slate-900">Firebase (Firestore)</div>
        <p className="mt-2 text-sm text-slate-700">
          Server routes use <code className="text-xs">firebase-admin</code> with:
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
          <li>
            <code className="text-xs">FIREBASE_PROJECT_ID</code>
          </li>
          <li>
            <code className="text-xs">FIREBASE_CLIENT_EMAIL</code>
          </li>
          <li>
            <code className="text-xs">FIREBASE_PRIVATE_KEY</code> (escape newlines as <code>\n</code>)
          </li>
        </ul>
        <p className="mt-3 text-xs text-slate-600">
          For local demos without Firebase, omit these — Sign Flow falls back to an in-memory store (data resets on restart).
        </p>
      </div>
    </div>
  );
}
