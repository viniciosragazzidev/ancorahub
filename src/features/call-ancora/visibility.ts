export type CallAncoraViewer = {
  role: string;
  featureEnabled: boolean;
  platformAdmin: boolean;
  development: boolean;
};

/** Platform admins and local development can use Call Âncora before it is released; with the flag on, brokers use it and directors configure it. */
export function canUseCallAncora({ role, featureEnabled, platformAdmin, development }: CallAncoraViewer) {
  return development || platformAdmin || ((role === "broker" || role === "director") && featureEnabled);
}
