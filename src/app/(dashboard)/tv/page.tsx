import { DashboardHeader } from "@/components/dashboard-header";
import { getTvBoard } from "@/features/erp/tv";
import { TvBoard } from "@/features/erp/components/tv-board";
import page from "@/components/lite/page/lite-page.module.css";

/** Rendered per request for the signed-in session; nothing is cached for a later viewer. */
export const dynamic = "force-dynamic";

export default async function TvPage() {
  const board = await getTvBoard();
  return <><DashboardHeader breadcrumb="Inteligência" title="Modo TV" /><main className={page.stack}>
    <TvBoard tiles={board.tiles} intervalSeconds={board.intervalSeconds} generatedAt={board.generatedAt} month={board.month} />
    <p className="text-sm text-muted-foreground">Só indicadores agregados. Remuneração individual, contatos e documentos não aparecem aqui{board.showNames ? "." : "; nomes de pessoas ficam ocultos pela política da empresa."}</p>
  </main></>;
}
