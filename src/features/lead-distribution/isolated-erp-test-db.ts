import { readFileSync } from "node:fs";
import path from "node:path";

export function getIsolatedErpTestDatabase() {
  const candidate = process.env.ERP_TEST_DATABASE_URL?.trim();
  if (!candidate) throw new Error("ERP_TEST_DATABASE_URL is required for synthetic PostgreSQL tests.");

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error("ERP_TEST_DATABASE_URL must be a valid PostgreSQL URL.");
  }

  if (!( ["postgres:", "postgresql:"].includes(url.protocol)
    && ["localhost", "127.0.0.1"].includes(url.hostname)
    && url.port === "5442"
    && url.pathname === "/erp_test"
    && url.username === "erp_test")) {
    throw new Error("Only the isolated local erp_test database on port 5442 is permitted.");
  }

  const root = process.env.ERP_TEST_ROOT?.trim();
  if (!root) throw new Error("ERP_TEST_ROOT is required to validate the synthetic database folder.");
  const marker = JSON.parse(readFileSync(path.join(root, "provenance.json"), "utf8")) as { purpose?: string };
  if (marker.purpose !== "ancorahub-erp-synthetic-tests") {
    throw new Error("The database folder has no synthetic-test provenance marker.");
  }

  return { url: candidate, dataDirectory: path.resolve(root, "data-erp-test") };
}

export function assertIsolatedErpTestDataDirectory(actual: string, expected: string) {
  const normalizedActual = path.resolve(actual).replaceAll("\\", "/").toLowerCase();
  const normalizedExpected = path.resolve(expected).replaceAll("\\", "/").toLowerCase();
  if (normalizedActual !== normalizedExpected) {
    throw new Error("The PostgreSQL server is outside the authorized synthetic-test folder.");
  }
}
