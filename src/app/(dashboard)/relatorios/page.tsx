import { redirect } from "next/navigation";
import { parsePeriod } from "@/shared/period";
import { parseLeadQualityFocus } from "@/features/reports/metrics/lead-quality-service";

export const dynamic = "force-dynamic";

/**
 * Compatibility route for saved links. Reports now live at `/dashboard`;
 * preserving this redirect prevents old bookmarks and integrations from
 * landing on a second, competing dashboard.
 */
export default async function ReportsCompatibilityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  const rawPeriod = typeof params.period === "string" ? params.period : undefined;
  const period = parsePeriod(rawPeriod);
  if (rawPeriod && period !== 30) query.set("period", String(period));
  const requestedTab = typeof params.tab === "string" ? params.tab : undefined;
  const destinationTab = requestedTab === undefined || requestedTab === "quality" ? "quality" : "overview";
  query.set("tab", destinationTab);
  const focus = parseLeadQualityFocus(
    typeof params.dimension === "string" ? params.dimension : undefined,
    typeof params.key === "string" ? params.key : undefined,
  );
  if (destinationTab === "quality" && focus) {
    query.set("dimension", focus.dimension);
    query.set("key", focus.key);
  }
  const suffix = query.toString();
  redirect(`/dashboard?${suffix}`);
}
