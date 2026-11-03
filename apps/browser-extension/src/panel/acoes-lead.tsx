import { useState } from "react";
import { LEAD_STATUS_LABELS, MOTIVOS_PERDA, MOTIVO_PERDA_LABELS, VALID_TRANSITIONS, type MotivoPerda } from "../../../../src/features/leads/lead-status-constants";
import type { LeadAmpliado } from "../shared/types";

export type PedidoAcao =
  | { tipo: "etapa"; statusId: string; motivoPerda?: MotivoPerda }
  | { tipo: "nota"; conteudo: string }
  | { tipo: "tarefa"; titulo: string }
  | { tipo: "lembrete"; when: "today" | "tomorrow" | "in_2_days" };

export type ResultadoAcao = { ok: true } | { ok: false; conflito?: boolean; mensagem: string };

const PRESETS_LEMBRETE: { when: "today" | "tomorrow" | "in_2_days"; rotulo: string }[] = [
  { when: "today", rotulo: "Hoje às 18h" },
  { when: "tomorrow", rotulo: "Amanhã às 9h" },
  { when: "in_2_days", rotulo: "Em 2 dias" },
];

/** Etapas para onde o lead pode ir a partir da atual (mesma tabela do CRM). */
export function opcoesDeEtapa(etapaId?: string) {
  const destinos = etapaId ? VALID_TRANSITIONS[etapaId] ?? [] : [];
  return destinos.map((id) => ({ id, label: LEAD_STATUS_LABELS[id] ?? id }));
}

/** Regras que a extensão mostra antes de enviar. O servidor valida de novo. */
export function validarPedido(pedido: PedidoAcao): string | null {
  if (pedido.tipo === "etapa" && pedido.statusId === "lost" && !pedido.motivoPerda) return "Escolha o motivo da perda.";
  if (pedido.tipo === "nota" && !pedido.conteudo.trim()) return "Escreva a nota antes de salvar.";
  if (pedido.tipo === "tarefa" && pedido.titulo.trim().length < 3) return "Informe um título com ao menos 3 letras.";
  return null;
}

/** Ações do corretor sobre o lead. Tudo passa pelo CRM; nada é enviado ao cliente por aqui. */
export function AcoesLead({ lead, acao }: { lead: LeadAmpliado; acao(pedido: PedidoAcao): Promise<ResultadoAcao> }) {
  const [etapa, setEtapa] = useState("");
  const [motivo, setMotivo] = useState("");
  const [nota, setNota] = useState("");
  const [titulo, setTitulo] = useState("");
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const opcoes = opcoesDeEtapa(lead.etapaId);

  async function enviar(pedido: PedidoAcao, depois: () => void) {
    const erro = validarPedido(pedido);
    if (erro) return setAviso({ tipo: "erro", texto: erro });
    setOcupado(true);
    const resultado = await acao(pedido);
    setOcupado(false);
    if (resultado.ok) {
      depois();
      return setAviso({ tipo: "ok", texto: "Salvo no CRM." });
    }
    setAviso({ tipo: "erro", texto: resultado.conflito ? "Este lead mudou em outro lugar. Atualizamos a tela." : resultado.mensagem });
  }

  return (
    <section className="secao bloco-acoes" aria-label="Ações do lead">
      <h2>Ações</h2>

      <div className="campo-acao">
        <label htmlFor="acao-etapa" className="rotulo">Mudar etapa</label>
        <select id="acao-etapa" value={etapa} disabled={ocupado || !opcoes.length} onChange={(evento) => setEtapa(evento.target.value)}>
          <option value="">{opcoes.length ? "Escolha a etapa" : "Sem etapas disponíveis"}</option>
          {opcoes.map((opcao) => <option key={opcao.id} value={opcao.id}>{opcao.label}</option>)}
        </select>
        {etapa === "lost" ? (
          <select aria-label="Motivo da perda" value={motivo} disabled={ocupado} onChange={(evento) => setMotivo(evento.target.value)}>
            <option value="">Motivo da perda (obrigatório)</option>
            {MOTIVOS_PERDA.map((codigo) => <option key={codigo} value={codigo}>{MOTIVO_PERDA_LABELS[codigo]}</option>)}
          </select>
        ) : null}
        <button className="seco" type="button" disabled={ocupado || !etapa} onClick={() => enviar(
          { tipo: "etapa", statusId: etapa, motivoPerda: etapa === "lost" ? (motivo as MotivoPerda) : undefined },
          () => { setEtapa(""); setMotivo(""); },
        )}>Salvar etapa</button>
      </div>

      <div className="campo-acao">
        <label htmlFor="acao-nota" className="rotulo">Nota interna</label>
        <textarea id="acao-nota" rows={3} value={nota} disabled={ocupado} onChange={(evento) => setNota(evento.target.value)} placeholder="Escreva uma nota para você ou para a equipe" />
        <button className="seco" type="button" disabled={ocupado} onClick={() => enviar({ tipo: "nota", conteudo: nota }, () => setNota(""))}>Salvar nota</button>
      </div>

      <div className="campo-acao">
        <span className="rotulo">Retorno</span>
        <div className="acoes">
          {PRESETS_LEMBRETE.map((preset) => (
            <button key={preset.when} className="seco" type="button" disabled={ocupado} onClick={() => enviar({ tipo: "lembrete", when: preset.when }, () => undefined)}>{preset.rotulo}</button>
          ))}
        </div>
      </div>

      <div className="campo-acao">
        <label htmlFor="acao-tarefa" className="rotulo">Tarefa</label>
        <input id="acao-tarefa" value={titulo} disabled={ocupado} onChange={(evento) => setTitulo(evento.target.value)} placeholder="Ex.: enviar a proposta" />
        <button className="seco" type="button" disabled={ocupado} onClick={() => enviar({ tipo: "tarefa", titulo }, () => setTitulo(""))}>Criar tarefa</button>
      </div>

      {aviso ? <p className={aviso.tipo === "ok" ? "aviso-ok" : "aviso-erro"} role={aviso.tipo === "erro" ? "alert" : "status"}>{aviso.texto}</p> : null}
    </section>
  );
}
