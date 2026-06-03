import type { AppSettings, CompletionNotificationSettings, SupportedLanguage } from "@/types/models";
import { applyTemplateString, mergeCommunicationTemplates } from "@/lib/messaging";
import { templateForLanguage } from "@/lib/message-language";

export const DEFAULT_COMPLETION_NOTIFICATIONS: CompletionNotificationSettings = {
  thankYouSmsEnabled: true,
  thankYouSmsTemplate:
    "Thank you, {{clientName}}! {{firm}} has received your signed documents. We will be in touch if anything else is needed.",
  thankYouSmsTemplateEs:
    "¡Gracias, {{clientName}}! {{firm}} recibió sus documentos firmados. Nos pondremos en contacto si necesitamos algo más.",
  teamNotificationEmails: "",
  teamCompletedEmailSubjectTemplate: "{{clientName}} signed - {{templateName}}",
  teamCompletedEmailBodyTemplate: `{{clientName}} completed and signed {{templateName}}.

View the signed document:
{{documentUrl}}

- {{firm}}`,
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
  language: SupportedLanguage = "en",
): string {
  const t = mergeCompletionNotifications(settings);
  const firm = mergeCommunicationTemplates(settings).firmName;
  const template = templateForLanguage(language, t.thankYouSmsTemplate, t.thankYouSmsTemplateEs);
  return applyTemplateString(template, { clientName, firm });
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
