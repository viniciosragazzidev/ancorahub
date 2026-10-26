type NegotiationsRouteAccessInput = {
  featureSetting: string | Promise<string>;
  role: string;
  getPathname: () => string | Promise<string>;
  getCurrentRouteAccess: () => boolean | Promise<boolean>;
  checkRouteAccess: () => boolean | Promise<boolean>;
};

const NEGOTIATIONS_ROLES = new Set(["director", "manager", "supervisor"]);

/** Resolve navigation visibility lazily so a disabled area never queries custom-role permissions. */
export async function resolveNegotiationsRouteAccess(input: NegotiationsRouteAccessInput) {
  if (!NEGOTIATIONS_ROLES.has(input.role)) return false;
  if (await input.featureSetting !== "true") return false;
  const pathname = (await input.getPathname()).split("?")[0];
  if (pathname === "/negociacoes") return input.getCurrentRouteAccess();
  return input.checkRouteAccess();
}
