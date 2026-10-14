import { LightPageSkeleton } from "@/components/light/light-page-skeleton";

/** Lite list skeleton (with the shimmer of the Arc Skeleton) while Clientes loads. */
export default function Loading() {
  return <LightPageSkeleton variant="list" label="Carregando clientes" />;
}
