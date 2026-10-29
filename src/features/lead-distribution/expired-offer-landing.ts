export type ExpiredOfferLandingInput = {
  role: string;
  brokerId: string | null;
  currentLeadOwnerId: string | null;
  latestOffer: {
    brokerId: string;
    status: string;
    acceptedAt: Date | null;
  } | null;
};

/** Only an expired, unaccepted offer proves timeout. REPLACED has no reason field. */
export function shouldShowExpiredOfferLanding(input: ExpiredOfferLandingInput): boolean {
  return input.role === "broker"
    && Boolean(input.brokerId)
    && input.currentLeadOwnerId !== input.brokerId
    && input.latestOffer?.brokerId === input.brokerId
    && input.latestOffer.status === "EXPIRED"
    && input.latestOffer.acceptedAt === null;
}
