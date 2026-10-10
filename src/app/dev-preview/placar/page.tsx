import { notFound } from "next/navigation";
import { RankingPreview } from "./preview";

export default async function Page({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { state } = await searchParams;
  return <RankingPreview state={state ?? "full"} />;
}
