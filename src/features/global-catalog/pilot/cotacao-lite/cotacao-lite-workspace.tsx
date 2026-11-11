"use client";

import { useId, useRef, useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/arc/button/button";
import { Input } from "@/components/arc/input/input";
import { Badge } from "@/components/arc/badge/badge";
import { simulateCatalogAction } from "../actions";
import type { CatalogOptions, QuoteInput, QuoteResponse, QuoteResult } from "../contracts";
import {
  PASSOS,
  dinheiro,
  explicarPendencia,
  montarEntrada,
  orcamentoEmCentavos,
  podeGerarProposta,
  validarCidade,
  validarVidas,
  type Passo,
  type Vida,
} from "./cotacao-lite-model";

type Simular = (input: QuoteInput) => Promise<{ data?: QuoteResponse; error?: string }>;

const MODALIDADE: Record<QuoteInput["modality"], string> = {
  ADESAO: "Saúde por adesão",
  PME_EMPRESARIAL: "Saúde empresarial / PME",
  PESSOA_FISICA: "Saúde pessoa física",
  ADESAO_ODONTO: "Odonto por adesão",
  PME_EMPRESARIAL_ODONTO: "Odonto empresarial / PME",
  PESSOA_FISICA_ODONTO: "Odonto pessoa física",
};
const MODALIDADES = Object.keys(MODALIDADE) as QuoteInput["modality"][];
const VINCULOS = ["Cônjuge", "Filho(a)", "Enteado(a)", "Pai / mãe", "Outro dependente"];
const TOM_ESTADO = { ready: "success", pending: "warning", incompatible: "danger" } as const;
const ROTULO_ESTADO = { ready: "Pronto", pending: "Falta confirmar", incompatible: "Não atende" } as const;
const ERRO_GERAL = "Não consegui concluir agora. Tente de novo em instantes.";

export type CotacaoLiteProps = {
  options: Pick<CatalogOptions, "cities">;
  counts: { plans: number };
  sourceDate: string;
  simular?: Simular;
  onGerarProposta?: (plan: QuoteResult) => void;
};

export function CotacaoLiteWorkspace({ options, counts, sourceDate, simular = simulateCatalogAction, onGerarProposta }: CotacaoLiteProps) {
  const [passo, setPasso] = useState<Passo>("modalidade");
  const [modality, setModality] = useState<QuoteInput["modality"] | null>(null);
  const [city, setCity] = useState("");
  const [vidas, setVidas] = useState<Vida[]>([{ key: 1, age: "", holder: true, relationship: "Titular" }]);
  const proximaVida = useRef(2);
  const [refino, setRefino] = useState({ budget: "", query: "", includeIncompatible: false });
  const [erro, setErro] = useState("");
  const [resposta, setResposta] = useState<QuoteResponse | null>(null);
  const [entrada, setEntrada] = useState<QuoteInput | null>(null);
  const [pending, start] = useTransition();
  const versao = useRef(0);
  const cidadeId = useId();
  const resultadoRef = useRef<HTMLElement>(null);

  const indice = PASSOS.indexOf(passo);
  const emResultado = resposta !== null;

  function avancar(proximo: Passo) {
    setErro("");
    setPasso(proximo);
  }

  function voltar() {
    setErro("");
    if (indice > 0) setPasso(PASSOS[indice - 1]);
  }

  function recomecar() {
    versao.current++;
    setResposta(null);
    setEntrada(null);
    setErro("");
    setPasso("modalidade");
  }

  function buscar(input: QuoteInput) {
    const token = ++versao.current;
    setErro("");
    start(async () => {
      const resultado = await simular(input);
      if (token !== versao.current) return;
      if (resultado.error || !resultado.data) {
        setErro(resultado.error || ERRO_GERAL);
        return;
      }
      setResposta(resultado.data);
      setEntrada(input);
      resultadoRef.current?.focus({ preventScroll: true });
    });
  }

  function enviarRefino(evento: FormEvent) {
    evento.preventDefault();
    if (!modality) return recomecar();
    if (orcamentoEmCentavos(refino.budget) === "invalido") {
      setErro("Informe um orçamento positivo, por exemplo 1.500,00.");
      return;
    }
    buscar(
      montarEntrada(
        { modality, vidas, city, operator: "", businessMonths: "", budget: refino.budget, query: refino.query, includeIncompatible: refino.includeIncompatible },
        1,
      ),
    );
  }

  function irParaPagina(pagina: number) {
    if (entrada) buscar({ ...entrada, page: pagina });
  }

  function continuarCidade() {
    if (!modality) return recomecar();
    const mensagem = validarCidade(modality, city);
    if (mensagem) return setErro(mensagem);
    avancar("vidas");
  }

  function continuarVidas() {
    const mensagem = validarVidas(vidas);
    if (mensagem) return setErro(mensagem);
    avancar("refino");
  }

  function atualizarVida(key: number, campo: Partial<Vida>) {
    setErro("");
    setVidas(anterior => anterior.map(vida => (vida.key === key ? { ...vida, ...campo } : vida)));
  }

  return (
    <div className="arc-venancor mx-auto flex w-full max-w-xl flex-col gap-6 px-4 pb-24 pt-4">
      <header className="grid gap-2">
        <p className="text-sm text-muted-foreground">
          Cotação · {counts.plans.toLocaleString("pt-BR")} planos na base de {sourceDate.split("-").reverse().join("/")}
        </p>
        {emResultado ? null : (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            Passo {indice + 1} de {PASSOS.length}
          </p>
        )}
      </header>

      {resposta && entrada ? (
        <section ref={resultadoRef} tabIndex={-1} aria-label="Resultados da cotação" aria-busy={pending} className="grid gap-4 outline-none">
          <div className="grid gap-1">
            <h1 className="text-2xl leading-tight font-medium tracking-tight text-balance">
              {resposta.total === 0 ? "Nenhum plano para este perfil." : `Encontrei ${resposta.total.toLocaleString("pt-BR")} ${resposta.total === 1 ? "plano" : "planos"}.`}
            </h1>
            <p role="status" className="text-sm text-muted-foreground">
              Do menor para o maior valor.{resposta.pending > 0 ? ` ${resposta.pending} com condição a confirmar.` : ""}
            </p>
          </div>

          {resposta.total === 0 ? (
            <p className="text-sm text-muted-foreground">Revise a modalidade, as idades, o município ou o orçamento e tente de novo.</p>
          ) : (
            <ul className="grid gap-3">
              {resposta.results.map(plano => (
                <li key={plano.id} className="grid gap-3 rounded-2xl border border-border bg-background p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">{plano.operator}</p>
                      <h2 className="mt-1 text-base font-medium break-words">{plano.name}</h2>
                    </div>
                    <Badge tone={TOM_ESTADO[plano.state]}>{ROTULO_ESTADO[plano.state]}</Badge>
                  </div>
                  <p className="text-2xl font-semibold tabular-nums">
                    {dinheiro(plano.totalCents)}
                    <span className="ml-1 text-sm font-normal text-muted-foreground">por mês</span>
                  </p>
                  <p className="text-xs text-muted-foreground">Valores conforme a tabela consultada, sujeitos à análise da operadora.</p>
                  {plano.state === "incompatible" ? <p className="text-sm text-muted-foreground">Não atende a este perfil.</p> : null}
                  {plano.state === "pending" ? <p className="text-sm text-muted-foreground">{explicarPendencia(plano)}</p> : null}
                  {onGerarProposta && podeGerarProposta(plano) ? (
                    <Button variant="secondary" size="sm" onClick={() => onGerarProposta(plano)}>Gerar proposta em PDF</Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          {resposta.pages > 1 ? (
            <nav aria-label="Páginas de resultados" className="flex items-center justify-center gap-4">
              <Button variant="ghost" disabled={pending || resposta.page <= 1} onClick={() => irParaPagina(resposta.page - 1)}>Anterior</Button>
              <span className="text-sm">{resposta.page} de {resposta.pages}</span>
              <Button variant="ghost" disabled={pending || resposta.page >= resposta.pages} onClick={() => irParaPagina(resposta.page + 1)}>Próxima</Button>
            </nav>
          ) : null}

          {erro ? <p role="alert" className="text-sm text-destructive">{erro}</p> : null}
          <Button variant="ghost" onClick={recomecar}>Fazer outra cotação</Button>
        </section>
      ) : (
        <section className="grid gap-6" aria-busy={pending}>
          {passo === "modalidade" ? (
            <div className="grid gap-4">
              <h1 className="text-2xl leading-tight font-medium tracking-tight text-balance">Qual é o tipo de plano?</h1>
              <div role="group" aria-label="Modalidade" className="grid gap-2">
                {MODALIDADES.map(valor => (
                  <button
                    key={valor}
                    type="button"
                    aria-pressed={modality === valor}
                    onClick={() => {
                      setModality(valor);
                      avancar("cidade");
                    }}
                    className="min-h-11 rounded-2xl border border-border bg-background px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-muted aria-pressed:border-primary"
                  >
                    {MODALIDADE[valor]}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {passo === "cidade" ? (
            <div className="grid gap-4">
              <h1 className="text-2xl leading-tight font-medium tracking-tight text-balance">Em qual município?</h1>
              <Input
                label="Município de comercialização"
                list={cidadeId}
                placeholder="Ex.: Rio de Janeiro"
                value={city}
                onChange={e => {
                  setErro("");
                  setCity(e.target.value);
                }}
                required={modality?.startsWith("PME") ?? false}
              />
              <datalist id={cidadeId}>
                {options.cities.map(c => <option key={c} value={c} />)}
              </datalist>
              {erro ? <p role="alert" className="text-sm text-destructive">{erro}</p> : null}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Button variant="ghost" onClick={voltar}>Voltar</Button>
                <div className="flex gap-2">
                  {modality && !modality.startsWith("PME") ? <Button variant="secondary" onClick={() => avancar("vidas")}>Pular</Button> : null}
                  <Button onClick={continuarCidade}>Continuar</Button>
                </div>
              </div>
            </div>
          ) : null}

          {passo === "vidas" ? (
            <div className="grid gap-4">
              <h1 className="text-2xl leading-tight font-medium tracking-tight text-balance">Quem vai entrar no plano?</h1>
              <p className="text-sm text-muted-foreground">Informe a idade completa de cada pessoa.</p>
              <ul className="grid gap-4">
                {vidas.map((vida, posicao) => (
                  <li key={vida.key} className="grid gap-3 rounded-2xl border border-border bg-background p-4">
                    <Input
                      label={vida.holder ? "Idade do titular" : `Idade do dependente ${posicao}`}
                      type="number"
                      min={0}
                      max={120}
                      value={vida.age}
                      onChange={e => atualizarVida(vida.key, { age: e.target.value })}
                      required
                    />
                    {vida.holder ? null : (
                      <div className="flex flex-wrap items-end gap-3">
                        <label className="grid flex-1 gap-2 text-sm font-medium">
                          Vínculo com o titular
                          <select
                            className="min-h-11 rounded-xl border border-border bg-background px-3 text-sm font-normal"
                            value={vida.relationship}
                            onChange={e => atualizarVida(vida.key, { relationship: e.target.value })}
                          >
                            {VINCULOS.map(v => <option key={v} value={v}>{v}</option>)}
                          </select>
                        </label>
                        <Button
                          variant="ghost"
                          aria-label={`Remover dependente ${posicao}`}
                          onClick={() => setVidas(anterior => anterior.filter(item => item.key !== vida.key))}
                        >
                          Remover
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              <div>
                <Button
                  variant="secondary"
                  disabled={vidas.length >= 100}
                  onClick={() => {
                    const key = proximaVida.current++;
                    setVidas(anterior => [...anterior, { key, age: "", holder: false, relationship: "Filho(a)" }]);
                  }}
                >
                  Adicionar dependente
                </Button>
              </div>
              {erro ? <p role="alert" className="text-sm text-destructive">{erro}</p> : null}
              <div className="flex items-center justify-between gap-3">
                <Button variant="ghost" onClick={voltar}>Voltar</Button>
                <Button onClick={continuarVidas}>Continuar</Button>
              </div>
            </div>
          ) : null}

          {passo === "refino" ? (
            <form onSubmit={enviarRefino} className="grid gap-4">
              <h1 className="text-2xl leading-tight font-medium tracking-tight text-balance">Quer filtrar por algo?</h1>
              <Input
                label="Orçamento mensal total (R$)"
                inputMode="decimal"
                placeholder="Ex.: 1.500,00"
                value={refino.budget}
                onChange={e => {
                  setErro("");
                  setRefino(anterior => ({ ...anterior, budget: e.target.value }));
                }}
                description="Opcional. Mostra só os planos dentro do orçamento."
              />
              <Input
                label="Nome do plano ou código"
                value={refino.query}
                onChange={e => setRefino(anterior => ({ ...anterior, query: e.target.value }))}
                description="Opcional."
              />
              <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={refino.includeIncompatible}
                  onChange={e => setRefino(anterior => ({ ...anterior, includeIncompatible: e.target.checked }))}
                />
                Mostrar também planos que não atendem a este perfil
              </label>
              {erro ? <p role="alert" className="text-sm text-destructive">{erro}</p> : null}
              {pending ? <p role="status" className="text-sm text-muted-foreground">Conferindo preços e condições…</p> : null}
              <div className="flex items-center justify-between gap-3">
                <Button variant="ghost" onClick={voltar}>Voltar</Button>
                <Button type="submit" loading={pending}>Ver planos</Button>
              </div>
            </form>
          ) : null}
        </section>
      )}
    </div>
  );
}
