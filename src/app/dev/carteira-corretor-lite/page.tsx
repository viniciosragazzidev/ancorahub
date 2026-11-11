import "@/components/arc/venancor-scope.css";

import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/arc/button/button";
import { PeopleEmpty, PeoplePage, PeopleRow, PeopleSection } from "@/components/light/people-list/people-list";
import { LightClientDetail } from "@/features/broker-workspace/components/light-client-detail";
import { BrokerClientWallet } from "@/features/broker-workspace/components/broker-client-wallet";
import type { BrokerClientWalletFilters, BrokerClientWalletResult } from "@/features/customers/broker-client-wallet";
import styles from "./preview.module.css";

const walletFilters: BrokerClientWalletFilters = { view: "all", page: 1 };
const wallet: BrokerClientWalletResult = {
  rows: [
    { id: "fixture-1", leadId: "lead-fixture-1", name: "Marina Alves", phone: "11900000001", email: "marina@example.com", convertedAt: new Date("2026-10-20T12:00:00.000Z"), origin: "manual", contractStatus: "active", renewalWindowStartDate: "2026-11-20", nextTask: { id: "task-fixture-1", title: "Revisar a proposta enviada", dueAt: new Date("2026-11-10T13:30:00.000Z"), priority: "normal" }, attentionReason: "overdue_return" },
    { id: "fixture-2", leadId: "lead-fixture-2", name: "Carlos Mendes", phone: "11900000002", email: null, convertedAt: new Date("2026-10-17T12:00:00.000Z"), origin: "webhook", contractStatus: null, renewalWindowStartDate: null, nextTask: null, attentionReason: null },
    { id: "fixture-3", leadId: "lead-fixture-3", name: "Juliana Prado", phone: null, email: null, convertedAt: new Date("2026-10-12T12:00:00.000Z"), origin: "manual", contractStatus: "cancelled", renewalWindowStartDate: null, nextTask: { id: "task-fixture-3", title: "Confirmar recebimento", dueAt: new Date("2026-11-12T13:30:00.000Z"), priority: "low" }, attentionReason: null },
  ],
  page: 1,
  pageSize: 20,
  totalPages: 1,
  totalCount: 3,
  walletCount: 3,
  counts: { all: 3, attention: 1, renewals: 1 },
  hasRenewalData: true,
  origins: ["manual", "webhook"],
};

const detail = {
  client: { id: "fixture-1", leadId: "lead-fixture-1", name: "Marina Alves", phone: "11900000001", email: "marina@example.com", convertedAt: "2026-10-20T12:00:00.000Z", branchName: null, brokerName: "Corretor de demonstração" },
  activeCustomer: { status: "active", coverageStartDate: "2026-10-20", contractAnniversary: "2026-12-01", expirationDate: null, renewalStatus: "pending_window", cancellationDate: null, cancellationReason: null },
  sales: [{ id: "sale-fixture-1", planName: "Plano Essencial", carrierName: "Operadora Exemplo", saleValue: "350.50", policyNumber: null, status: "approved", saleDate: "2026-10-20", brokerName: "Corretor de demonstração" }],
  beneficiaries: [{ id: "beneficiary-fixture-1", name: "Marina Alves", relationship: null, isHolder: true }],
  documents: [],
  timeline: [],
};

type PreviewView = "carteira" | "ficha" | "retorno" | "estados";

export default async function BrokerClientWalletPreview({ searchParams }: { searchParams: Promise<{ tela?: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const rawView = (await searchParams).tela;
  const view: PreviewView = rawView === "ficha" || rawView === "retorno" || rawView === "estados" ? rawView : "carteira";

  return (
    <main className="arc-venancor h-dvh overflow-y-auto bg-(--surface-muted) px-4 py-6 sm:px-6">
      <div className="mx-auto grid w-full max-w-5xl gap-5">
        <header className="grid gap-3 rounded-(--radius-panel) border border-(--border-subtle) bg-(--surface) p-4 sm:flex sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-(--text-muted)">{view === "carteira" ? "Prévia C1" : "Prévia C0"} · somente dados sintéticos</p>
            <h1 className="mt-1 text-xl font-semibold">Carteira do corretor Lite</h1>
            <p className="mt-1 text-sm text-(--text-muted)">Nenhuma ação desta tela grava dados.</p>
          </div>
          <nav aria-label="Telas da prévia" className="flex flex-wrap gap-2">
            {(["carteira", "ficha", "retorno", "estados"] as PreviewView[]).map((item) => (
              <Link key={item} href={`?tela=${item}`} aria-current={view === item ? "page" : undefined} className={view === item ? styles.navActive : styles.navLink}>
                {item === "carteira" ? "Carteira" : item === "ficha" ? "Ficha" : item === "retorno" ? "Retorno" : "Estados"}
              </Link>
            ))}
          </nav>
        </header>

        {view === "carteira" ? <BrokerClientWallet wallet={wallet} filters={walletFilters} hideTitle={false} /> : null}
        {view === "ficha" ? (
          <>
            <section className="grid gap-3 rounded-(--radius-panel) border border-(--border-subtle) bg-(--surface) p-4 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <h2 className="text-base font-semibold">Próxima ação</h2>
                <p className="mt-1 text-sm text-(--text-secondary)">Retorno atrasado · revisar a proposta enviada</p>
                <p className="mt-1 text-xs text-(--text-muted)">Vencimento: hoje, 10:30</p>
              </div>
              <Button variant="primary" className="min-h-11">Agendar retorno</Button>
            </section>
            <LightClientDetail data={detail} />
          </>
        ) : null}
        {view === "retorno" ? (
          <PeoplePage title="Agendar retorno" subtitle="Prévia do retorno ligado à ficha de Marina Alves">
            <section className="grid gap-4 rounded-(--radius-panel) border border-(--border-subtle) bg-(--surface) p-4 sm:max-w-xl">
              <label className="grid gap-2 text-sm font-medium">Quando
                <input type="datetime-local" className="min-h-11 rounded-full border border-(--border-subtle) bg-(--surface) px-4" defaultValue="2026-11-12T10:30" />
              </label>
              <label className="grid gap-2 text-sm font-medium">Motivo
                <input className="min-h-11 rounded-full border border-(--border-subtle) bg-(--surface) px-4" defaultValue="Revisar a proposta enviada" />
              </label>
              <label className="grid gap-2 text-sm font-medium">Observação (opcional)
                <textarea className="min-h-24 rounded-2xl border border-(--border-subtle) bg-(--surface) p-3" placeholder="Contexto para você lembrar do retorno" />
              </label>
              <Button variant="primary" className="min-h-11">Salvar retorno</Button>
              <p className="text-xs text-(--text-muted)">O retorno real usará a tarefa canônica do lead e aparecerá no Início.</p>
            </section>
          </PeoplePage>
        ) : null}
        {view === "estados" ? (
          <PeoplePage title="Estados da carteira" subtitle="Estados previstos, sem consultar dados reais">
            <div className="grid gap-4 md:grid-cols-2">
              <section className="grid content-start gap-3 rounded-(--radius-panel) border border-(--border-subtle) bg-(--surface) p-4">
                <h2 className="text-sm font-semibold">Vazio de base</h2>
                <PeopleEmpty title="Nenhum cliente ainda" description="Quando uma venda aprovada gerar um cliente, ele aparecerá aqui." />
              </section>
              <section className="grid content-start gap-3 rounded-(--radius-panel) border border-(--border-subtle) bg-(--surface) p-4">
                <h2 className="text-sm font-semibold">Vazio de busca</h2>
                <PeopleEmpty title={'Nenhum resultado para “Marina X”'} description="Tente outro nome ou telefone." />
              </section>
              <section className="grid gap-3 rounded-(--radius-panel) border border-(--border-subtle) bg-(--surface) p-4" aria-label="Carregamento">
                <h2 className="text-sm font-semibold">Carregando carteira</h2>
                {[1, 2, 3].map((item) => <div key={item} className="h-14 rounded-full bg-(--surface-muted)" />)}
              </section>
              <section className="grid gap-3 rounded-(--radius-panel) border border-(--border-subtle) bg-(--surface) p-4" role="alert">
                <h2 className="text-sm font-semibold">Não foi possível carregar</h2>
                <p className="text-sm text-(--text-secondary)">Tente novamente. Seus filtros serão mantidos.</p>
                <Button variant="secondary" className="min-h-11">Tentar novamente</Button>
              </section>
              <section className={`${styles.reducedMotion} grid gap-2 rounded-(--radius-panel) border border-(--border-subtle) bg-(--surface) p-4`} data-preview-reduced-motion>
                <h2 className="text-sm font-semibold">Movimento reduzido</h2>
                <PeopleSection label="Exemplo de linha sem animação">
                  <PeopleRow name="Marina Alves" preview="Retorno atrasado" meta="Hoje, 10:30" />
                </PeopleSection>
                <p className="text-xs text-(--text-muted)">Sem deslocamento ou entrada escalonada; a mudança de estado continua visível por texto.</p>
              </section>
            </div>
          </PeoplePage>
        ) : null}
      </div>
    </main>
  );
}
