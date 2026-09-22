import { templateRequiresDateOfLoss } from "@/lib/docuseal-prefill";
import { getFirmDocusealConnection } from "@/lib/firms";
import { slackPostEphemeral, slackPostMessage } from "@/lib/slack/api";
import { slackPublicAppOrigin } from "@/lib/slack/config";
import {
  languageForTemplateName,
  type SlackContractModalMeta,
} from "@/lib/slack/contract-modal";
import { getTemplate } from "@/services/docuseal-client";
import { appendSigningEvent } from "@/services/signing-events";
import { createLeadAndSigningRequest } from "@/server/signing-workflow";

export type SlackViewState = {
  values?: Record<
    string,
    Record<
      string,
      {
        value?: string | null;
        selected_date?: string | null;
        selected_option?: { value?: string };
        selected_options?: { value?: string }[];
      }
    >
  >;
};

type ValidatedContractSubmit = {
  meta: SlackContractModalMeta;
  templateId: number;
  templateName: string;
  clientName: string;
  phone: string;
  email: string | null;
  dateOfLoss: string | null;
  alsoEmail: boolean;
  language: ReturnType<typeof languageForTemplateName>;
};

function fieldValue(state: SlackViewState, blockId: string, actionId = "value"): string {
  return state.values?.[blockId]?.[actionId]?.value?.trim() ?? "";
}

function selectedDate(state: SlackViewState, blockId: string, actionId = "value"): string {
  // Slack datepicker posts selected_date (YYYY-MM-DD), not value.
  return state.values?.[blockId]?.[actionId]?.selected_date?.trim() ?? "";
}

function selectedOption(state: SlackViewState, blockId: string, actionId: string): string {
  return state.values?.[blockId]?.[actionId]?.selected_option?.value?.trim() ?? "";
}

function checkboxYes(state: SlackViewState, blockId: string): boolean {
  const opts = state.values?.[blockId]?.value?.selected_options ?? [];
  return opts.some((o) => o.value === "yes");
}

/** Fast validation only — keep under Slack’s ~3s view_submission budget. */
export async function validateContractModalSubmission(opts: {
  meta: SlackContractModalMeta;
  state: SlackViewState;
}): Promise<{ ok: true; data: ValidatedContractSubmit } | { ok: false; errors: Record<string, string> }> {
  const { meta, state } = opts;
  const templateIdRaw = selectedOption(state, "template", "template_id");
  const templateId = Number(templateIdRaw);
  const clientName = fieldValue(state, "client_name");
  const phone = fieldValue(state, "phone");
  const email = fieldValue(state, "email") || null;
  const dateOfLoss = selectedDate(state, "date_of_loss") || null;
  const alsoEmail = checkboxYes(state, "also_email");

  if (!Number.isFinite(templateId) || templateId <= 0) {
    return { ok: false, errors: { template: "Select a contract template." } };
  }
  if (!clientName) return { ok: false, errors: { client_name: "Client name is required." } };
  if (!phone) {
    return { ok: false, errors: { phone: "Phone is required to text the signing link." } };
  }
  if (alsoEmail && !email) {
    return {
      ok: false,
      errors: { email: "Enter an email address, or uncheck “Also send email.”" },
    };
  }

  const docuseal = await getFirmDocusealConnection(meta.firmId);
  const template = await getTemplate(templateId, docuseal);
  if (templateRequiresDateOfLoss(template.name) && !dateOfLoss) {
    return {
      ok: false,
      errors: { date_of_loss: "Date of loss is required for this contract template." },
    };
  }

  return {
    ok: true,
    data: {
      meta,
      templateId,
      templateName: template.name,
      clientName,
      phone,
      email,
      dateOfLoss,
      alsoEmail,
      language: languageForTemplateName(template.name),
    },
  };
}

/** Send SMS/email and post the Slack confirmation (run via waitUntil after modal clears). */
export async function executeContractModalSend(data: ValidatedContractSubmit): Promise<void> {
  const { meta } = data;
  try {
    const { signingRequest, deliveryWarning } = await createLeadAndSigningRequest(
      {
        clientName: data.clientName,
        phone: data.phone,
        email: data.email,
        language: data.language,
        source: "slack",
        templateId: data.templateId,
        dateOfLoss: data.dateOfLoss,
        hipaaPrefill: null,
        sendSms: true,
        sendEmail: data.alsoEmail && Boolean(data.email),
        reminderEnabled: true,
        assignedTo: meta.userName || null,
        firmId: meta.firmId,
      },
      { sub: `slack:${meta.userId}`, name: meta.userName || "Slack" },
    );

    await appendSigningEvent({
      signingRequestId: signingRequest.id,
      leadId: signingRequest.leadId,
      type: "slack_posted",
      metadata: {
        channelId: meta.channelId,
        userId: meta.userId,
        userName: meta.userName,
      },
    });

    const origin = slackPublicAppOrigin();
    const requestPath = `/dashboard/requests/${signingRequest.id}`;
    const requestLine = origin
      ? `• Request: <${origin}${requestPath}|Open in Sign Flow>`
      : `• Request id: \`${signingRequest.id}\``;

    const lines = [
      `*Contract sent* to *${data.clientName}*`,
      `• Phone: ${data.phone}`,
      data.alsoEmail && data.email ? `• Email: ${data.email}` : null,
      `• Template: ${data.templateName}`,
      requestLine,
      deliveryWarning ? `• Warning: ${deliveryWarning}` : null,
    ].filter(Boolean);

    await slackPostMessage({
      channel: meta.channelId,
      text: lines.join("\n"),
      threadTs: meta.threadTs ?? undefined,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to send contract";
    console.error("[slack/submit] execute failed:", msg);
    await slackPostEphemeral({
      channel: meta.channelId,
      user: meta.userId,
      threadTs: meta.threadTs ?? undefined,
      text: `Could not send contract: ${msg}`,
    }).catch(() => undefined);
  }
}
