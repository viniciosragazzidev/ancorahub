import { getTvBoard } from "@/features/erp/tv";
import { TvBoard } from "@/features/erp/components/tv-board";
import { ErpHeaderActions, ErpHelp } from "@/features/erp/ui/erp-kit";
import { ErpPage } from "@/features/erp/ui/erp-page";

/** Rendered per request for the signed-in session; nothing is cached for a later viewer. */
export const dynamic = "force-dynamic";

export default async function TvPage() {
  const board = await getTvBoard();
  const actions = <ErpHeaderActions>
    <ErpHelp title="Como funciona o Modo TV">
      <p>O painel mostra só indicadores agregados do mês no seu escopo e se atualiza sozinho a cada 5 minutos.</p>
      <p>Remuneração individual, contatos e documentos nunca aparecem aqui.{board.showNames ? "" : " Nomes de pessoas ficam ocultos pela política da empresa."}</p>
      <p>Use Tela cheia para deixar só o painel na TV. O intervalo de troca dos rankings é definido em Módulos.</p>
    </ErpHelp>
  </ErpHeaderActions>;
  return <ErpPage pathname="/tv" breadcrumb="Operação ERP" title="Modo TV" actions={actions}>
    <TvBoard tiles={board.tiles} intervalSeconds={board.intervalSeconds} generatedAt={board.generatedAt} month={board.month} />
  </ErpPage>;
}
