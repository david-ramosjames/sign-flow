import { templateRequiresDateOfLoss } from "@/lib/docuseal-prefill";
import { getFirmDocusealConnection } from "@/lib/firms";
import { slackPostEphemeral, slackPostMessage } from "@/lib/slack/api";
import {
  languageForTemplateName,
  type SlackContractModalMeta,
} from "@/lib/slack/contract-modal";
import { getTemplate } from "@/services/docuseal-client";
import { appendSigningEvent } from "@/services/signing-events";
import { createLeadAndSigningRequest } from "@/server/signing-workflow";

type SlackViewState = {
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

export async function handleContractModalSubmission(opts: {
  meta: SlackContractModalMeta;
  state: SlackViewState;
}): Promise<{ ok: true } | { ok: false; errors: Record<string, string> }> {
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

  const language = languageForTemplateName(template.name);

  try {
    const { signingRequest, deliveryWarning } = await createLeadAndSigningRequest(
      {
        clientName,
        phone,
        email,
        language,
        source: "slack",
        templateId,
        dateOfLoss,
        hipaaPrefill: null,
        sendSms: true,
        sendEmail: alsoEmail && Boolean(email),
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

    const appOrigin =
      process.env.SIGNFLOW_EMAIL_PUBLIC_ORIGIN?.trim() ||
      process.env.NEXT_PUBLIC_SIGNFLOW_EMAIL_PUBLIC_ORIGIN?.trim() ||
      "";
    const requestPath = `/dashboard/requests/${signingRequest.id}`;
    const requestUrl = appOrigin ? `${appOrigin.replace(/\/$/, "")}${requestPath}` : requestPath;

    const lines = [
      `*Contract sent* to *${clientName}*`,
      `• Phone: ${phone}`,
      alsoEmail && email ? `• Email: ${email}` : null,
      `• Template: ${template.name}`,
      `• Request: <${requestUrl}|Open in Sign Flow>`,
      deliveryWarning ? `• Warning: ${deliveryWarning}` : null,
    ].filter(Boolean);

    await slackPostMessage({
      channel: meta.channelId,
      text: lines.join("\n"),
      threadTs: meta.threadTs ?? undefined,
    });

    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to send contract";
    await slackPostEphemeral({
      channel: meta.channelId,
      user: meta.userId,
      text: `Could not send contract: ${msg}`,
    }).catch(() => undefined);
    return { ok: false, errors: { client_name: msg } };
  }
}
