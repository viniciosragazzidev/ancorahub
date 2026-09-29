import "server-only";

import { processMetaOutboundBatch } from "@/features/communication-channels/outbound-service";
import { enqueueBrokerLeadNotification } from "./broker-lead-whatsapp";

/**
 * Persists and dispatches the broker notification created for this lead.
 *
 * The outbound id is mandatory on the immediate path: processing a tenant-wide
 * batch here would wake an unrelated older message and could leave the current
 * `new_lead_broker` template waiting behind the backlog.
 */
export async function enqueueAndProcessBrokerLeadNotification(input: {
  tenantId: string;
  leadId: string;
  brokerId: string;
  idempotencyKey?: string;
}) {
  const queued = await enqueueBrokerLeadNotification(input);
  if (!queued.queued || !queued.outboundId) {
    return { queued, delivery: null };
  }

  const delivery = await processMetaOutboundBatch(1, input.tenantId, queued.outboundId);
  return { queued, delivery };
}
