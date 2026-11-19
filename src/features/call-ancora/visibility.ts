export type CallAncoraViewer = {
  role: string;
  featureEnabled: boolean;
  platformAdmin: boolean;
  development: boolean;
};

/** Platform admins and local development can use Call Âncora before it is released to brokers. */
export function canUseCallAncora({ role, featureEnabled, platformAdmin, development }: CallAncoraViewer) {
  return development || platformAdmin || (role === "broker" && featureEnabled);
}
