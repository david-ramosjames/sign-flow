import type { DocumentTemplate, MessageTemplate } from "@/types/models";
import { nowIso, newId } from "@/lib/time";
import { DEFAULT_SMS_EN, DEFAULT_SMS_ES } from "@/lib/default-messages";

export function seedDocumentTemplates(): DocumentTemplate[] {
  const t = nowIso();
  const mk = (partial: Omit<DocumentTemplate, "id" | "createdAt" | "updatedAt">): DocumentTemplate => ({
    id: newId("tpl"),
    createdAt: t,
    updatedAt: t,
    ...partial,
  });

  return [
    mk({
      name: "Ramos James Retainer Agreement",
      adobeLibraryDocumentId: "ADOBE_LIBRARY_DOC_ID_PLACEHOLDER_RETAINER",
      adobeWorkflowId: null,
      description: "Primary retainer for new matters.",
      matterType: "General PI",
      language: "en",
      requiredFields: ["first_name", "last_name", "email", "phone"],
      active: true,
    }),
    mk({
      name: "Power of Attorney / Authorization",
      adobeLibraryDocumentId: "ADOBE_LIBRARY_DOC_ID_PLACEHOLDER_POA",
      adobeWorkflowId: null,
      description: "Authorization to obtain records and represent.",
      matterType: "Authorization",
      language: "en",
      requiredFields: ["first_name", "last_name", "full_name"],
      active: true,
    }),
    mk({
      name: "Medical Authorization",
      adobeLibraryDocumentId: "ADOBE_LIBRARY_DOC_ID_PLACEHOLDER_MEDAUTH",
      adobeWorkflowId: null,
      description: "HIPAA-style medical records authorization (configure exact Adobe template).",
      matterType: "Medical",
      language: "en",
      requiredFields: ["first_name", "last_name", "full_name", "date_sent"],
      active: true,
    }),
    mk({
      name: "Trucking Chicas Retainer Agreement",
      adobeLibraryDocumentId: "ADOBE_LIBRARY_DOC_ID_PLACEHOLDER_TRUCKING",
      adobeWorkflowId: null,
      description: "Campaign-specific retainer — replace library document ID with production asset.",
      matterType: "Trucking / Campaign",
      language: "en",
      requiredFields: ["first_name", "last_name", "phone"],
      active: true,
    }),
    mk({
      name: "Spanish Retainer Agreement",
      adobeLibraryDocumentId: "ADOBE_LIBRARY_DOC_ID_PLACEHOLDER_ES_RETAINER",
      adobeWorkflowId: null,
      description: "Spanish language retainer template.",
      matterType: "General PI",
      language: "es",
      requiredFields: ["first_name", "last_name", "phone", "email"],
      active: true,
    }),
  ];
}

export function seedMessageTemplates(): MessageTemplate[] {
  const t = nowIso();
  const mk = (partial: Omit<MessageTemplate, "id" | "createdAt" | "updatedAt">): MessageTemplate => ({
    id: newId("msgtpl"),
    createdAt: t,
    updatedAt: t,
    ...partial,
  });
  return [
    mk({
      name: "Initial SMS — English",
      channel: "sms",
      language: "en",
      body: DEFAULT_SMS_EN,
      active: true,
    }),
    mk({
      name: "Initial SMS — Spanish",
      channel: "sms",
      language: "es",
      body: DEFAULT_SMS_ES,
      active: true,
    }),
  ];
}
