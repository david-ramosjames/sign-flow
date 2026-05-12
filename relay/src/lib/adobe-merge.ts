import type { AdobeMergeFieldKey, DocumentTemplate, SigningRequest, StaffUser } from "@/types/models";
import { nowIso } from "@/lib/time";

export type MergeContext = {
  template: DocumentTemplate;
  request: SigningRequest;
  staff: StaffUser | null;
};

/**
 * Builds a map of merge tokens for Acrobat Sign agreement creation / form field merge.
 * TODO(Phase 2): Map these keys to your Adobe library template field names in `services/adobe.ts`.
 */
export function buildAdobeMergeFields(ctx: MergeContext): Record<AdobeMergeFieldKey, string> {
  const { request, template, staff } = ctx;
  return {
    first_name: request.leadFirstName,
    last_name: request.leadLastName,
    full_name: request.leadFullName,
    phone: request.phone ?? "",
    email: request.email ?? "",
    language: request.language,
    matter_type: template.matterType,
    date_sent: request.lastSentAt ?? nowIso(),
    staff_member: staff?.displayName ?? "",
  };
}
