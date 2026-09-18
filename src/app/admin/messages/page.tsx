"use client";

import { useCallback, useEffect, useMemo, useState, startTransition } from "react";
import type {
  AppSettings,
  CommunicationTemplates,
  CompletionNotificationSettings,
  OutboundDeliverySettings,
  ReminderScheduleSettings,
  ReminderStep,
  SupportedLanguage,
} from "@/types/models";
import { DEFAULT_COMMUNICATION_TEMPLATES, applyTemplateString, reminderEmailFromSettings, reminderSmsFromSettings, signingEmailFromSettings, signingSmsFromSettings } from "@/lib/messaging";
import { templateForLanguage } from "@/lib/message-language";
import { DEFAULT_COMPLETION_NOTIFICATIONS } from "@/lib/completion-notifications";
import { DEFAULT_OUTBOUND_DELIVERY } from "@/lib/outbound-delivery";
import { DEFAULT_REMINDER_SCHEDULE, mergeReminderSchedule, buildDefaultSteps } from "@/lib/reminder-schedule";
import { autoCancelUnsignedAfterDaysFromSettings } from "@/lib/auto-cancel";

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
  return mergeReminderSchedule(base);
}
function mergeOutbound(base: AppSettings | null): OutboundDeliverySettings {
  return { ...DEFAULT_OUTBOUND_DELIVERY, ...(base?.outboundDelivery ?? {}) };
}

function stepLabel(step: ReminderStep): string {
  if (step.day === 0) return `Day 0 — ${step.minutesAfterSend ?? 30}min after send`;
  const hour12 = step.hour > 12 ? step.hour - 12 : step.hour === 0 ? 12 : step.hour;
  return `Day ${step.day} — ${hour12}${step.hour >= 12 ? "PM" : "AM"} CT`;
}

function SequenceEditor({
  title,
  description,
  steps,
  defaultHour,
  onChange,
}: {
  title: string;
  description: string;
  steps: ReminderStep[];
  defaultHour: number;
  onChange: (next: ReminderStep[]) => void;
}) {
  function updateStep(idx: number, patch: Partial<ReminderStep>) {
    const next = [...steps];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  }
  function addStep() {
    const lastDay = steps.length > 0 ? Math.max(...steps.map((s) => s.day)) : 0;
    onChange([...steps, { day: lastDay + 2, hour: defaultHour, smsTemplate: "", smsTemplateEs: "" }]);
  }
  function removeStep(idx: number) {
    if (steps.length <= 1) return;
    onChange(steps.filter((_, i) => i !== idx));
  }

  return (
    <section className="m-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-xs text-slate-600">{description}</p>
      <div className="mt-4 space-y-4">
        {steps.map((step, idx) => (
          <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="text-sm font-medium text-slate-900">
                Step {idx + 1}: {stepLabel(step)}
              </div>
              {steps.length > 1 ? (
                <button type="button" className="text-xs text-rose-600 hover:text-rose-800" onClick={() => removeStep(idx)}>
                  Remove
                </button>
              ) : null}
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="block text-xs font-medium text-slate-600">
                Day
                <input
                  type="number"
                  min={0}
                  max={30}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  value={step.day}
                  onChange={(e) => updateStep(idx, { day: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                />
              </label>
              {step.day === 0 ? (
                <label className="block text-xs font-medium text-slate-600">
                  Minutes after send
                  <input
                    type="number"
                    min={5}
                    max={1440}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                    value={step.minutesAfterSend ?? 30}
                    onChange={(e) => updateStep(idx, { minutesAfterSend: Math.max(5, Number(e.target.value) || 30) })}
                  />
                </label>
              ) : (
                <label className="block text-xs font-medium text-slate-600">
                  Hour (7–20 CT)
                  <input
                    type="number"
                    min={7}
                    max={20}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                    value={step.hour}
                    onChange={(e) => updateStep(idx, { hour: Math.min(20, Math.max(7, Number(e.target.value) || 9)) })}
                  />
                </label>
              )}
            </div>
            <label className="mt-3 block text-xs font-medium text-slate-600">Custom SMS (English) — blank = default reminder</label>
            <textarea
              className="mt-1 min-h-[60px] w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              placeholder="Leave blank to use the default reminder SMS"
              value={step.smsTemplate}
              onChange={(e) => updateStep(idx, { smsTemplate: e.target.value })}
            />
            <label className="mt-2 block text-xs font-medium text-slate-600">Custom SMS (Spanish) — blank = English or default</label>
            <textarea
              className="mt-1 min-h-[60px] w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              placeholder="Leave blank to use English custom or default"
              value={step.smsTemplateEs}
              onChange={(e) => updateStep(idx, { smsTemplateEs: e.target.value })}
            />
          </div>
        ))}
      </div>
      <button
        type="button"
        className="mt-4 rounded-xl border border-dashed border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
        onClick={addStep}
      >
        + Add follow-up step
      </button>
    </section>
  );
}

export default function AdminMessagesPage() {
  const [comm, setComm] = useState<CommunicationTemplates>(DEFAULT_COMMUNICATION_TEMPLATES);
  const [completion, setCompletion] = useState<CompletionNotificationSettings>(DEFAULT_COMPLETION_NOTIFICATIONS);
  const [outbound, setOutbound] = useState<OutboundDeliverySettings>(DEFAULT_OUTBOUND_DELIVERY);
  const [rem, setRem] = useState<ReminderScheduleSettings>(DEFAULT_REMINDER_SCHEDULE);
  const [autoCancelDays, setAutoCancelDays] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewLanguage, setPreviewLanguage] = useState<SupportedLanguage>("en");
  const [sequenceTab, setSequenceTab] = useState<"contract" | "general">("contract");

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
      const days = autoCancelUnsignedAfterDaysFromSettings(j.item);
      setAutoCancelDays(days == null ? "" : String(days));
      setError(null);
    });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const previewVars = useMemo(
    () => ({ ...PREVIEW, firm: comm.firmName, templateName: PREVIEW.templateName, documentUrl: PREVIEW.documentUrl }),
    [comm.firmName],
  );

  const previewSettings = useMemo(
    () => ({ communicationTemplates: comm } as AppSettings),
    [comm],
  );
  const forContractPreview = sequenceTab === "contract";

  const previewSigningSms = useMemo(
    () => signingSmsFromSettings(previewSettings, PREVIEW.clientName, PREVIEW.url, previewLanguage, forContractPreview),
    [previewSettings, previewLanguage, forContractPreview],
  );
  const previewReminderSms = useMemo(
    () => reminderSmsFromSettings(previewSettings, PREVIEW.clientName, PREVIEW.url, previewLanguage, undefined, undefined, forContractPreview),
    [previewSettings, previewLanguage, forContractPreview],
  );
  const previewThankYouSms = useMemo(
    () => applyTemplateString(templateForLanguage(previewLanguage, completion.thankYouSmsTemplate, completion.thankYouSmsTemplateEs), previewVars),
    [completion.thankYouSmsTemplate, completion.thankYouSmsTemplateEs, previewLanguage, previewVars],
  );

  const previewSigningEmail = useMemo(
    () => signingEmailFromSettings(previewSettings, PREVIEW.clientName, PREVIEW.url, previewLanguage, forContractPreview),
    [previewSettings, previewLanguage, forContractPreview],
  );

  const previewReminderEmail = useMemo(
    () => reminderEmailFromSettings(previewSettings, PREVIEW.clientName, PREVIEW.url, previewLanguage, forContractPreview),
    [previewSettings, previewLanguage, forContractPreview],
  );

  const previewTeamEmail = useMemo(() => {
    const subject = applyTemplateString(completion.teamCompletedEmailSubjectTemplate, previewVars);
    const text = applyTemplateString(completion.teamCompletedEmailBodyTemplate, previewVars);
    return { subject, text };
  }, [completion.teamCompletedEmailBodyTemplate, completion.teamCompletedEmailSubjectTemplate, previewVars]);

  const generalSteps = rem.steps ?? buildDefaultSteps(rem.firstReminderAfterSendMinutes, rem.secondReminderLocalHour);
  const contractSteps = rem.contractSteps?.length
    ? rem.contractSteps
    : generalSteps.map((s) => ({ ...s }));
  const previewSequenceSteps = sequenceTab === "contract" ? contractSteps : generalSteps;

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
        autoCancelUnsignedAfterDays: (() => {
          const trimmed = autoCancelDays.trim();
          if (!trimmed) return null;
          const n = Number(trimmed);
          return Number.isFinite(n) ? Math.floor(n) : null;
        })(),
        reminderSchedule: {
          ...rem,
          steps: generalSteps,
          contractSteps,
          followUpDaysAfterSend: generalSteps.filter((s) => s.day > 0).map((s) => s.day),
          firstReminderAfterSendMinutes: generalSteps.find((s) => s.day === 0)?.minutesAfterSend ?? 30,
          maxAutoReminders: Math.max(generalSteps.length, contractSteps.length),
        },
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
      const days = autoCancelUnsignedAfterDaysFromSettings(j.item);
      setAutoCancelDays(days == null ? "" : String(days));
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
          <code className="text-xs">{"{{firm}}"}</code>. When staff choose <strong>Spanish</strong> on the send form, client
          messages use the Spanish templates. Reminders only go out between <strong>7 AM – 8 PM US Central</strong>.
        </p>
      </div>

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</div> : null}
      {savedAt ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">Saved.</div> : null}

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-6">
          {/* ── Firm & delivery ── */}
          <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Firm & delivery channels</h2>
            <label className="mt-4 block text-xs font-medium text-slate-600">
              Firm display name (replaces {"{{firm}}"})
            </label>
            <input className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={comm.firmName} onChange={(e) => setComm((c) => ({ ...c, firmName: e.target.value }))} />
            <label className="mt-4 block text-xs font-medium text-slate-600">Logo image URL (HTML email header)</label>
            <input type="url" placeholder="https://example.com/path/logo.png" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={comm.firmLogoUrl} onChange={(e) => setComm((c) => ({ ...c, firmLogoUrl: e.target.value }))} />
            <label className="mt-4 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={outbound.signingSmsEnabled} onChange={(e) => setOutbound((o) => ({ ...o, signingSmsEnabled: e.target.checked }))} />
              Allow SMS for signing requests
            </label>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={outbound.signingEmailEnabled} onChange={(e) => setOutbound((o) => ({ ...o, signingEmailEnabled: e.target.checked }))} />
              Allow email for signing requests
            </label>
            {!outbound.signingSmsEnabled && !outbound.signingEmailEnabled ? (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                Both channels are off — staff cannot send signing requests until at least one is enabled.
              </p>
            ) : null}

            <div className="mt-5 border-t border-slate-100 pt-4">
              <label className="block text-sm font-medium text-slate-900">
                Auto-cancel unsigned requests after (days)
              </label>
              <p className="mt-0.5 text-xs text-slate-500">
                If a signing request (contract, HIPAA, SAR, disbursement, or other) was sent and still has not been
                signed after this many days, Sign Flow cancels it automatically (reminders stop). Leave blank to
                disable. Checked about every 15 minutes.
              </p>
              <input
                type="number"
                min={1}
                max={365}
                inputMode="numeric"
                placeholder="Off"
                className="mt-2 w-40 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={autoCancelDays}
                onChange={(e) => setAutoCancelDays(e.target.value)}
              />
            </div>
          </section>

          {/* ── SMS SECTION ── */}
          <div className="rounded-2xl border-2 border-blue-200 bg-blue-50/30 p-1">
            <div className="px-5 pt-5 pb-2">
              <h2 className="text-base font-bold text-slate-900">📱 Text messages (SMS)</h2>
              <p className="mt-1 text-xs text-slate-600">Switch between contract and general copy, then edit the sequence for that type.</p>
            </div>
            <div className="m-3 flex gap-2">
              <button
                type="button"
                className={`rounded-xl px-3 py-1.5 text-sm font-medium ${sequenceTab === "contract" ? "bg-[color:var(--brand-navy)] text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}
                onClick={() => setSequenceTab("contract")}
              >
                Contract
              </button>
              <button
                type="button"
                className={`rounded-xl px-3 py-1.5 text-sm font-medium ${sequenceTab === "general" ? "bg-[color:var(--brand-navy)] text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}
                onClick={() => setSequenceTab("general")}
              >
                General
              </button>
            </div>

            {/* Initial send */}
            <section className="m-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900">
                {sequenceTab === "contract" ? "Contract initial send — SMS (English)" : "General initial send — SMS (English)"}
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                {sequenceTab === "contract"
                  ? "Leave blank to use the general initial-send SMS."
                  : "Used for HIPAA, SAR, Disbursement, and other non-contract sends."}
              </p>
              <textarea
                className="mt-3 min-h-[90px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={sequenceTab === "contract" ? comm.signingSmsTemplateContract : comm.signingSmsTemplate}
                onChange={(e) =>
                  setComm((c) =>
                    sequenceTab === "contract"
                      ? { ...c, signingSmsTemplateContract: e.target.value }
                      : { ...c, signingSmsTemplate: e.target.value },
                  )
                }
              />
            </section>
            <section className="m-3 rounded-xl border border-amber-200/80 bg-amber-50/40 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900">
                {sequenceTab === "contract" ? "Contract initial send — SMS (Spanish)" : "General initial send — SMS (Spanish)"}
              </h3>
              <textarea
                className="mt-3 min-h-[90px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={sequenceTab === "contract" ? comm.signingSmsTemplateContractEs : comm.signingSmsTemplateEs}
                onChange={(e) =>
                  setComm((c) =>
                    sequenceTab === "contract"
                      ? { ...c, signingSmsTemplateContractEs: e.target.value }
                      : { ...c, signingSmsTemplateEs: e.target.value },
                  )
                }
              />
            </section>
            <section className="m-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900">
                {sequenceTab === "contract" ? "Contract default reminder — SMS (English)" : "General default reminder — SMS (English)"}
              </h3>
              <p className="mt-1 text-xs text-slate-500">Used for follow-up steps that don’t have their own custom SMS.</p>
              <textarea
                className="mt-3 min-h-[90px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={sequenceTab === "contract" ? comm.reminderSmsTemplateContract : comm.reminderSmsTemplate}
                onChange={(e) =>
                  setComm((c) =>
                    sequenceTab === "contract"
                      ? { ...c, reminderSmsTemplateContract: e.target.value }
                      : { ...c, reminderSmsTemplate: e.target.value },
                  )
                }
              />
            </section>
            <section className="m-3 rounded-xl border border-amber-200/80 bg-amber-50/40 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900">
                {sequenceTab === "contract" ? "Contract default reminder — SMS (Spanish)" : "General default reminder — SMS (Spanish)"}
              </h3>
              <textarea
                className="mt-3 min-h-[90px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={sequenceTab === "contract" ? comm.reminderSmsTemplateContractEs : comm.reminderSmsTemplateEs}
                onChange={(e) =>
                  setComm((c) =>
                    sequenceTab === "contract"
                      ? { ...c, reminderSmsTemplateContractEs: e.target.value }
                      : { ...c, reminderSmsTemplateEs: e.target.value },
                  )
                }
              />
            </section>

            {sequenceTab === "contract" ? (
              <SequenceEditor
                title="Contract follow-ups"
                description="Used when sending a contract. Each row is one automated follow-up after the initial send."
                steps={contractSteps}
                defaultHour={rem.secondReminderLocalHour}
                onChange={(next) => setRem((r) => ({ ...r, contractSteps: next }))}
              />
            ) : (
              <SequenceEditor
                title="General follow-ups"
                description="Used for HIPAA, SAR, Disbursement, and other non-contract sends."
                steps={generalSteps}
                defaultHour={rem.secondReminderLocalHour}
                onChange={(next) => setRem((r) => ({ ...r, steps: next }))}
              />
            )}

            {/* Thank-you SMS */}
            <section className="m-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900">After signing — thank-you SMS (English)</h3>
              <label className="mt-3 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={completion.thankYouSmsEnabled} onChange={(e) => setCompletion((c) => ({ ...c, thankYouSmsEnabled: e.target.checked }))} />
                Send thank-you SMS on completion
              </label>
              <textarea className="mt-3 min-h-[90px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={completion.thankYouSmsTemplate} onChange={(e) => setCompletion((c) => ({ ...c, thankYouSmsTemplate: e.target.value }))} />
            </section>
            <section className="m-3 rounded-xl border border-amber-200/80 bg-amber-50/40 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900">After signing — thank-you SMS (Spanish)</h3>
              <textarea className="mt-3 min-h-[90px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={completion.thankYouSmsTemplateEs} onChange={(e) => setCompletion((c) => ({ ...c, thankYouSmsTemplateEs: e.target.value }))} />
            </section>
          </div>

          {/* ── EMAIL SECTION ── */}
          <div className="rounded-2xl border-2 border-purple-200 bg-purple-50/30 p-1">
            <div className="px-5 pt-5 pb-2">
              <h2 className="text-base font-bold text-slate-900">📧 Email</h2>
              <p className="mt-1 text-xs text-slate-600">Uses the same Contract / General switch as SMS. Team notification is shared.</p>
            </div>
            <div className="m-3 flex gap-2">
              <button
                type="button"
                className={`rounded-xl px-3 py-1.5 text-sm font-medium ${sequenceTab === "contract" ? "bg-[color:var(--brand-navy)] text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}
                onClick={() => setSequenceTab("contract")}
              >
                Contract
              </button>
              <button
                type="button"
                className={`rounded-xl px-3 py-1.5 text-sm font-medium ${sequenceTab === "general" ? "bg-[color:var(--brand-navy)] text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}
                onClick={() => setSequenceTab("general")}
              >
                General
              </button>
            </div>

            <section className="m-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900">
                {sequenceTab === "contract" ? "Contract signing — email (English)" : "General signing — email (English)"}
              </h3>
              {sequenceTab === "contract" ? (
                <p className="mt-1 text-xs text-slate-500">Leave blank to use the general signing email.</p>
              ) : null}
              <label className="mt-3 block text-xs font-medium text-slate-600">Subject</label>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={sequenceTab === "contract" ? comm.signingEmailSubjectTemplateContract : comm.signingEmailSubjectTemplate}
                onChange={(e) =>
                  setComm((c) =>
                    sequenceTab === "contract"
                      ? { ...c, signingEmailSubjectTemplateContract: e.target.value }
                      : { ...c, signingEmailSubjectTemplate: e.target.value },
                  )
                }
              />
              <label className="mt-3 block text-xs font-medium text-slate-600">Body</label>
              <textarea
                className="mt-1 min-h-[140px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={sequenceTab === "contract" ? comm.signingEmailBodyTemplateContract : comm.signingEmailBodyTemplate}
                onChange={(e) =>
                  setComm((c) =>
                    sequenceTab === "contract"
                      ? { ...c, signingEmailBodyTemplateContract: e.target.value }
                      : { ...c, signingEmailBodyTemplate: e.target.value },
                  )
                }
              />
              {sequenceTab === "general" ? (
                <>
                  <label className="mt-4 block text-xs font-medium text-slate-600">HTML email footer (signing + reminders)</label>
                  <textarea className="mt-1 min-h-[90px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={comm.emailHtmlFooterTemplate} onChange={(e) => setComm((c) => ({ ...c, emailHtmlFooterTemplate: e.target.value }))} />
                </>
              ) : null}
            </section>
            <section className="m-3 rounded-xl border border-amber-200/80 bg-amber-50/40 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900">
                {sequenceTab === "contract" ? "Contract signing — email (Spanish)" : "General signing — email (Spanish)"}
              </h3>
              <label className="mt-3 block text-xs font-medium text-slate-600">Subject</label>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={sequenceTab === "contract" ? comm.signingEmailSubjectTemplateContractEs : comm.signingEmailSubjectTemplateEs}
                onChange={(e) =>
                  setComm((c) =>
                    sequenceTab === "contract"
                      ? { ...c, signingEmailSubjectTemplateContractEs: e.target.value }
                      : { ...c, signingEmailSubjectTemplateEs: e.target.value },
                  )
                }
              />
              <label className="mt-3 block text-xs font-medium text-slate-600">Body</label>
              <textarea
                className="mt-1 min-h-[140px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={sequenceTab === "contract" ? comm.signingEmailBodyTemplateContractEs : comm.signingEmailBodyTemplateEs}
                onChange={(e) =>
                  setComm((c) =>
                    sequenceTab === "contract"
                      ? { ...c, signingEmailBodyTemplateContractEs: e.target.value }
                      : { ...c, signingEmailBodyTemplateEs: e.target.value },
                  )
                }
              />
              {sequenceTab === "general" ? (
                <>
                  <label className="mt-4 block text-xs font-medium text-slate-600">HTML email footer (Spanish)</label>
                  <textarea className="mt-1 min-h-[90px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={comm.emailHtmlFooterTemplateEs} onChange={(e) => setComm((c) => ({ ...c, emailHtmlFooterTemplateEs: e.target.value }))} />
                </>
              ) : null}
            </section>
            <section className="m-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900">
                {sequenceTab === "contract" ? "Contract reminder — email (English)" : "General reminder — email (English)"}
              </h3>
              <label className="mt-3 block text-xs font-medium text-slate-600">Subject</label>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={sequenceTab === "contract" ? comm.reminderEmailSubjectTemplateContract : comm.reminderEmailSubjectTemplate}
                onChange={(e) =>
                  setComm((c) =>
                    sequenceTab === "contract"
                      ? { ...c, reminderEmailSubjectTemplateContract: e.target.value }
                      : { ...c, reminderEmailSubjectTemplate: e.target.value },
                  )
                }
              />
              <label className="mt-3 block text-xs font-medium text-slate-600">Body</label>
              <textarea
                className="mt-1 min-h-[140px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={sequenceTab === "contract" ? comm.reminderEmailBodyTemplateContract : comm.reminderEmailBodyTemplate}
                onChange={(e) =>
                  setComm((c) =>
                    sequenceTab === "contract"
                      ? { ...c, reminderEmailBodyTemplateContract: e.target.value }
                      : { ...c, reminderEmailBodyTemplate: e.target.value },
                  )
                }
              />
            </section>
            <section className="m-3 rounded-xl border border-amber-200/80 bg-amber-50/40 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900">
                {sequenceTab === "contract" ? "Contract reminder — email (Spanish)" : "General reminder — email (Spanish)"}
              </h3>
              <label className="mt-3 block text-xs font-medium text-slate-600">Subject</label>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={sequenceTab === "contract" ? comm.reminderEmailSubjectTemplateContractEs : comm.reminderEmailSubjectTemplateEs}
                onChange={(e) =>
                  setComm((c) =>
                    sequenceTab === "contract"
                      ? { ...c, reminderEmailSubjectTemplateContractEs: e.target.value }
                      : { ...c, reminderEmailSubjectTemplateEs: e.target.value },
                  )
                }
              />
              <label className="mt-3 block text-xs font-medium text-slate-600">Body</label>
              <textarea
                className="mt-1 min-h-[140px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={sequenceTab === "contract" ? comm.reminderEmailBodyTemplateContractEs : comm.reminderEmailBodyTemplateEs}
                onChange={(e) =>
                  setComm((c) =>
                    sequenceTab === "contract"
                      ? { ...c, reminderEmailBodyTemplateContractEs: e.target.value }
                      : { ...c, reminderEmailBodyTemplateEs: e.target.value },
                  )
                }
              />
            </section>
            <section className="m-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900">After signing — team email</h3>
              <p className="mt-1 text-xs text-slate-600">
                Each address receives its own email with the signed PDF when available.
              </p>
              <label className="mt-4 block text-xs font-medium text-slate-600">Team emails (comma or newline separated)</label>
              <textarea className="mt-1 min-h-[72px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="paralegal@firm.com, attorney@firm.com" value={completion.teamNotificationEmails} onChange={(e) => setCompletion((c) => ({ ...c, teamNotificationEmails: e.target.value }))} />
              <label className="mt-4 block text-xs font-medium text-slate-600">Subject</label>
              <input className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={completion.teamCompletedEmailSubjectTemplate} onChange={(e) => setCompletion((c) => ({ ...c, teamCompletedEmailSubjectTemplate: e.target.value }))} />
              <label className="mt-3 block text-xs font-medium text-slate-600">Body</label>
              <textarea className="mt-1 min-h-[140px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={completion.teamCompletedEmailBodyTemplate} onChange={(e) => setCompletion((c) => ({ ...c, teamCompletedEmailBodyTemplate: e.target.value }))} />
            </section>
          </div>

          {/* ── Save / reload ── */}
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={saving} onClick={() => save()} className="rounded-xl bg-[color:var(--brand-navy)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50">
              {saving ? "Saving…" : "Save to Firestore"}
            </button>
            <button type="button" onClick={() => load()} className="rounded-xl border border-[color:var(--border)] bg-white px-4 py-2.5 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50">
              Reload
            </button>
          </div>
        </div>

        {/* ── PREVIEW COLUMN ── */}
        <div className="space-y-4 lg:sticky lg:top-8 lg:self-start">
          <div className="rounded-2xl border border-[color:var(--border)] bg-slate-50 p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Preview</h2>
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" name="previewLang" checked={previewLanguage === "en"} onChange={() => setPreviewLanguage("en")} /> English
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="previewLang" checked={previewLanguage === "es"} onChange={() => setPreviewLanguage("es")} /> Spanish
              </label>
            </div>
            <p className="mt-2 text-xs text-slate-600">
              Sample: <strong>{PREVIEW.clientName}</strong>, link <span className="break-all">{PREVIEW.url}</span>
            </p>
            <div className="mt-4 space-y-4 text-sm">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                  {forContractPreview ? "Contract" : "General"} signing SMS
                </div>
                <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-white p-3 text-xs text-slate-800 ring-1 ring-slate-200">{previewSigningSms}</pre>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                  {forContractPreview ? "Contract" : "General"} default reminder SMS
                </div>
                <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-white p-3 text-xs text-slate-800 ring-1 ring-slate-200">{previewReminderSms}</pre>
              </div>
              {previewSequenceSteps.map((step, idx) =>
                step.smsTemplate.trim() ? (
                  <div key={`${sequenceTab}-${idx}`}>
                    <div className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                      {sequenceTab === "contract" ? "Contract" : "General"} step {idx + 1} custom SMS
                    </div>
                    <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-white p-3 text-xs text-slate-800 ring-1 ring-slate-200">
                      {applyTemplateString(templateForLanguage(previewLanguage, step.smsTemplate, step.smsTemplateEs), previewVars)}
                    </pre>
                  </div>
                ) : null,
              )}
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-blue-600">Thank-you SMS</div>
                <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-white p-3 text-xs text-slate-800 ring-1 ring-slate-200">{previewThankYouSms}</pre>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-purple-600">Signing email</div>
                <div className="mt-2 rounded-lg bg-white p-3 text-xs ring-1 ring-slate-200">
                  <div className="font-semibold text-slate-900">{previewSigningEmail.subject}</div>
                  <pre className="mt-2 whitespace-pre-wrap text-slate-800">{previewSigningEmail.text}</pre>
                  <p className="mt-4 text-[11px] font-medium uppercase tracking-wide text-slate-500">HTML preview</p>
                  <iframe title="Signing email HTML preview" srcDoc={previewSigningEmail.html} className="mt-2 h-[min(480px,65vh)] w-full rounded-lg border border-slate-200 bg-white" />
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-purple-600">Reminder email</div>
                <div className="mt-2 rounded-lg bg-white p-3 text-xs ring-1 ring-slate-200">
                  <div className="font-semibold text-slate-900">{previewReminderEmail.subject}</div>
                  <pre className="mt-2 whitespace-pre-wrap text-slate-800">{previewReminderEmail.text}</pre>
                  <p className="mt-4 text-[11px] font-medium uppercase tracking-wide text-slate-500">HTML preview</p>
                  <iframe title="Reminder email HTML preview" srcDoc={previewReminderEmail.html} className="mt-2 h-[min(480px,65vh)] w-full rounded-lg border border-slate-200 bg-white" />
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-purple-600">Team completion email</div>
                <div className="mt-2 rounded-lg bg-white p-3 text-xs ring-1 ring-slate-200">
                  <div className="font-semibold text-slate-900">{previewTeamEmail.subject}</div>
                  <pre className="mt-2 whitespace-pre-wrap text-slate-800">{previewTeamEmail.text}</pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
