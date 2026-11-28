"use client";

/**
 * Prévia do molde do Financeiro e da Operação ERP no Lite (28/11/2026): a mesma moldura e as mesmas peças que o
 * `ErpPage` usa no diretor, com lançamentos de exemplo. `/dev/diretor-shell-real?tela=financeiro`.
 */
import { StatCard } from "@/components/dashboard/metric-card";
import { ComercialPage } from "@/features/comercial-lite/comercial-kit";
import { ErpCell, ErpHeaderActions, ErpHelp, ErpList, ErpMonthFilter, ErpPrimaryAction, ErpRowMenu, ErpSearch, ErpStats, ErpStatus, ErpToolbar, ErpUrlFilter, type ErpColumn } from "@/features/erp/ui/erp-kit";
import { ErpSkinProvider } from "@/features/erp/ui/skin-context";

type Row = { id: string; description: string; ref: string; person: string; kind: string; competence: string; amount: string; status: { label: string; tone: "neutral" | "success" | "warning" | "info" } };

const rows: Row[] = [
  { id: "1", description: "Comissão Amil PME · Maria de Fátima", ref: "VEN-2026-1184", person: "Vitória Augusto", kind: "Comissão do corretor", competence: "Nov/2026", amount: "R$ 1.500,00", status: { label: "Aprovado", tone: "success" } },
  { id: "2", description: "Recebimento SulAmérica · contrato 88213", ref: "REC-2026-0412", person: "Corretora", kind: "Recebimento da corretora", competence: "Nov/2026", amount: "R$ 12.480,00", status: { label: "A conferir", tone: "warning" } },
  { id: "3", description: "Adiantamento · Sara Soares", ref: "ADI-2026-0077", person: "Sara Soares", kind: "Adiantamento", competence: "Nov/2026", amount: "R$ 800,00", status: { label: "Pago", tone: "info" } },
  { id: "4", description: "Comissão Bradesco Individual · Adriana", ref: "VEN-2026-1179", person: "Raiana Nunes", kind: "Comissão do corretor", competence: "Out/2026", amount: "R$ 1.250,00", status: { label: "Aprovado", tone: "success" } },
  { id: "5", description: "Despesa · anúncios Meta de outubro", ref: "DES-2026-0233", person: "Marketing", kind: "Despesa", competence: "Out/2026", amount: "R$ 4.300,00", status: { label: "Rascunho", tone: "neutral" } },
];

const columns: ErpColumn<Row>[] = [
  { id: "description", label: "Lançamento", render: (row) => <ErpCell title={row.description} sub={row.ref} /> },
  { id: "person", label: "Pessoa", render: (row) => row.person },
  { id: "kind", label: "Tipo", render: (row) => row.kind },
  { id: "competence", label: "Competência", nowrap: true, render: (row) => row.competence },
  { id: "amount", label: "Valor", numeric: true, render: (row) => row.amount },
  { id: "status", label: "Estado", render: (row) => <ErpStatus tone={row.status.tone}>{row.status.label}</ErpStatus> },
  { id: "menu", label: "", render: (row) => <ErpRowMenu label={`Ações de ${row.description}`} items={[{ id: "abrir", label: "Abrir lançamento", onSelect: () => undefined }, { id: "estornar", label: "Estornar", tone: "danger", onSelect: () => undefined }]} /> },
];

export function ErpShellScreen() {
  const actions = <ErpHeaderActions>
    <ErpHelp title="Como funciona: Lançamentos"><p>Cada valor só vale depois que outra pessoa autorizada aprova. Quem recebe o valor nunca o aprova.</p></ErpHelp>
    <ErpPrimaryAction label="Novo lançamento" />
  </ErpHeaderActions>;
  return (
    <ErpSkinProvider skin="lite">
      <ComercialPage title="Lançamentos" summary="5 lançamentos em novembro" actions={actions}>
        <ErpStats>
          <StatCard label="A receber" value="R$ 48.210,00" sublabel="recebíveis em aberto" />
          <StatCard label="A pagar" value="R$ 9.640,00" sublabel="comissões, despesas e adiantamentos" />
          <StatCard label="Liquidado" value="R$ 31.075,00" sublabel="movimentos confirmados" />
          <StatCard label="A conferir" value="3" sublabel="aguardando outra pessoa" />
        </ErpStats>
        <ErpToolbar>
          <ErpSearch label="Buscar lançamento" placeholder="Buscar descrição, referência ou pessoa" value="" />
          <ErpUrlFilter label="Tipo" param="kind" value="all" defaultValue="all" options={[{ value: "all", label: "Todos os tipos" }, { value: "broker_commission", label: "Comissão do corretor" }]} />
          <ErpMonthFilter value="" />
        </ErpToolbar>
        <ErpList title="Lançamentos" description="Mensalidade do cliente, recebimento da corretora e repasse ao corretor são fatos independentes: um não comprova o outro." columns={columns} rows={rows} rowKey={(row) => row.id} onRowOpen={() => undefined} count={rows.length} countLabel={["lançamento", "lançamentos"]} emptyTitle="Nenhum lançamento" emptyText="Ajuste os filtros." />
      </ComercialPage>
    </ErpSkinProvider>
  );
}
