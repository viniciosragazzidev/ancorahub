"use client";

import { motion } from "motion/react";
import { Button } from "@/components/arc/button/button";
import { Badge } from "@/components/arc/badge/badge";
import type { QuoteResponse, QuoteResult } from "../contracts";
import { dinheiro, explicarPendencia, motivosDoPlano, podeGerarProposta } from "./cotacao-lite-model";
import { entradaEscalonada, MensagemErro } from "./cotacao-lite-ui";
import { fatosDoPlano } from "./cotacao-lite-detalhe";

export const LIMITE_COMPARACAO = 3;
const TOM = { ready: "success", pending: "warning", incompatible: "danger" } as const;
const ROTULO = { ready: "Pronto", pending: "Falta confirmar", incompatible: "Não atende" } as const;

export function CotacaoLiteResultados({
  resposta,
  selecionados,
  onAlternarSelecao,
  onAbrir,
  onComparar,
  onVoltarLista,
  vista,
  pending,
  erro,
  onPagina,
  onRecomecar,
  onGerarProposta,
  reduzir,
}: {
  resposta: QuoteResponse;
  selecionados: string[];
  onAlternarSelecao: (id: string) => void;
  onAbrir: (plano: QuoteResult) => void;
  onComparar: () => void;
  onVoltarLista: () => void;
  vista: "lista" | "comparar";
  pending: boolean;
  erro: string;
  onPagina: (pagina: number) => void;
  onRecomecar: () => void;
  onGerarProposta?: (plano: QuoteResult) => void;
  reduzir: boolean | null;
}) {
  if (vista === "comparar") {
    const colunas = resposta.results.filter(plano => selecionados.includes(plano.id));
    return (
      <section aria-label="Comparar planos" className="grid gap-5">
        <div className="grid gap-1">
          <h1 className="text-2xl leading-tight font-medium tracking-tight text-balance">Comparar planos</h1>
          <p className="text-sm text-muted-foreground">Alternativas independentes. Os valores não se somam entre planos.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {colunas.map(plano => (
            <section key={plano.id} aria-label={plano.name} className="grid content-start gap-4 rounded-2xl border border-border bg-background p-5">
              <div className="grid gap-2">
                <p className="text-xs text-muted-foreground">{plano.operator}</p>
                <h2 className="text-base font-medium break-words">{plano.name}</h2>
                <Badge tone={TOM[plano.state]}>{ROTULO[plano.state]}</Badge>
              </div>
              <p className="text-2xl font-semibold tabular-nums">{dinheiro(plano.totalCents)} <span className="whitespace-nowrap text-sm font-normal text-muted-foreground">por mês</span></p>
              <dl className="grid gap-3 text-sm">
                {fatosDoPlano(plano).map(([rotulo, valor]) => (
                  <div key={rotulo} className="grid gap-0.5">
                    <dt className="text-muted-foreground">{rotulo}</dt>
                    <dd className="break-words">{valor}</dd>
                  </div>
                ))}
              </dl>
              {plano.state === "pending" ? (
                <div className="grid gap-1 text-sm">
                  <p className="font-medium">{explicarPendencia(plano)}</p>
                  {motivosDoPlano(plano).length > 1 ? (
                    <ul className="list-disc space-y-1 pl-5 text-muted-foreground">{motivosDoPlano(plano).slice(1).map(m => <li key={m}>{m}</li>)}</ul>
                  ) : null}
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => onAbrir(plano)}>Ver detalhes</Button>
                {onGerarProposta && podeGerarProposta(plano) ? <Button variant="ghost" size="sm" onClick={() => onGerarProposta(plano)}>Gerar proposta em PDF</Button> : null}
                <Button variant="ghost" size="sm" onClick={() => onAlternarSelecao(plano.id)}>Retirar da comparação</Button>
              </div>
            </section>
          ))}
        </div>
        <Button variant="ghost" onClick={onVoltarLista}>Voltar aos planos</Button>
      </section>
    );
  }

  return (
    <section aria-label="Resultados da cotação" aria-busy={pending} className="grid gap-4">
      <div className="grid gap-1">
        <h1 className="text-2xl leading-tight font-medium tracking-tight text-balance" tabIndex={-1}>
          {resposta.total === 0 ? "Nenhum plano para este perfil." : `Encontrei ${resposta.total.toLocaleString("pt-BR")} ${resposta.total === 1 ? "plano" : "planos"}.`}
        </h1>
        <p role="status" className="text-sm text-muted-foreground">
          Do menor para o maior valor.{resposta.pending > 0 ? ` ${resposta.pending} com condição a confirmar.` : ""}
        </p>
      </div>

      {resposta.total > 0 ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" size="sm" disabled={selecionados.length < 2} onClick={onComparar}>
            Comparar ({selecionados.length}/{LIMITE_COMPARACAO})
          </Button>
          {selecionados.length < 2 ? <span className="text-xs text-muted-foreground">Escolha de 2 a 3 planos para comparar.</span> : null}
        </div>
      ) : null}

      {resposta.total === 0 ? (
        <p className="text-sm text-muted-foreground">Revise a modalidade, as idades, o município ou o orçamento e tente de novo.</p>
      ) : (
        <ul className="grid gap-3">
          {resposta.results.map((plano, indice) => {
            const marcado = selecionados.includes(plano.id);
            const bloqueado = !marcado && selecionados.length >= LIMITE_COMPARACAO;
            return (
              <motion.li key={plano.id} {...entradaEscalonada(indice, reduzir)} className="grid gap-3 rounded-2xl border border-border bg-background p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{plano.operator}</p>
                    <h2 className="mt-1 text-base font-medium break-words">{plano.name}</h2>
                  </div>
                  <Badge tone={TOM[plano.state]}>{ROTULO[plano.state]}</Badge>
                </div>
                <p className="text-2xl font-semibold tabular-nums">
                  {dinheiro(plano.totalCents)}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">por mês</span>
                </p>
                <p className="text-xs text-muted-foreground">Valores conforme a tabela consultada, sujeitos à análise da operadora.</p>
                {plano.state === "incompatible" ? <p className="text-sm text-muted-foreground">Não atende a este perfil.</p> : null}
                {plano.state === "pending" ? <p className="text-sm text-muted-foreground">{explicarPendencia(plano)}</p> : null}
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="secondary" size="sm" onClick={() => onAbrir(plano)}>Ver detalhes</Button>
                  <button
                    type="button"
                    aria-pressed={marcado}
                    disabled={bloqueado}
                    onClick={() => onAlternarSelecao(plano.id)}
                    className={`min-h-11 rounded-full border px-4 text-sm transition-colors disabled:opacity-40 ${marcado ? "border-primary bg-primary/5 font-medium" : "border-border bg-background"}`}
                  >
                    {marcado ? "✓ Na comparação" : "Comparar"}
                  </button>
                  {onGerarProposta && podeGerarProposta(plano) ? (
                    <Button variant="ghost" size="sm" onClick={() => onGerarProposta(plano)}>Gerar proposta em PDF</Button>
                  ) : null}
                </div>
              </motion.li>
            );
          })}
        </ul>
      )}

      {resposta.pages > 1 ? (
        <nav aria-label="Páginas de resultados" className="flex items-center justify-center gap-4">
          <Button variant="ghost" disabled={pending || resposta.page <= 1} onClick={() => onPagina(resposta.page - 1)}>Anterior</Button>
          <span className="text-sm">{resposta.page} de {resposta.pages}</span>
          <Button variant="ghost" disabled={pending || resposta.page >= resposta.pages} onClick={() => onPagina(resposta.page + 1)}>Próxima</Button>
        </nav>
      ) : null}

      {erro ? <MensagemErro texto={erro} /> : null}
      <Button variant="ghost" onClick={onRecomecar}>Fazer outra cotação</Button>
    </section>
  );
}
