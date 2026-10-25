/** Only the local F2 shell preview skips database-backed root preferences. */
export function isDirectorF2DevPreview(
  pathname: string,
  environment: string | undefined = process.env.NODE_ENV,
) {
  return environment === "development" && pathname === "/dev/diretor-f2-preview";
}
