import type { AppSettings, CompletionNotificationSettings } from "@/types/models";
import { applyTemplateString, mergeCommunicationTemplates } from "@/lib/messaging";

export const DEFAULT_COMPLETION_NOTIFICATIONS: CompletionNotificationSettings = {
  thankYouSmsEnabled: true,
  thankYouSmsTemplate:
    "Thank you, {{clientName}}! {{firm}} has received your signed documents. We will be in touch if anything else is needed.",
  teamNotificationEmails: "",
  teamCompletedEmailSubjectTemplate: "{{clientName}} signed — {{templateName}}",
  teamCompletedEmailBodyTemplate: `{{clientName}} completed and signed {{templateName}}.

View the signed document:
{{documentUrl}}

— {{firm}}`,
};

export function mergeCompletionNotifications(settings: AppSettings | null): CompletionNotificationSettings {
  return {
    ...DEFAULT_COMPLETION_NOTIFICATIONS,
    ...(settings?.completionNotifications ?? {}),
  };
}

export function parseEmailList(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[,;\n]+/)) {
    const email = part.trim().toLowerCase();
    if (!email || !email.includes("@") || seen.has(email)) continue;
    seen.add(email);
    out.push(email);
  }
  return out;
}

export function thankYouSmsFromSettings(
  settings: AppSettings | null,
  clientName: string,
): string {
  const t = mergeCompletionNotifications(settings);
  const firm = mergeCommunicationTemplates(settings).firmName;
  return applyTemplateString(t.thankYouSmsTemplate, { clientName, firm });
}

export function teamCompletedEmailFromSettings(
  settings: AppSettings | null,
  input: { clientName: string; templateName: string; documentUrl: string },
): { subject: string; text: string } {
  const t = mergeCompletionNotifications(settings);
  const firm = mergeCommunicationTemplates(settings).firmName;
  const vars = {
    clientName: input.clientName,
    templateName: input.templateName,
    documentUrl: input.documentUrl,
    firm,
  };
  return {
    subject: applyTemplateString(t.teamCompletedEmailSubjectTemplate, vars),
    text: applyTemplateString(t.teamCompletedEmailBodyTemplate, vars),
  };
}
