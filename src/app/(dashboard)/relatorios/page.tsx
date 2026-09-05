import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Compatibility route for saved links. Reports now live at `/dashboard`;
 * preserving this redirect prevents old bookmarks and integrations from
 * landing on a second, competing dashboard.
 */
export default async function ReportsCompatibilityPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; tab?: string }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.period) query.set("period", params.period);
  if (params.tab) query.set("tab", params.tab);
  const suffix = query.toString();
  redirect(suffix ? `/dashboard?${suffix}` : "/dashboard");
}
