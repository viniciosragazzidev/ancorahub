import { LightPageSkeleton } from "@/components/light/light-page-skeleton";

/** Lite detail skeleton (with the shimmer of the Arc Skeleton) while the client loads. */
export default function Loading() {
  return <LightPageSkeleton variant="detail" label="Carregando cliente" />;
}
