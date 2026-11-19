export type CallAncoraViewer = {
  role: string;
  featureEnabled: boolean;
  platformAdmin: boolean;
  development: boolean;
};

/** Platform admins and local development can inspect the demo without exposing it to brokers in production. */
export function canUseCallAncora({ role, featureEnabled, platformAdmin, development }: CallAncoraViewer) {
  return development || platformAdmin || (role === "broker" && featureEnabled);
}
