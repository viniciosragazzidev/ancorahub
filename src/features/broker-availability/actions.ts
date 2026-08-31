"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { completeBrokerAvailabilityOnboarding, saveOwnBrokerAvailability } from "./service";

const scheduleActionSchema = z.object({
  windows: z.array(z.object({ dayOfWeek: z.number().int(), startsAt: z.string(), endsAt: z.string() })),
});

export async function saveOwnBrokerAvailabilityAction(input: unknown) {
  const result = await saveOwnBrokerAvailability(scheduleActionSchema.parse(input));
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/minha-fila");
  return result;
}

export async function completeBrokerAvailabilityOnboardingAction() {
  const result = await completeBrokerAvailabilityOnboarding();
  revalidatePath("/dashboard", "layout");
  return result;
}
