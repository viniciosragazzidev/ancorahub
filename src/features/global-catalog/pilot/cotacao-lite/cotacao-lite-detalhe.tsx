"use client";

import { useEffect, useState } from "react";
import { BottomSheet } from "@/components/arc/bottom-sheet/bottom-sheet";
import { Button } from "@/components/arc/button/button";
import { Input } from "@/components/arc/input/input";
import { Badge } from "@/components/arc/badge/badge";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import { activeAt, fold } from "../engine";
import type { PlanDetail, QuoteResult, SourceDetail } from "../contracts";
import { dinheiro, explicarPendencia, motivosDoPlano, podeGerarProposta } from "./cotacao-lite-model";
import { MensagemErro } from "./cotacao-lite-ui";

export type NetworkPage = {
  units: { id: string; nome?: string; tipo?: string; cidade?: string; bairro?: string; endereco?: string; cep?: string; telefone?: string }[];
  total: number;
  overall: number;
  page: number;
  pages: number;
  cities: string[];
};

export type CarregarPlano = (id: string) => Promise<{ data?: PlanDetail; error?: string }>;
export type CarregarRede = (input: { id: string; query: string; city: string; page: number }) => Promise<{ data?: NetworkPage; error?: string }>;

const ERRO_CONDICOES = "As condições não puderam ser carregadas. Tente de novo em instantes.";
const ERRO_REDE = "Não consegui carregar a rede agora. Tente de novo em instantes.";
const hoje = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

const SITUACAO: Record<QuoteResult["state"], string> = {
  ready: "Pronto para gerar a proposta.",
  pending: "Falta confirmar uma condição antes da proposta.",
  incompatible: "Não atende a este perfil.",
};

/** Fatos que o engine já devolve no resultado, na mesma ordem que o corretor compara. */
export function fatosDoPlano(plano: QuoteResult) {
  return [
    ["Acomodação", plano.accommodation || "Não informada"],
    ["Coparticipação", plano.coparticipation || "Não informada"],
    ["Abrangência", plano.coverage || "Não informada"],
    ["Entidade", plano.entity || "Não informada"],
    ["Odonto incluso", plano.dental === null ? "Sem confirmação" : plano.dental ? "Sim" : "Não"],
    ["Rede consultada", `${plano.networkCount.toLocaleString("pt-BR")} unidades`],
  ] as const;
}

export function CotacaoLiteDetalhe({
  plano,
  onClose,
  carregarPlano,
  carregarRede,
  onGerarProposta,
}: {
  plano: QuoteResult;
  onClose: () => void;
  carregarPlano: CarregarPlano;
  carregarRede: CarregarRede;
  onGerarProposta?: () => void;
}) {
  const [aba, setAba] = useState<"condicoes" | "rede">("condicoes");
  const [detalhe, setDetalhe] = useState<PlanDetail | null>(null);
  const [erroCondicoes, setErroCondicoes] = useState("");
  const [busca, setBusca] = useState("");
  const [carregandoCondicoes, setCarregandoCondicoes] = useState(true);
  const [tentativaCondicoes, setTentativaCondicoes] = useState(0);

  useEffect(() => {
    let atual = true;
    carregarPlano(plano.id).then(resultado => {
      if (!atual) return;
      if (resultado.error || !resultado.data) setErroCondicoes(ERRO_CONDICOES);
      else {
        setErroCondicoes("");
        setDetalhe(resultado.data);
      }
    }).finally(() => {
      if (atual) setCarregandoCondicoes(false);
    });
    return () => { atual = false; };
  }, [plano.id, tentativaCondicoes, carregarPlano]);

  function tentarCondicoesDeNovo() {
    setErroCondicoes("");
    setCarregandoCondicoes(true);
    setTentativaCondicoes(t => t + 1);
  }

  const dataHoje = hoje();
  const condicoes: SourceDetail[] = (detalhe?.details ?? []).filter(item =>
    item.ativo !== false && activeAt(item.vigencia_inicio || null, item.vigencia_fim || null, dataHoje) &&
    (!busca || fold([item.titulo, item.tipo_detalhe, item.resumo, item.conteudo, item.descricao].join(" ")).includes(fold(busca))),
  );

  return (
    <BottomSheet
      open
      onOpenChange={open => { if (!open) onClose(); }}
      title={plano.name}
      description={`${plano.operator}${plano.administrator ? ` · ${plano.administrator}` : ""}`}
      detents={[0.72, 0.95]}
      closeLabel="Fechar detalhes do plano"
      className="arc-venancor"
    >
      <div className="grid gap-5 px-5 pb-8">
        <div role="tablist" aria-label="Seções do plano" className="flex gap-2">
          <Button variant={aba === "condicoes" ? "primary" : "ghost"} aria-selected={aba === "condicoes"} role="tab" onClick={() => setAba("condicoes")}>Condições</Button>
          <Button variant={aba === "rede" ? "primary" : "ghost"} aria-selected={aba === "rede"} role="tab" onClick={() => setAba("rede")}>Rede e abrangência</Button>
        </div>

        {aba === "condicoes" ? (
          <>
            <section className="grid gap-3" aria-label="Situação do plano">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={plano.state === "ready" ? "success" : plano.state === "pending" ? "warning" : "danger"}>
                  {plano.state === "ready" ? "Pronto" : plano.state === "pending" ? "Falta confirmar" : "Não atende"}
                </Badge>
                <p className="text-sm">{SITUACAO[plano.state]}</p>
              </div>
              {plano.state === "pending" ? (
                <div className="grid gap-2 rounded-2xl border border-border bg-muted/40 p-4">
                  <p className="text-sm font-medium">{explicarPendencia(plano)}</p>
                  {motivosDoPlano(plano).length > 1 ? (
                    <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                      {motivosDoPlano(plano).slice(1).map(motivo => <li key={motivo}>{motivo}</li>)}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </section>

            <section className="grid gap-3" aria-label="Valores por vida">
              <h3 className="text-sm font-medium">Valores</h3>
              <p className="text-2xl font-semibold tabular-nums">{dinheiro(plano.totalCents)} <span className="text-sm font-normal text-muted-foreground">por mês</span></p>
              <ul className="grid gap-2 text-sm">
                {plano.perLife.map((vida, indice) => (
                  <li key={indice} className="flex justify-between gap-4">
                    <span>{vida.holder ? "Titular" : `Dependente ${indice}`} · {vida.age} anos</span>
                    <span className="tabular-nums">{dinheiro(vida.cents)}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="grid gap-3" aria-label="Coberturas e regras">
              <h3 className="text-sm font-medium">Coberturas e regras</h3>
              <dl className="grid gap-3 text-sm">
                {fatosDoPlano(plano).map(([rotulo, valor]) => (
                  <div key={rotulo} className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">{rotulo}</dt>
                    <dd className="text-right break-words">{valor}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="grid gap-3" aria-label="Condições da fonte">
              <h3 className="text-sm font-medium">Carências, reembolso e documentos</h3>
              {erroCondicoes ? (
                <div className="grid gap-3"><MensagemErro texto={erroCondicoes} /><Button variant="secondary" onClick={tentarCondicoesDeNovo}>Tentar de novo</Button></div>
              ) : carregandoCondicoes ? (
                <Skeleton label="Carregando condições do plano" lines={3} />
              ) : (
                <>
                  <Input label="Buscar nas condições" type="search" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Ex.: carência, reembolso" />
                  {condicoes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhuma condição ativa corresponde à busca.</p>
                  ) : (
                    <ul className="grid gap-3">
                      {condicoes.map(item => (
                        <li key={item.id}>
                          <details className="rounded-2xl border border-border p-4">
                            <summary className="cursor-pointer text-sm font-medium">{item.titulo || "Condição"}</summary>
                            <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed">{item.conteudo || item.descricao || item.resumo || "Sem texto complementar."}</p>
                          </details>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </section>

            {onGerarProposta && podeGerarProposta(plano) ? (
              <Button variant="secondary" onClick={onGerarProposta}>Gerar proposta em PDF</Button>
            ) : null}
          </>
        ) : (
          <CotacaoLiteRede id={plano.id} carregarRede={carregarRede} />
        )}
      </div>
    </BottomSheet>
  );
}

function CotacaoLiteRede({ id, carregarRede }: { id: string; carregarRede: CarregarRede }) {
  const [pedido, setPedido] = useState({ query: "", city: "", page: 1, tentativa: 0 });
  const [rede, setRede] = useState<NetworkPage | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const { query, city, page: pagina, tentativa } = pedido;

  /** Qualquer mudança de filtro, página ou nova tentativa passa por aqui: o estado de espera é ajustado no evento. */
  function pedir(parcial: Partial<typeof pedido>) {
    setErro("");
    setCarregando(true);
    setPedido(anterior => ({ ...anterior, ...parcial }));
  }

  useEffect(() => {
    let atual = true;
    carregarRede({ id, query, city, page: pagina }).then(resultado => {
      if (!atual) return;
      if (resultado.error || !resultado.data) setErro(ERRO_REDE);
      else {
        setErro("");
        setRede(resultado.data);
      }
    }).finally(() => { if (atual) setCarregando(false); });
    return () => { atual = false; };
  }, [id, query, city, pagina, tentativa, carregarRede]);

  return (
    <section className="grid gap-4" aria-label="Rede credenciada">
      <p className="text-sm text-muted-foreground">A rede reflete a consulta da fonte. Confira a competência e as observações da unidade antes de orientar o cliente.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Hospital, clínica, bairro ou endereço" value={query} onChange={e => pedir({ query: e.target.value, page: 1 })} />
        <label className="grid gap-2 text-sm font-medium">
          Município da unidade
          <select
            className="min-h-11 rounded-xl border border-border bg-background px-3 text-sm font-normal"
            value={city}
            onChange={e => pedir({ city: e.target.value, page: 1 })}
          >
            <option value="">Todos</option>
            {(rede?.cities ?? []).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
      </div>
      {erro ? (
        <div className="grid gap-3"><MensagemErro texto={erro} /><Button variant="secondary" onClick={() => pedir({ tentativa: tentativa + 1 })}>Tentar de novo</Button></div>
      ) : carregando && !rede ? (
        <Skeleton label="Carregando a rede deste plano" lines={4} />
      ) : rede ? (
        <>
          <p role="status" className="text-sm text-muted-foreground">{rede.total.toLocaleString("pt-BR")} unidades encontradas · {rede.overall.toLocaleString("pt-BR")} no plano</p>
          {rede.total === 0 ? <p className="text-sm text-muted-foreground">Nenhuma unidade neste filtro. Tente outro município ou termo.</p> : null}
          <ul className="grid gap-3">
            {rede.units.map(unidade => (
              <li key={unidade.id} className="grid gap-1 border-b border-border pb-3">
                <p className="text-sm font-medium break-words">{unidade.nome || "Unidade sem nome"}</p>
                <p className="text-xs text-muted-foreground">{[unidade.tipo, unidade.cidade, unidade.bairro].filter(Boolean).join(" · ")}</p>
                {unidade.endereco ? <p className="text-sm break-words">{unidade.endereco}{unidade.cep ? ` · CEP ${unidade.cep}` : ""}</p> : null}
                {unidade.telefone ? <p className="text-sm">Telefone: {unidade.telefone}</p> : null}
              </li>
            ))}
          </ul>
          {rede.pages > 1 ? (
            <nav aria-label="Páginas da rede" className="flex items-center justify-between gap-3">
              <Button variant="ghost" disabled={carregando || rede.page <= 1} onClick={() => pedir({ page: rede.page - 1 })}>Anterior</Button>
              <span className="text-sm">{rede.page} de {rede.pages}</span>
              <Button variant="ghost" disabled={carregando || rede.page >= rede.pages} onClick={() => pedir({ page: rede.page + 1 })}>Próxima</Button>
            </nav>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
