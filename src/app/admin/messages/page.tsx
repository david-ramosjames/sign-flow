"use client";

import { useCallback, useEffect, useMemo, useState, startTransition } from "react";
import type {
  AppSettings,
  CommunicationTemplates,
  CompletionNotificationSettings,
  OutboundDeliverySettings,
  ReminderScheduleSettings,
} from "@/types/models";
import { DEFAULT_COMMUNICATION_TEMPLATES, applyTemplateString } from "@/lib/messaging";
import { DEFAULT_COMPLETION_NOTIFICATIONS } from "@/lib/completion-notifications";
import { DEFAULT_OUTBOUND_DELIVERY } from "@/lib/outbound-delivery";
import { buildBrandedEmailHtml, splitEmailBodyAroundUrl } from "@/lib/email-html-layout";
import { DEFAULT_REMINDER_SCHEDULE } from "@/lib/reminder-schedule";

const PREVIEW = {
  clientName: "Jane Client",
  url: "https://sign.example/doc/abc123",
  templateName: "Retainer Agreement",
  documentUrl: "https://docuseal.example/signed/abc.pdf",
};

function mergeComm(base: AppSettings | null): CommunicationTemplates {
  return { ...DEFAULT_COMMUNICATION_TEMPLATES, ...(base?.communicationTemplates ?? {}) };
}

function mergeCompletion(base: AppSettings | null): CompletionNotificationSettings {
  return { ...DEFAULT_COMPLETION_NOTIFICATIONS, ...(base?.completionNotifications ?? {}) };
}

function mergeRem(base: AppSettings | null): ReminderScheduleSettings {
  return { ...DEFAULT_REMINDER_SCHEDULE, ...(base?.reminderSchedule ?? {}) };
}

function mergeOutbound(base: AppSettings | null): OutboundDeliverySettings {
  return { ...DEFAULT_OUTBOUND_DELIVERY, ...(base?.outboundDelivery ?? {}) };
}

export default function AdminMessagesPage() {
  const [comm, setComm] = useState<CommunicationTemplates>(DEFAULT_COMMUNICATION_TEMPLATES);
  const [completion, setCompletion] = useState<CompletionNotificationSettings>(DEFAULT_COMPLETION_NOTIFICATIONS);
  const [outbound, setOutbound] = useState<OutboundDeliverySettings>(DEFAULT_OUTBOUND_DELIVERY);
  const [rem, setRem] = useState<ReminderScheduleSettings>(DEFAULT_REMINDER_SCHEDULE);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [previewEmailAssetBase, setPreviewEmailAssetBase] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/app-settings", { credentials: "include" });
    if (!res.ok) {
      startTransition(() => setError("Could not load settings"));
      return;
    }
    const j = (await res.json()) as { item: AppSettings | null };
    startTransition(() => {
      setComm(mergeComm(j.item));
      setCompletion(mergeCompletion(j.item));
      setOutbound(mergeOutbound(j.item));
      setRem(mergeRem(j.item));
      setError(null);
    });
  }, []);

  useEffect(() => {
    setPreviewEmailAssetBase(
      process.env.NEXT_PUBLIC_SIGNFLOW_EMAIL_PUBLIC_ORIGIN?.trim().replace(/\/+$/, "") || null,
    );
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const previewVars = useMemo(
    () => ({
      ...PREVIEW,
      firm: comm.firmName,
      templateName: PREVIEW.templateName,
      documentUrl: PREVIEW.documentUrl,
    }),
    [comm.firmName],
  );

  const previewSigningSms = useMemo(
    () => applyTemplateString(comm.signingSmsTemplate, previewVars),
    [comm.signingSmsTemplate, previewVars],
  );
  const previewSigningEmail = useMemo(() => {
    const subject = applyTemplateString(comm.signingEmailSubjectTemplate, previewVars);
    const text = applyTemplateString(comm.signingEmailBodyTemplate, previewVars);
    const { before, after } = splitEmailBodyAroundUrl(text, PREVIEW.url);
    const footerPlain = applyTemplateString(comm.emailHtmlFooterTemplate, previewVars);
    const html = buildBrandedEmailHtml({
      kind: "signing",
      beforeUrlPlain: before,
      afterUrlPlain: after,
      signingUrl: PREVIEW.url,
      firm: comm.firmName,
      firmLogoUrl: comm.firmLogoUrl?.trim() || null,
      footerPlain,
      assetBaseUrl: previewEmailAssetBase,
    });
    return { subject, text, html };
  }, [
    comm.signingEmailBodyTemplate,
    comm.signingEmailSubjectTemplate,
    comm.emailHtmlFooterTemplate,
    comm.firmName,
    comm.firmLogoUrl,
    previewEmailAssetBase,
    previewVars,
  ]);
  const previewReminderSms = useMemo(
    () => applyTemplateString(comm.reminderSmsTemplate, previewVars),
    [comm.reminderSmsTemplate, previewVars],
  );
  const previewReminderEmail = useMemo(() => {
    const subject = applyTemplateString(comm.reminderEmailSubjectTemplate, previewVars);
    const text = applyTemplateString(comm.reminderEmailBodyTemplate, previewVars);
    const { before, after } = splitEmailBodyAroundUrl(text, PREVIEW.url);
    const footerPlain = applyTemplateString(comm.emailHtmlFooterTemplate, previewVars);
    const html = buildBrandedEmailHtml({
      kind: "reminder",
      beforeUrlPlain: before,
      afterUrlPlain: after,
      signingUrl: PREVIEW.url,
      firm: comm.firmName,
      firmLogoUrl: comm.firmLogoUrl?.trim() || null,
      footerPlain,
      assetBaseUrl: previewEmailAssetBase,
    });
    return { subject, text, html };
  }, [
    comm.reminderEmailBodyTemplate,
    comm.reminderEmailSubjectTemplate,
    comm.emailHtmlFooterTemplate,
    comm.firmName,
    comm.firmLogoUrl,
    previewEmailAssetBase,
    previewVars,
  ]);

  const previewThankYouSms = useMemo(
    () => applyTemplateString(completion.thankYouSmsTemplate, previewVars),
    [completion.thankYouSmsTemplate, previewVars],
  );
  const previewTeamEmail = useMemo(() => {
    const subject = applyTemplateString(completion.teamCompletedEmailSubjectTemplate, previewVars);
    const text = applyTemplateString(completion.teamCompletedEmailBodyTemplate, previewVars);
    return { subject, text };
  }, [
    completion.teamCompletedEmailBodyTemplate,
    completion.teamCompletedEmailSubjectTemplate,
    previewVars,
  ]);

  async function save() {
    setSaving(true);
    setSavedAt(null);
    const res = await fetch("/api/app-settings", {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        communicationTemplates: comm,
        completionNotifications: completion,
        outboundDelivery: outbound,
        reminderSchedule: rem,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as { error?: unknown } | null;
      startTransition(() => setError(JSON.stringify(j?.error ?? "Save failed")));
      return;
    }
    const j = (await res.json()) as { item: AppSettings };
    startTransition(() => {
      setComm(mergeComm(j.item));
      setCompletion(mergeCompletion(j.item));
      setOutbound(mergeOutbound(j.item));
      setRem(mergeRem(j.item));
      setSavedAt(new Date().toISOString());
      setError(null);
    });
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Messages & reminders</h1>
        <p className="mt-1 max-w-2xl text-sm text-[color:var(--muted)]">
          Templates use <code className="text-xs">{"{{clientName}}"}</code>, <code className="text-xs">{"{{url}}"}</code>,{" "}
          <code className="text-xs">{"{{firm}}"}</code>, and for completion emails{" "}
          <code className="text-xs">{"{{templateName}}"}</code>, <code className="text-xs">{"{{documentUrl}}"}</code>. HTML
          emails use a branded layout with a button; include{" "}
          <code className="text-xs">{"{{url}}"}</code> in the plain body so the link still appears in the text part and for splitting
          around the button. Set{" "}
          <code className="text-xs">NEXT_PUBLIC_SIGNFLOW_EMAIL_PUBLIC_ORIGIN</code> in <code className="text-xs">.env</code> to preview the
          hosted logo here. For real sends, set <code className="text-xs">SIGNFLOW_EMAIL_PUBLIC_ORIGIN</code> on the server (same value,
          your deployed app origin) so clients see <code className="text-xs">/rj-logo.svg</code>. Reminder timing uses the server
          timezone for the “next morning” step.
        </p>
      </div>

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</div> : null}
      {savedAt ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">Saved.</div>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-6">
          <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Signing request delivery</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              Controls SMS and email when <strong>sending signing links</strong> to clients (new requests, resends, and
              reminders). Does <strong>not</strong> affect thank-you SMS or team emails after a document is signed.
            </p>
            <label className="mt-4 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={outbound.signingSmsEnabled}
                onChange={(e) => setOutbound((o) => ({ ...o, signingSmsEnabled: e.target.checked }))}
              />
              Allow SMS for signing requests
            </label>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={outbound.signingEmailEnabled}
                onChange={(e) => setOutbound((o) => ({ ...o, signingEmailEnabled: e.target.checked }))}
              />
              Allow email for signing requests
            </label>
            {!outbound.signingSmsEnabled && !outbound.signingEmailEnabled ? (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                Both channels are off — staff cannot send signing requests until at least one is enabled.
              </p>
            ) : null}
          </section>
          <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Firm & logo</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              Put <code className="text-[11px]">{"{{firm}}"}</code> in any template where you want the firm name. The replacement text
              is <strong>Firm display name</strong> below (you do not type the name inside each template unless you also use the
              placeholder). <strong>Logo URL</strong> is used as the image in HTML emails; leave blank to use your hosted{" "}
              <code className="text-[11px]">/rj-logo.svg</code> when <code className="text-[11px]">SIGNFLOW_EMAIL_PUBLIC_ORIGIN</code>{" "}
              is set.
            </p>
            <label className="mt-4 block text-xs font-medium text-slate-600">Firm display name (replaces {"{{firm}}"})</label>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={comm.firmName}
              onChange={(e) => setComm((c) => ({ ...c, firmName: e.target.value }))}
            />
            <label className="mt-4 block text-xs font-medium text-slate-600">Logo image URL (HTML email header)</label>
            <input
              type="url"
              placeholder="https://example.com/path/logo.png"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={comm.firmLogoUrl}
              onChange={(e) => setComm((c) => ({ ...c, firmLogoUrl: e.target.value }))}
            />
          </section>
          <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Signing — SMS</h2>
            <textarea
              className="mt-3 min-h-[100px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={comm.signingSmsTemplate}
              onChange={(e) => setComm((c) => ({ ...c, signingSmsTemplate: e.target.value }))}
            />
          </section>
          <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Signing — email</h2>
            <label className="mt-3 block text-xs font-medium text-slate-600">Subject</label>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={comm.signingEmailSubjectTemplate}
              onChange={(e) => setComm((c) => ({ ...c, signingEmailSubjectTemplate: e.target.value }))}
            />
            <label className="mt-3 block text-xs font-medium text-slate-600">Body</label>
            <textarea
              className="mt-1 min-h-[140px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={comm.signingEmailBodyTemplate}
              onChange={(e) => setComm((c) => ({ ...c, signingEmailBodyTemplate: e.target.value }))}
            />
            <label className="mt-4 block text-xs font-medium text-slate-600">HTML email footer (signing + reminders)</label>
            <p className="mt-1 text-[11px] leading-snug text-slate-500">
              Plain text, shown in the branded HTML layout below a divider. Same placeholders as the body.
            </p>
            <textarea
              className="mt-1 min-h-[100px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={comm.emailHtmlFooterTemplate}
              onChange={(e) => setComm((c) => ({ ...c, emailHtmlFooterTemplate: e.target.value }))}
            />
          </section>
          <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">After signing — thank-you SMS</h2>
            <p className="mt-1 text-xs text-slate-600">
              Sent to the client&apos;s phone when DocuSeal marks the submission completed. Placeholders:{" "}
              <code className="text-[11px]">{"{{clientName}}"}</code>, <code className="text-[11px]">{"{{firm}}"}</code>.
            </p>
            <label className="mt-4 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={completion.thankYouSmsEnabled}
                onChange={(e) => setCompletion((c) => ({ ...c, thankYouSmsEnabled: e.target.checked }))}
              />
              Send thank-you SMS on completion
            </label>
            <textarea
              className="mt-3 min-h-[100px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={completion.thankYouSmsTemplate}
              onChange={(e) => setCompletion((c) => ({ ...c, thankYouSmsTemplate: e.target.value }))}
            />
          </section>
          <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">After signing — team email</h2>
            <p className="mt-1 text-xs text-slate-600">
              Notifies your team when a document is signed. One email per address below. Placeholders:{" "}
              <code className="text-[11px]">{"{{clientName}}"}</code>, <code className="text-[11px]">{"{{templateName}}"}</code>,{" "}
              <code className="text-[11px]">{"{{documentUrl}}"}</code>, <code className="text-[11px]">{"{{firm}}"}</code>.
            </p>
            <label className="mt-4 block text-xs font-medium text-slate-600">Team emails (comma or newline separated)</label>
            <textarea
              className="mt-1 min-h-[72px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="paralegal@firm.com, attorney@firm.com"
              value={completion.teamNotificationEmails}
              onChange={(e) => setCompletion((c) => ({ ...c, teamNotificationEmails: e.target.value }))}
            />
            <label className="mt-4 block text-xs font-medium text-slate-600">Subject</label>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={completion.teamCompletedEmailSubjectTemplate}
              onChange={(e) => setCompletion((c) => ({ ...c, teamCompletedEmailSubjectTemplate: e.target.value }))}
            />
            <label className="mt-3 block text-xs font-medium text-slate-600">Body</label>
            <textarea
              className="mt-1 min-h-[140px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={completion.teamCompletedEmailBodyTemplate}
              onChange={(e) => setCompletion((c) => ({ ...c, teamCompletedEmailBodyTemplate: e.target.value }))}
            />
          </section>
          <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Reminder — SMS</h2>
            <textarea
              className="mt-3 min-h-[100px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={comm.reminderSmsTemplate}
              onChange={(e) => setComm((c) => ({ ...c, reminderSmsTemplate: e.target.value }))}
            />
          </section>
          <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Reminder — email</h2>
            <label className="mt-3 block text-xs font-medium text-slate-600">Subject</label>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={comm.reminderEmailSubjectTemplate}
              onChange={(e) => setComm((c) => ({ ...c, reminderEmailSubjectTemplate: e.target.value }))}
            />
            <label className="mt-3 block text-xs font-medium text-slate-600">Body</label>
            <textarea
              className="mt-1 min-h-[140px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={comm.reminderEmailBodyTemplate}
              onChange={(e) => setComm((c) => ({ ...c, reminderEmailBodyTemplate: e.target.value }))}
            />
          </section>
          <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Reminder schedule</h2>
            <p className="mt-1 text-xs text-slate-600">
              After the initial send: first nudge, then next calendar morning at the hour below (after the first step), then hours
              after that morning.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-medium text-slate-600">
                First reminder (minutes after send)
                <input
                  type="number"
                  min={5}
                  max={10080}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={rem.firstReminderAfterSendMinutes}
                  onChange={(e) => setRem((r) => ({ ...r, firstReminderAfterSendMinutes: Number(e.target.value) || 30 }))}
                />
              </label>
              <label className="block text-xs font-medium text-slate-600">
                Second reminder — local hour (0–23)
                <input
                  type="number"
                  min={0}
                  max={23}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={rem.secondReminderLocalHour}
                  onChange={(e) => setRem((r) => ({ ...r, secondReminderLocalHour: Number(e.target.value) || 9 }))}
                />
              </label>
              <label className="block text-xs font-medium text-slate-600">
                Third reminder (hours after second slot)
                <input
                  type="number"
                  min={1}
                  max={168}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={rem.thirdReminderHoursAfterSecond}
                  onChange={(e) => setRem((r) => ({ ...r, thirdReminderHoursAfterSecond: Number(e.target.value) || 24 }))}
                />
              </label>
              <label className="block text-xs font-medium text-slate-600">
                Max auto reminders
                <input
                  type="number"
                  min={1}
                  max={10}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={rem.maxAutoReminders}
                  onChange={(e) => setRem((r) => ({ ...r, maxAutoReminders: Number(e.target.value) || 3 }))}
                />
              </label>
            </div>
          </section>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => save()}
              className="rounded-xl bg-[color:var(--brand-navy)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save to Firestore"}
            </button>
            <button
              type="button"
              onClick={() => load()}
              className="rounded-xl border border-[color:var(--border)] bg-white px-4 py-2.5 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
            >
              Reload
            </button>
          </div>
        </div>

        <div className="space-y-4 lg:sticky lg:top-8 lg:self-start">
          <div className="rounded-2xl border border-[color:var(--border)] bg-slate-50 p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Preview</h2>
            <p className="mt-1 text-xs text-slate-600">
              Sample: <strong>{PREVIEW.clientName}</strong>, link <span className="break-all">{PREVIEW.url}</span>
            </p>
            <div className="mt-4 space-y-4 text-sm">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Thank-you SMS</div>
                <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-white p-3 text-xs text-slate-800 ring-1 ring-slate-200">
                  {previewThankYouSms}
                </pre>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Team completion email</div>
                <div className="mt-2 rounded-lg bg-white p-3 text-xs ring-1 ring-slate-200">
                  <div className="font-semibold text-slate-900">{previewTeamEmail.subject}</div>
                  <pre className="mt-2 whitespace-pre-wrap text-slate-800">{previewTeamEmail.text}</pre>
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Signing SMS</div>
                <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-white p-3 text-xs text-slate-800 ring-1 ring-slate-200">
                  {previewSigningSms}
                </pre>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Signing email</div>
                <div className="mt-2 rounded-lg bg-white p-3 text-xs ring-1 ring-slate-200">
                  <div className="font-semibold text-slate-900">{previewSigningEmail.subject}</div>
                  <p className="mt-1 text-[11px] text-slate-500">Plain text (all inboxes)</p>
                  <pre className="mt-2 whitespace-pre-wrap text-slate-800">{previewSigningEmail.text}</pre>
                  <p className="mt-4 text-[11px] font-medium uppercase tracking-wide text-slate-500">HTML preview</p>
                  <iframe
                    title="Signing email HTML preview"
                    srcDoc={previewSigningEmail.html}
                    className="mt-2 h-[min(480px,65vh)] w-full rounded-lg border border-slate-200 bg-white"
                  />
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reminder SMS</div>
                <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-white p-3 text-xs text-slate-800 ring-1 ring-slate-200">
                  {previewReminderSms}
                </pre>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reminder email</div>
                <div className="mt-2 rounded-lg bg-white p-3 text-xs ring-1 ring-slate-200">
                  <div className="font-semibold text-slate-900">{previewReminderEmail.subject}</div>
                  <p className="mt-1 text-[11px] text-slate-500">Plain text (all inboxes)</p>
                  <pre className="mt-2 whitespace-pre-wrap text-slate-800">{previewReminderEmail.text}</pre>
                  <p className="mt-4 text-[11px] font-medium uppercase tracking-wide text-slate-500">HTML preview</p>
                  <iframe
                    title="Reminder email HTML preview"
                    srcDoc={previewReminderEmail.html}
                    className="mt-2 h-[min(480px,65vh)] w-full rounded-lg border border-slate-200 bg-white"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
