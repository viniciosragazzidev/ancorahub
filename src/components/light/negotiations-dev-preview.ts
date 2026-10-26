/** Preview sintética da área, sem consultar autenticação ou dados de produção. */
export function isNegotiationsDevPreview(pathname: string, environment: string | undefined = process.env.NODE_ENV) {
  return environment === "development" && pathname === "/dev/negociacoes-preview";
}
