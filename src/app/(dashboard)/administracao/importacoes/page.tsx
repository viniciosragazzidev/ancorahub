import { getErpImports } from "@/features/erp/imports";
import { ImportsWorkspace } from "@/features/erp/components/import-workspace";
import { ErpHeaderActions, ErpHelp, ErpPrimaryAction, ErpSearch, ErpToolbar, ErpUrlFilter } from "@/features/erp/ui/erp-kit";
import { ErpPage } from "@/features/erp/ui/erp-page";

const STATUS_OPTIONS = [
  { value: "all", label: "Todos os estados" },
  { value: "preview", label: "A conferir" },
  { value: "applied", label: "Aplicados" },
  { value: "rejected", label: "Rejeitados" },
];

export default async function ImportsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const data = await getErpImports(await searchParams);
  const actions = <ErpHeaderActions>
    <ErpHelp title="Como funciona: Importações">
      <p>Prepare o arquivo, confira a prévia e peça a revisão de outra pessoa autorizada. Nenhuma linha é aplicada durante a prévia.</p>
      <p>Referências repetidas e alterações feitas por outra pessoa no meio do caminho impedem a aplicação. O lote inteiro é aplicado de uma vez.</p>
      <p>Um arquivo rejeitado pode ser enviado de novo: o mesmo lote volta para conferência em uma nova versão, com você como responsável pela prévia.</p>
    </ErpHelp>
    <ErpPrimaryAction label="Nova importação" />
  </ErpHeaderActions>;
  const toolbar = <ErpToolbar>
    <ErpSearch label="Buscar lote" placeholder="Buscar pelo nome do arquivo" value={data.filters.q} />
    <ErpUrlFilter label="Estado do lote" param="status" value={data.filters.status} defaultValue="all" options={STATUS_OPTIONS} />
  </ErpToolbar>;
  return <ErpPage pathname="/administracao/importacoes" breadcrumb="Operação" title="Importações" actions={actions}>
    <ImportsWorkspace data={data} toolbar={toolbar} />
  </ErpPage>;
}
