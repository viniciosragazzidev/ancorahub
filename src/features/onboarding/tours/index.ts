import type { Tour } from "nextstepjs";
import { brokerTours } from "./broker-tours";
import { managerTours } from "./manager-tours";
import { directorTours } from "./director-tours";

export const allOnboardingTours: Tour[] = [
  ...brokerTours,
  ...managerTours,
  ...directorTours,
];

export { brokerTours, managerTours, directorTours };
