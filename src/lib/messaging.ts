import type { AppSettings, CommunicationTemplates, SupportedLanguage } from "@/types/models";
import { buildBrandedEmailHtml, getEmailAssetBaseUrl, splitEmailBodyAroundUrl } from "@/lib/email-html-layout";
import { templateForLanguage } from "@/lib/message-language";

/** Default when `firmName` is absent in stored settings (legacy rows). */
export const FIRM = "Ramos James Law";

export const DEFAULT_COMMUNICATION_TEMPLATES: CommunicationTemplates = {
  firmName: FIRM,
  firmLogoUrl: "",
  signingSmsTemplate:
    "Hi {{clientName}}, this is {{firm}}. Please review and sign your documents here: {{url}}. Reply STOP to stop reminder texts (your signing link stays active).",
  signingEmailSubjectTemplate: "Documents to Review and Sign",
  signingEmailBodyTemplate: `Hi {{clientName}},

Please review and sign your documents using the button in this email.

If you have questions, contact {{firm}}.

Thank you.

{{url}}`,
  emailHtmlFooterTemplate: `{{firm}}

Need help? Reply to this email or contact your attorney directly.`,
  reminderSmsTemplate:
    "Reminder from {{firm}} for {{clientName}}: please complete your documents here: {{url}}. Reply STOP to stop reminder texts (your signing link stays active).",
  reminderEmailSubjectTemplate: "Reminder: documents awaiting your signature",
  reminderEmailBodyTemplate: `Hi {{clientName}},

This is a friendly reminder to review and sign your documents — use the button in this email when you are ready.

{{url}}

— {{firm}}`,
  signingSmsTemplateEs:
    "Hola {{clientName}}, le escribimos de {{firm}}. Por favor revise y firme sus documentos aquí: {{url}}. Responda ALTO para detener recordatorios (el enlace sigue activo).",
  signingEmailSubjectTemplateEs: "Documentos para revisar y firmar",
  signingEmailBodyTemplateEs: `Hola {{clientName}},

Por favor revise y firme sus documentos usando el botón en este correo.

Si tiene preguntas, comuníquese con {{firm}}.

Gracias.

{{url}}`,
  emailHtmlFooterTemplateEs: `{{firm}}

¿Necesita ayuda? Responda a este correo o comuníquese con su abogado.`,
  reminderSmsTemplateEs:
    "Recordatorio de {{firm}} para {{clientName}}: complete sus documentos aquí: {{url}}. Responda ALTO para detener recordatorios (el enlace sigue activo).",
  reminderEmailSubjectTemplateEs: "Recordatorio: documentos pendientes de firma",
  reminderEmailBodyTemplateEs: `Hola {{clientName}},

Le recordamos amablemente que revise y firme sus documentos — use el botón en este correo cuando esté listo.

{{url}}

— {{firm}}`,
  signingSmsTemplateContract: "",
  signingSmsTemplateContractEs: "",
  reminderSmsTemplateContract: "",
  reminderSmsTemplateContractEs: "",
  signingEmailSubjectTemplateContract: "",
  signingEmailBodyTemplateContract: "",
  signingEmailSubjectTemplateContractEs: "",
  signingEmailBodyTemplateContractEs: "",
  reminderEmailSubjectTemplateContract: "",
  reminderEmailBodyTemplateContract: "",
  reminderEmailSubjectTemplateContractEs: "",
  reminderEmailBodyTemplateContractEs: "",
};

function orGeneral(specific: string | undefined, general: string): string {
  const s = specific?.trim();
  return s ? specific! : general;
}

function pickLang(
  language: SupportedLanguage,
  forContract: boolean,
  en: string,
  es: string,
  enContract: string,
  esContract: string,
): string {
  const english = forContract ? orGeneral(enContract, en) : en;
  const spanish = forContract ? orGeneral(esContract, es) : es;
  return templateForLanguage(language, english, spanish);
}

export function mergeCommunicationTemplates(settings: AppSettings | null): CommunicationTemplates {
  const o = settings?.communicationTemplates;
  if (!o) return { ...DEFAULT_COMMUNICATION_TEMPLATES };
  return {
    ...DEFAULT_COMMUNICATION_TEMPLATES,
    ...o,
  };
}

export function applyTemplateString(
  template: string,
  vars: {
    clientName: string;
    url?: string;
    firm?: string;
    templateName?: string;
    documentUrl?: string;
  },
): string {
  const firm = (vars.firm ?? FIRM).trim() || FIRM;
  return template
    .replaceAll("{{clientName}}", vars.clientName)
    .replaceAll("{{url}}", vars.url ?? "")
    .replaceAll("{{firm}}", firm)
    .replaceAll("{{templateName}}", vars.templateName ?? "")
    .replaceAll("{{documentUrl}}", vars.documentUrl ?? "");
}

export function signingSmsFromSettings(
  settings: AppSettings | null,
  clientName: string,
  url: string,
  language: SupportedLanguage = "en",
  forContract = false,
): string {
  const t = mergeCommunicationTemplates(settings);
  const template = pickLang(
    language,
    forContract,
    t.signingSmsTemplate,
    t.signingSmsTemplateEs,
    t.signingSmsTemplateContract,
    t.signingSmsTemplateContractEs,
  );
  return applyTemplateString(template, { clientName, url, firm: t.firmName });
}

export function signingEmailFromSettings(
  settings: AppSettings | null,
  clientName: string,
  url: string,
  language: SupportedLanguage = "en",
  forContract = false,
): { subject: string; text: string; html: string } {
  const t = mergeCommunicationTemplates(settings);
  const firm = t.firmName;
  const subject = applyTemplateString(
    pickLang(
      language,
      forContract,
      t.signingEmailSubjectTemplate,
      t.signingEmailSubjectTemplateEs,
      t.signingEmailSubjectTemplateContract,
      t.signingEmailSubjectTemplateContractEs,
    ),
    { clientName, url, firm },
  );
  const text = applyTemplateString(
    pickLang(
      language,
      forContract,
      t.signingEmailBodyTemplate,
      t.signingEmailBodyTemplateEs,
      t.signingEmailBodyTemplateContract,
      t.signingEmailBodyTemplateContractEs,
    ),
    { clientName, url, firm },
  );
  const { before, after } = splitEmailBodyAroundUrl(text, url);
  const footerPlain = applyTemplateString(
    templateForLanguage(language, t.emailHtmlFooterTemplate, t.emailHtmlFooterTemplateEs),
    { clientName, url, firm },
  );
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

export function reminderSmsFromSettings(
  settings: AppSettings | null,
  clientName: string,
  url: string,
  language: SupportedLanguage = "en",
  /** Index into the active sequence’s `steps` for per-step template override. */
  reminderIndex?: number,
  /** Resolved schedule for this request’s form kind (contract vs general). */
  schedule?: { steps?: { smsTemplate: string; smsTemplateEs: string }[] },
  forContract = false,
): string {
  const t = mergeCommunicationTemplates(settings);
  const steps = schedule?.steps ?? settings?.reminderSchedule?.steps;
  if (reminderIndex != null && steps) {
    const step = steps[reminderIndex];
    if (step) {
      const stepTpl = templateForLanguage(language, step.smsTemplate, step.smsTemplateEs);
      if (stepTpl.trim()) {
        return applyTemplateString(stepTpl, { clientName, url, firm: t.firmName });
      }
    }
  }
  const template = pickLang(
    language,
    forContract,
    t.reminderSmsTemplate,
    t.reminderSmsTemplateEs,
    t.reminderSmsTemplateContract,
    t.reminderSmsTemplateContractEs,
  );
  return applyTemplateString(template, { clientName, url, firm: t.firmName });
}

export function reminderEmailFromSettings(
  settings: AppSettings | null,
  clientName: string,
  url: string,
  language: SupportedLanguage = "en",
  forContract = false,
): { subject: string; text: string; html: string } {
  const t = mergeCommunicationTemplates(settings);
  const firm = t.firmName;
  const subject = applyTemplateString(
    pickLang(
      language,
      forContract,
      t.reminderEmailSubjectTemplate,
      t.reminderEmailSubjectTemplateEs,
      t.reminderEmailSubjectTemplateContract,
      t.reminderEmailSubjectTemplateContractEs,
    ),
    { clientName, url, firm },
  );
  const text = applyTemplateString(
    pickLang(
      language,
      forContract,
      t.reminderEmailBodyTemplate,
      t.reminderEmailBodyTemplateEs,
      t.reminderEmailBodyTemplateContract,
      t.reminderEmailBodyTemplateContractEs,
    ),
    { clientName, url, firm },
  );
  const { before, after } = splitEmailBodyAroundUrl(text, url);
  const footerPlain = applyTemplateString(
    templateForLanguage(language, t.emailHtmlFooterTemplate, t.emailHtmlFooterTemplateEs),
    { clientName, url, firm },
  );
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
