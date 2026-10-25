/** So permite a previa do AppShell real no servidor local de desenvolvimento. */
export function isDirectorShellRealDevPreview(
  pathname: string,
  environment: string | undefined = process.env.NODE_ENV,
) {
  return environment === "development" && pathname === "/dev/diretor-shell-real";
}
