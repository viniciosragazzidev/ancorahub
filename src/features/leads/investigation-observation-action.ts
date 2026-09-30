"use server";

import { getLeadInvestigationObservation } from "./investigation-observation";

export async function getLeadInvestigationObservationAction(leadId: string) {
  return getLeadInvestigationObservation(leadId);
}
