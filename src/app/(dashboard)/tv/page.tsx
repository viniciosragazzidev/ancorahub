import { getTvBoard } from "@/features/erp/tv";
import { TvBoard } from "@/features/erp/components/tv-board";
import { ErpNote } from "@/features/erp/ui/erp-kit";
import { ErpPage } from "@/features/erp/ui/erp-page";

/** Rendered per request for the signed-in session; nothing is cached for a later viewer. */
export const dynamic = "force-dynamic";

export default async function TvPage() {
  const board = await getTvBoard();
  return <ErpPage pathname="/tv" breadcrumb="Inteligência" title="Modo TV">
    <TvBoard tiles={board.tiles} intervalSeconds={board.intervalSeconds} generatedAt={board.generatedAt} month={board.month} />
    <ErpNote>
      Só indicadores agregados. Remuneração individual, contatos e documentos não aparecem aqui
      {board.showNames ? "." : "; nomes de pessoas ficam ocultos pela política da empresa."}
    </ErpNote>
  </ErpPage>;
}
