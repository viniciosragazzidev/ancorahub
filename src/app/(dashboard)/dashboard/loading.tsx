import LegacyDashboardLoading from "./loading-legacy";
import { DirectorLiteDashboardSkeleton, isDirectorLiteDashboardLoading } from "./loading-lite";

/** Carregamento do painel: skeleton Lite com a chave do diretor ligada; senão, o de sempre. */
export default async function Loading() {
  if (await isDirectorLiteDashboardLoading()) return <DirectorLiteDashboardSkeleton />;
  return <LegacyDashboardLoading />;
}
