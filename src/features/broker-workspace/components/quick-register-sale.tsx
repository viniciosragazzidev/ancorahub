"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { BottomSheet } from "@/components/arc/bottom-sheet/bottom-sheet";
import { Button } from "@/components/arc/button/button";
import { SearchField } from "@/components/arc/search-field/search-field";
import { PeopleRow, PeopleSection } from "@/components/light/people-list/people-list";
import { liteStageLabel } from "@/app/(dashboard)/leads/lite-stage-labels";

import { quickSaleLeadHref, QUICK_SALE_LIMIT, type QuickSaleInput, type QuickSaleLead, type QuickSaleResult } from "../quick-sale";
import { listQuickSaleLeadsAction } from "../quick-sale-actions";
import styles from "./quick-register-sale.module.css";

/** Espera entre a digitação e a busca no servidor. */
export const QUICK_SALE_SEARCH_DELAY_MS = 250;

type ListState =
  | { status: "loading"; leads: QuickSaleLead[] }
  | { status: "ready"; leads: QuickSaleLead[] }
  | { status: "error"; leads: QuickSaleLead[]; message: string };

/**
 * Registrar venda em dois toques (plano "Início do corretor e CRM", parte B): o corretor escolhe um lead em
 * negociação e a tela do lead abre o registro de venda (`/leads/[id]?registrar-venda=1`). A lista vem do servidor,
 * só com os leads em que ele é o responsável, os mais adiantados no funil primeiro.
 */
export function QuickRegisterSaleSheet({
  open,
  onOpenChange,
  loadLeads = listQuickSaleLeadsAction,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Leitura da lista; padrão é a server action escopada pela sessão. */
  loadLeads?: (input: QuickSaleInput) => Promise<QuickSaleResult>;
}) {
  const [query, setQuery] = useState("");
  const [attempt, setAttempt] = useState(0);
  // Resposta da última leitura, com a busca e a tentativa a que ela responde; carregando é quando elas não batem.
  const [loaded, setLoaded] = useState<(Exclude<ListState, { status: "loading" }> & { key: string }) | null>(null);
  const request = useRef(0);
  const key = `${query.trim()}|${attempt}`;

  useEffect(() => {
    if (!open) return;
    const id = ++request.current;
    const timer = window.setTimeout(async () => {
      let next: Exclude<ListState, { status: "loading" }>;
      try {
        const result = await loadLeads({ query: query.trim() });
        next = result.ok ? { status: "ready", leads: result.leads } : { status: "error", leads: [], message: result.error };
      } catch {
        next = { status: "error", leads: [], message: "Sem conexão com o servidor. Confira a internet." };
      }
      // Só a busca mais recente vale; respostas atrasadas são descartadas.
      if (request.current === id) setLoaded({ ...next, key });
    }, query ? QUICK_SALE_SEARCH_DELAY_MS : 0);
    return () => window.clearTimeout(timer);
  }, [open, query, key, loadLeads]);

  // Enquanto a nova busca carrega, a lista anterior continua na tela (sem pulo de layout).
  const state: ListState = loaded && loaded.key === key ? loaded : { status: "loading", leads: loaded?.leads ?? [] };

  const handleOpenChange = useCallback((next: boolean) => {
    if (!next) setQuery("");
    onOpenChange(next);
  }, [onOpenChange]);

  const searching = Boolean(query.trim());
  const firstLoad = state.status === "loading" && state.leads.length === 0;

  return (
    <BottomSheet
      className="arc-venancor"
      open={open}
      onOpenChange={handleOpenChange}
      title="Registrar venda"
      description="Escolha o lead que fechou. A tela dele abre direto no registro da venda."
      closeLabel="Fechar"
      detents={[0.92]}
    >
      <div className={styles.body}>
        <div className={styles.search} role="search">
          <SearchField label="Buscar lead" value={query} onValueChange={setQuery} placeholder="Nome ou telefone" clearLabel="Limpar busca" enterKeyHint="search" maxLength={100} autoComplete="off" />
        </div>

        <div className={styles.results} aria-busy={state.status === "loading"}>
          {firstLoad ? (
            <ul className={styles.skeletonList} aria-label="Carregando leads">
              {[0, 1, 2, 3].map((item) => (
                <li key={item} className={styles.skeletonRow}>
                  <span className={styles.skeletonAvatar} />
                  <span className={styles.skeletonLines}><span /><span /></span>
                </li>
              ))}
            </ul>
          ) : state.status === "error" ? (
            <div className={styles.state} role="alert">
              <p className={styles.stateTitle}>Não deu para carregar seus leads</p>
              <p className={styles.stateText}>{state.message}</p>
              <Button variant="secondary" className={styles.retry} onClick={() => setAttempt((value) => value + 1)}>Tentar de novo</Button>
            </div>
          ) : state.leads.length === 0 ? (
            <div className={styles.state}>
              <p className={styles.stateTitle}>{searching ? "Nenhum lead encontrado" : "Nenhum lead em negociação"}</p>
              <p className={styles.stateText}>
                {searching ? "Tente outro nome ou telefone." : "Leads aceitos e em atendimento aparecem aqui, os mais perto de fechar primeiro."}
              </p>
            </div>
          ) : (
            <div className={styles.list} data-refreshing={state.status === "loading" || undefined}>
              <PeopleSection label="Leads em negociação">
                {state.leads.map((lead, index) => (
                  <PeopleRow key={lead.id} index={index} href={quickSaleLeadHref(lead.id)} name={lead.name} preview={liteStageLabel(lead.status)} />
                ))}
              </PeopleSection>
              {state.leads.length >= QUICK_SALE_LIMIT ? (
                <p className={styles.hint}>Mostrando os {QUICK_SALE_LIMIT} mais adiantados. Busque pelo nome ou telefone para achar outro.</p>
              ) : null}
            </div>
          )}
          <p className={styles.srOnly} aria-live="polite">
            {state.status === "ready" ? (state.leads.length === 1 ? "1 lead" : `${state.leads.length} leads`) : ""}
          </p>
        </div>
      </div>
    </BottomSheet>
  );
}
