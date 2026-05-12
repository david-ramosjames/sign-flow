import type { SupportedLanguage } from "@/types/models";

export const DEFAULT_SMS_EN =
  "Hi {{first_name}}, this is Ramos James Law. Please review and sign your retainer agreement here: {{signing_link}}. Reply STOP to opt out.";

export const DEFAULT_SMS_ES =
  "Hola {{first_name}}, somos Ramos James Law. Puede revisar y firmar su acuerdo de retención aquí: {{signing_link}}. Responda STOP para dejar de recibir mensajes.";

export function interpolateSmsTemplate(
  template: string,
  vars: { first_name: string; signing_link: string },
): string {
  return template.replace(/\{\{\s*first_name\s*\}\}/gi, vars.first_name).replace(/\{\{\s*signing_link\s*\}\}/gi, vars.signing_link);
}

export function defaultSmsBody(language: SupportedLanguage, firstName: string, signingLink: string): string {
  const tpl = language === "es" ? DEFAULT_SMS_ES : DEFAULT_SMS_EN;
  return interpolateSmsTemplate(tpl, { first_name: firstName, signing_link: signingLink });
}
