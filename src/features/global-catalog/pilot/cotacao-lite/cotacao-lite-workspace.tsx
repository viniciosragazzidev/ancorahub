"use client";

import { useId, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useReducedMotion } from "motion/react";
import { BuildingIcon, SmileIcon, UserIcon, UsersIcon } from "lucide-react";
import { Button } from "@/components/arc/button/button";
import { Input } from "@/components/arc/input/input";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import { getCatalogNetworkAction, getCatalogPlanAction, simulateCatalogAction } from "../actions";
import { exportCatalogProposalAction } from "../proposal-action";
import type { CatalogOptions, QuoteInput, QuoteResponse, QuoteResult } from "../contracts";
import {
  montarEntrada,
  orcamentoEmCentavos,
  passosDaModalidade,
  validarCidade,
  validarPerfil,
  validarVidas,
  type Passo,
  type Perfil,
  type Vida,
} from "./cotacao-lite-model";
import { CotacaoLiteDetalhe, type CarregarPlano, type CarregarRede } from "./cotacao-lite-detalhe";
import { CotacaoLiteResultados, LIMITE_COMPARACAO } from "./cotacao-lite-resultados";
import { MensagemErro, Opcao, PassoAnimado, ProgressoPassos, ResumoEscolhas } from "./cotacao-lite-ui";
import { CidadeCombobox } from "./cotacao-lite-cidade";

type Simular = (input: QuoteInput) => Promise<{ data?: QuoteResponse; error?: string }>;
export type ExportarProposta = (plano: QuoteResult, entrada: QuoteInput) => Promise<{ ok: true } | { erro: string }>;

const MODALIDADE: Record<QuoteInput["modality"], string> = {
  ADESAO: "Saúde por adesão",
  PME_EMPRESARIAL: "Saúde empresarial / PME",
  PESSOA_FISICA: "Saúde pessoa física",
  ADESAO_ODONTO: "Odonto por adesão",
  PME_EMPRESARIAL_ODONTO: "Odonto empresarial / PME",
  PESSOA_FISICA_ODONTO: "Odonto pessoa física",
};
const ICONE: Record<QuoteInput["modality"], ReactNode> = {
  ADESAO: <UsersIcon aria-hidden strokeWidth={1.5} className="size-4" />,
  PME_EMPRESARIAL: <BuildingIcon aria-hidden strokeWidth={1.5} className="size-4" />,
  PESSOA_FISICA: <UserIcon aria-hidden strokeWidth={1.5} className="size-4" />,
  ADESAO_ODONTO: <SmileIcon aria-hidden strokeWidth={1.5} className="size-4" />,
  PME_EMPRESARIAL_ODONTO: <SmileIcon aria-hidden strokeWidth={1.5} className="size-4" />,
  PESSOA_FISICA_ODONTO: <SmileIcon aria-hidden strokeWidth={1.5} className="size-4" />,
};
const MODALIDADES = Object.keys(MODALIDADE) as QuoteInput["modality"][];
const VINCULOS = ["Cônjuge", "Filho(a)", "Enteado(a)", "Pai / mãe", "Outro dependente"];
const ERRO_GERAL = "Não consegui concluir agora. Tente de novo em instantes.";
const PERFIL_VAZIO: Perfil = { businessProfile: "", businessMonths: "", profession: "", entity: "" };
const REFINO_VAZIO = { budget: "", query: "", includeIncompatible: false };

export type CotacaoLiteProps = {
  options: Pick<CatalogOptions, "cities" | "businessProfiles" | "entities">;
  counts: { plans: number };
  sourceDate: string;
  simular?: Simular;
  carregarPlano?: CarregarPlano;
  carregarRede?: CarregarRede;
  exportarProposta?: ExportarProposta;
  /** Municípios com mais planos, mostrados como atalhos acima do campo. */
  cidadesPopulares?: string[];
};

/** Gera o PDF pelo mesmo caminho do formulário completo: a ação do servidor confere tudo de novo. */
export async function baixarPropostaPadrao(plano: QuoteResult, entrada: QuoteInput): Promise<{ ok: true } | { erro: string }> {
  const resultado = await exportCatalogProposalAction({ planId: plano.id, profile: entrada });
  if (resultado.error || !resultado.data) {
    return { erro: [resultado.error, ...(resultado.reasons || [])].filter(Boolean).join(" ") || ERRO_GERAL };
  }
  const bytes = Uint8Array.from(atob(resultado.data.base64), c => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = resultado.data.filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return { ok: true };
}

export function CotacaoLiteWorkspace({
  options,
  counts,
  sourceDate,
  simular = simulateCatalogAction,
  carregarPlano = getCatalogPlanAction,
  carregarRede = getCatalogNetworkAction,
  exportarProposta = baixarPropostaPadrao,
  cidadesPopulares = [],
}: CotacaoLiteProps) {
  const reduzir = useReducedMotion();
  const [passo, setPasso] = useState<Passo>("modalidade");
  const [direcao, setDirecao] = useState<1 | -1>(1);
  const [modality, setModality] = useState<QuoteInput["modality"] | null>(null);
  const [city, setCity] = useState("");
  const [perfil, setPerfil] = useState<Perfil>(PERFIL_VAZIO);
  const [vidas, setVidas] = useState<Vida[]>([{ key: 1, age: "", holder: true, relationship: "Titular" }]);
  const proximaVida = useRef(2);
  const [refino, setRefino] = useState(REFINO_VAZIO);
  const [erro, setErro] = useState("");
  const [resposta, setResposta] = useState<QuoteResponse | null>(null);
  const [entrada, setEntrada] = useState<QuoteInput | null>(null);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [vista, setVista] = useState<"lista" | "comparar">("lista");
  const [detalhe, setDetalhe] = useState<QuoteResult | null>(null);
  const [pending, start] = useTransition();
  const versao = useRef(0);
  const perfilId = useId();

  const passos = passosDaModalidade(modality);
  const indice = passos.indexOf(passo);
  const proximo = (): Passo => passos[indice + 1] ?? passos[passos.length - 1];
  const emResultado = resposta !== null && entrada !== null;

  function irPara(alvo: Passo, sentido: 1 | -1 = 1) {
    setErro("");
    setDirecao(sentido);
    setPasso(alvo);
  }

  function voltar() {
    if (indice > 0) irPara(passos[indice - 1], -1);
  }

  function recomecar() {
    versao.current++;
    setResposta(null);
    setEntrada(null);
    setSelecionados([]);
    setVista("lista");
    setDetalhe(null);
    setErro("");
    setDirecao(-1);
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
      setSelecionados([]);
      setVista("lista");
    });
  }

  function escolherModalidade(valor: QuoteInput["modality"]) {
    setModality(valor);
    const caminho = passosDaModalidade(valor);
    setDirecao(1);
    setErro("");
    setPasso(caminho[1]);
  }

  function continuarCidade() {
    if (!modality) return recomecar();
    const mensagem = validarCidade(modality, city);
    if (mensagem) return setErro(mensagem);
    irPara(proximo());
  }

  function continuarPerfil() {
    if (!modality) return recomecar();
    const mensagem = validarPerfil(modality, perfil);
    if (mensagem) return setErro(mensagem);
    irPara(proximo());
  }

  function continuarVidas() {
    const mensagem = validarVidas(vidas);
    if (mensagem) return setErro(mensagem);
    irPara(proximo());
  }

  function enviarRefino(evento: FormEvent) {
    evento.preventDefault();
    if (!modality) return recomecar();
    if (orcamentoEmCentavos(refino.budget) === "invalido") {
      setErro("Informe um orçamento positivo, por exemplo 1.500,00.");
      return;
    }
    buscar(montarEntrada({ modality, vidas, city, perfil, budget: refino.budget, query: refino.query, includeIncompatible: refino.includeIncompatible }, 1));
  }

  function alternarSelecao(id: string) {
    setSelecionados(anterior => {
      if (anterior.includes(id)) return anterior.filter(item => item !== id);
      return anterior.length < LIMITE_COMPARACAO ? [...anterior, id] : anterior;
    });
  }

  async function gerarProposta(plano: QuoteResult) {
    if (!entrada) return;
    const resultado = await exportarProposta(plano, entrada);
    if ("erro" in resultado) setErro(resultado.erro);
  }

  function atualizarVida(key: number, campo: Partial<Vida>) {
    setErro("");
    setVidas(anterior => anterior.map(vida => (vida.key === key ? { ...vida, ...campo } : vida)));
  }

  const resumo: string[] = [];
  if (modality) resumo.push(MODALIDADE[modality]);
  if (city.trim() && modality) resumo.push(city.trim());
  if (modality?.startsWith("PME") && perfil.businessProfile) resumo.push(perfil.businessProfile);
  if (passo === "refino") resumo.push(`${vidas.length} ${vidas.length === 1 ? "vida" : "vidas"}`);

  return (
    <div className={`arc-venancor mx-auto flex w-full flex-col gap-6 px-4 pb-24 pt-4 sm:px-6 ${vista === "comparar" && emResultado ? "max-w-5xl" : "max-w-3xl"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Cotação · {counts.plans.toLocaleString("pt-BR")} planos na base de {sourceDate.split("-").reverse().join("/")}
        </p>
        <Link href="/cotacao?completo=1" className="text-xs text-muted-foreground underline underline-offset-4">
          Formulário completo
        </Link>
      </div>

      {!emResultado && !pending ? (
        <>
          <ProgressoPassos passos={passos} atual={passo} onVoltar={indice > 0 ? voltar : undefined} />
          {passo !== "modalidade" ? <ResumoEscolhas itens={resumo} /> : null}
        </>
      ) : null}

      {pending ? (
        <Skeleton label="Conferindo preços e condições" lines={5} />
      ) : emResultado ? (
        <>
          {detalhe ? (
            <CotacaoLiteDetalhe
              plano={detalhe}
              onClose={() => setDetalhe(null)}
              carregarPlano={carregarPlano}
              carregarRede={carregarRede}
              onGerarProposta={() => gerarProposta(detalhe)}
            />
          ) : null}
          <CotacaoLiteResultados
            resposta={resposta}
            selecionados={selecionados}
            onAlternarSelecao={alternarSelecao}
            onAbrir={setDetalhe}
            onComparar={() => setVista("comparar")}
            onVoltarLista={() => setVista("lista")}
            vista={vista}
            pending={pending}
            erro={erro}
            onPagina={pagina => entrada && buscar({ ...entrada, page: pagina })}
            onRecomecar={recomecar}
            onGerarProposta={gerarProposta}
            reduzir={reduzir}
          />
        </>
      ) : (
        <PassoAnimado chave={passo} direcao={direcao}>
          {passo === "modalidade" ? (
            <div className="grid gap-4">
              <h1 className="text-2xl leading-tight font-medium tracking-tight text-balance">Qual é o tipo de plano?</h1>
              <div role="group" aria-label="Modalidade" className="grid gap-2">
                {MODALIDADES.map(valor => (
                  <Opcao key={valor} selecionada={modality === valor} onSelect={() => escolherModalidade(valor)} icone={ICONE[valor]}>
                    {MODALIDADE[valor]}
                  </Opcao>
                ))}
              </div>
            </div>
          ) : null}

          {passo === "cidade" ? (
            <div className="grid gap-4">
              <h1 className="text-2xl leading-tight font-medium tracking-tight text-balance">Em qual município?</h1>
              <CidadeCombobox
                cidades={options.cities}
                populares={cidadesPopulares}
                valor={city}
                obrigatorio={modality?.startsWith("PME") ?? false}
                onEscolher={cidade => {
                  setErro("");
                  setCity(cidade);
                }}
              />
              {erro ? <MensagemErro texto={erro} /> : null}
              <div className="flex flex-wrap items-center justify-between gap-3">
                {modality && !modality.startsWith("PME") ? <Button variant="ghost" onClick={() => irPara(proximo())}>Pular</Button> : <span />}
                <Button onClick={continuarCidade}>Continuar</Button>
              </div>
            </div>
          ) : null}

          {passo === "perfil" && modality ? (
            <div className="grid gap-4">
              <h1 className="text-2xl leading-tight font-medium tracking-tight text-balance">
                {modality.startsWith("PME") ? "Qual é o perfil da empresa?" : "Qual é a adesão?"}
              </h1>
              {modality.startsWith("PME") ? (
                <>
                  <label htmlFor={perfilId} className="grid gap-2 text-sm font-medium">
                    Tipo de empresa
                    <select
                      id={perfilId}
                      required
                      className="min-h-11 rounded-xl border border-border bg-background px-3 text-sm font-normal"
                      value={perfil.businessProfile}
                      onChange={e => {
                        setErro("");
                        setPerfil(anterior => ({ ...anterior, businessProfile: e.target.value }));
                      }}
                    >
                      <option value="">Escolha o tipo</option>
                      {options.businessProfiles.map(p => <option key={p} value={p}>{p.replaceAll("_", " ")}</option>)}
                    </select>
                  </label>
                  <Input
                    label="Tempo de empresa (meses)"
                    type="number"
                    min={0}
                    max={2400}
                    required
                    value={perfil.businessMonths}
                    onChange={e => {
                      setErro("");
                      setPerfil(anterior => ({ ...anterior, businessMonths: e.target.value }));
                    }}
                    description="Exigido para confirmar as condições de cada plano."
                  />
                </>
              ) : (
                <>
                  <Input
                    label="Profissão ou categoria (opcional)"
                    value={perfil.profession}
                    onChange={e => setPerfil(anterior => ({ ...anterior, profession: e.target.value }))}
                    description="Se preencher, a entidade e os documentos exigidos são conferidos."
                  />
                  <label className="grid gap-2 text-sm font-medium">
                    Entidade (opcional)
                    <select
                      className="min-h-11 rounded-xl border border-border bg-background px-3 text-sm font-normal"
                      value={perfil.entity}
                      onChange={e => setPerfil(anterior => ({ ...anterior, entity: e.target.value }))}
                    >
                      <option value="">Qualquer entidade</option>
                      {options.entities.map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                  </label>
                </>
              )}
              {erro ? <MensagemErro texto={erro} /> : null}
              <div className="flex items-center justify-end">
                <Button onClick={continuarPerfil}>Continuar</Button>
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
              {erro ? <MensagemErro texto={erro} /> : null}
              <div className="flex items-center justify-between gap-3">
                <span />
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
              {erro ? <MensagemErro texto={erro} /> : null}
              <div className="flex items-center justify-between gap-3">
                <span />
                <Button type="submit">Ver planos</Button>
              </div>
            </form>
          ) : null}
        </PassoAnimado>
      )}
    </div>
  );
}
