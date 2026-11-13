import { z } from "zod";

export const brokerHomePilotSchema = z.object({
  enabled: z.boolean(),
  brokerIds: z.array(z.string().uuid()).max(100),
  showLearning: z.boolean().default(true),
});
export type BrokerHomePilot = z.infer<typeof brokerHomePilotSchema>;
export const inactiveBrokerHomePilot: BrokerHomePilot = {
  enabled: false,
  brokerIds: [],
  showLearning: true,
};

export function parseBrokerHomePilot(value: string | undefined): BrokerHomePilot {
  try {
    const parsed = brokerHomePilotSchema.safeParse(JSON.parse(value ?? "null"));
    return parsed.success ? parsed.data : inactiveBrokerHomePilot;
  } catch {
    return inactiveBrokerHomePilot;
  }
}

/** Presentation only; identity and role come from the authenticated server context. */
export function brokerHomePilotApplies(
  pilot: BrokerHomePilot,
  context: { role: string; userId: string },
) {
  return context.role === "broker" && pilot.enabled && pilot.brokerIds.includes(context.userId);
}
