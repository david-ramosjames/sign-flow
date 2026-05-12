import type { RelayEvent, EventType } from "@/types/models";
import { getRelayStore } from "@/lib/db";
import { newId, nowIso } from "@/lib/time";

export async function appendRelayEvent(input: {
  signingRequestId: string;
  type: EventType;
  message: string;
  metadata?: Record<string, unknown>;
  createdBy?: string | null;
}): Promise<RelayEvent> {
  const store = getRelayStore();
  const ev: RelayEvent = {
    id: newId("evt"),
    signingRequestId: input.signingRequestId,
    type: input.type,
    message: input.message,
    metadata: input.metadata ?? {},
    createdAt: nowIso(),
    createdBy: input.createdBy ?? null,
  };
  await store.appendEvent(ev);
  return ev;
}
