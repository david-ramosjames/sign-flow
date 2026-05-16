import type { AppSettings, CommunicationTemplates } from "@/types/models";
import { buildBrandedEmailHtml, getEmailAssetBaseUrl, splitEmailBodyAroundUrl } from "@/lib/email-html-layout";

/** Default when `firmName` is absent in stored settings (legacy rows). */
export const FIRM = "Ramos James Law";

export const DEFAULT_COMMUNICATION_TEMPLATES: CommunicationTemplates = {
  firmName: FIRM,
  firmLogoUrl: "",
  signingSmsTemplate:
    "Hi {{clientName}}, this is {{firm}}. Please review and sign your documents here: {{url}}. Reply STOP to opt out.",
  signingEmailSubjectTemplate: "Documents to Review and Sign",
  signingEmailBodyTemplate: `Hi {{clientName}},

Please review and sign your documents using the button in this email.

If you have questions, contact {{firm}}.

Thank you.

{{url}}`,
  emailHtmlFooterTemplate: `{{firm}}

Need help? Reply to this email or contact your attorney directly.`,
  reminderSmsTemplate:
    "Reminder from {{firm}} for {{clientName}}: please complete your documents here: {{url}}. Reply STOP to opt out.",
  reminderEmailSubjectTemplate: "Reminder: documents awaiting your signature",
  reminderEmailBodyTemplate: `Hi {{clientName}},

This is a friendly reminder to review and sign your documents — use the button in this email when you are ready.

{{url}}

— {{firm}}`,
};

export function mergeCommunicationTemplates(settings: AppSettings | null): CommunicationTemplates {
  const o = settings?.communicationTemplates;
  if (!o) return { ...DEFAULT_COMMUNICATION_TEMPLATES };
  return {
    ...DEFAULT_COMMUNICATION_TEMPLATES,
    ...o,
  };
}

export function applyTemplateString(template: string, vars: { clientName: string; url: string; firm?: string }): string {
  const firm = (vars.firm ?? FIRM).trim() || FIRM;
  return template
    .replaceAll("{{clientName}}", vars.clientName)
    .replaceAll("{{url}}", vars.url)
    .replaceAll("{{firm}}", firm);
}

export function signingSmsFromSettings(settings: AppSettings | null, clientName: string, url: string): string {
  const t = mergeCommunicationTemplates(settings);
  return applyTemplateString(t.signingSmsTemplate, { clientName, url, firm: t.firmName });
}

export function signingEmailFromSettings(
  settings: AppSettings | null,
  clientName: string,
  url: string,
): { subject: string; text: string; html: string } {
  const t = mergeCommunicationTemplates(settings);
  const firm = t.firmName;
  const subject = applyTemplateString(t.signingEmailSubjectTemplate, { clientName, url, firm });
  const text = applyTemplateString(t.signingEmailBodyTemplate, { clientName, url, firm });
  const { before, after } = splitEmailBodyAroundUrl(text, url);
  const footerPlain = applyTemplateString(t.emailHtmlFooterTemplate, { clientName, url, firm });
  const html = buildBrandedEmailHtml({
    kind: "signing",
    beforeUrlPlain: before,
    afterUrlPlain: after,
    signingUrl: url,
    firm,
    firmLogoUrl: t.firmLogoUrl?.trim() || null,
    footerPlain,
    assetBaseUrl: getEmailAssetBaseUrl(),
  });
  return { subject, text, html };
}

export function reminderSmsFromSettings(settings: AppSettings | null, clientName: string, url: string): string {
  const t = mergeCommunicationTemplates(settings);
  return applyTemplateString(t.reminderSmsTemplate, { clientName, url, firm: t.firmName });
}

export function reminderEmailFromSettings(
  settings: AppSettings | null,
  clientName: string,
  url: string,
): { subject: string; text: string; html: string } {
  const t = mergeCommunicationTemplates(settings);
  const firm = t.firmName;
  const subject = applyTemplateString(t.reminderEmailSubjectTemplate, { clientName, url, firm });
  const text = applyTemplateString(t.reminderEmailBodyTemplate, { clientName, url, firm });
  const { before, after } = splitEmailBodyAroundUrl(text, url);
  const footerPlain = applyTemplateString(t.emailHtmlFooterTemplate, { clientName, url, firm });
  const html = buildBrandedEmailHtml({
    kind: "reminder",
    beforeUrlPlain: before,
    afterUrlPlain: after,
    signingUrl: url,
    firm,
    firmLogoUrl: t.firmLogoUrl?.trim() || null,
    footerPlain,
    assetBaseUrl: getEmailAssetBaseUrl(),
  });
  return { subject, text, html };
}
