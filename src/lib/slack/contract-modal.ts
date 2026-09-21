import {
  filterContractTemplates,
  languageFromContractTemplate,
  templateRequiresDateOfLoss,
} from "@/lib/docuseal-prefill";
import { DEFAULT_FIRM_ID } from "@/lib/firm-scope";
import { getFirmDocusealConnection } from "@/lib/firms";
import { slackApi } from "@/lib/slack/api";
import { slackDefaultFirmId } from "@/lib/slack/config";
import { listTemplates } from "@/services/docuseal-client";
import type { SupportedLanguage } from "@/types/models";

export const SLACK_CONTRACT_CALLBACK_ID = "signflow_send_contract";

/** Private metadata stored on the modal (JSON). */
export type SlackContractModalMeta = {
  channelId: string;
  userId: string;
  userName: string;
  threadTs?: string | null;
  firmId: string;
};

export async function buildContractModalView(meta: SlackContractModalMeta) {
  const firmId = meta.firmId || slackDefaultFirmId() || DEFAULT_FIRM_ID;
  const docuseal = await getFirmDocusealConnection(firmId);
  const templates = filterContractTemplates(await listTemplates(docuseal));
  if (templates.length === 0) {
    throw new Error("No contract templates found in DocuSeal for this firm.");
  }

  const options = templates.slice(0, 100).map((t) => {
    const lang = languageFromContractTemplate(t.name);
    const needsDol = templateRequiresDateOfLoss(t.name);
    return {
      text: { type: "plain_text" as const, text: t.name.slice(0, 75) },
      value: String(t.id),
      description: {
        type: "plain_text" as const,
        text: `${lang === "es" ? "Spanish" : lang === "en" ? "English" : "Contract"}${needsDol ? " · needs date of loss" : ""}`.slice(
          0,
          75,
        ),
      },
    };
  });

  const defaultTemplate =
    templates.find((t) => languageFromContractTemplate(t.name) === "en") ?? templates[0]!;

  return {
    type: "modal" as const,
    callback_id: SLACK_CONTRACT_CALLBACK_ID,
    private_metadata: JSON.stringify({ ...meta, firmId }),
    title: { type: "plain_text" as const, text: "Send contract" },
    submit: { type: "plain_text" as const, text: "Send" },
    close: { type: "plain_text" as const, text: "Cancel" },
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "SMS is sent by default. Add an email only if you also want an email copy.",
        },
      },
      {
        type: "input",
        block_id: "template",
        label: { type: "plain_text", text: "Contract template" },
        element: {
          type: "static_select",
          action_id: "template_id",
          initial_option: options.find((o) => o.value === String(defaultTemplate.id)) ?? options[0],
          options,
        },
      },
      {
        type: "input",
        block_id: "client_name",
        label: { type: "plain_text", text: "Client name" },
        element: {
          type: "plain_text_input",
          action_id: "value",
          placeholder: { type: "plain_text", text: "Jane Doe" },
        },
      },
      {
        type: "input",
        block_id: "phone",
        label: { type: "plain_text", text: "Phone (SMS)" },
        element: {
          type: "plain_text_input",
          action_id: "value",
          placeholder: { type: "plain_text", text: "+1…" },
        },
      },
      {
        type: "input",
        block_id: "date_of_loss",
        optional: true,
        label: { type: "plain_text", text: "Date of loss" },
        hint: { type: "plain_text", text: "Required for 2026 English/Spanish intake contracts." },
        element: {
          type: "datepicker",
          action_id: "value",
        },
      },
      {
        type: "input",
        block_id: "email",
        optional: true,
        label: { type: "plain_text", text: "Email (optional)" },
        element: {
          type: "email_text_input",
          action_id: "value",
          placeholder: { type: "plain_text", text: "client@email.com" },
        },
      },
      {
        type: "input",
        block_id: "also_email",
        optional: true,
        label: { type: "plain_text", text: "Also send email?" },
        element: {
          type: "checkboxes",
          action_id: "value",
          options: [
            {
              text: { type: "plain_text", text: "Send signing link by email too" },
              value: "yes",
            },
          ],
        },
      },
    ],
  };
}

export async function openContractModal(opts: {
  triggerId: string;
  channelId: string;
  userId: string;
  userName: string;
  threadTs?: string | null;
  firmId?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const view = await buildContractModalView({
      channelId: opts.channelId,
      userId: opts.userId,
      userName: opts.userName,
      threadTs: opts.threadTs ?? null,
      firmId: opts.firmId || slackDefaultFirmId(),
    });
    const opened = await slackApi("views.open", {
      trigger_id: opts.triggerId,
      view,
    });
    if (!opened.ok) return { ok: false, error: opened.error };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not open form" };
  }
}

export function languageForTemplateName(templateName: string): SupportedLanguage {
  return languageFromContractTemplate(templateName) ?? "en";
}
