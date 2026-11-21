"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, Check, Loader2, RotateCcw } from "lucide-react";

import { catalogEntry } from "@/features/agent/catalog-meta";
import { confirmLevelFor } from "@/features/agent/policy";
import type { ToolResult } from "@/features/agent/types";
import { useFeedback } from "@/lib/feedback/use-feedback";

/**
 * Cartões de passo do Agente IA (plano §5.9): cada parte `tool-*` do ai@7 vira um passo legível.
 * Sucesso só depois do servidor (output-available); erro diz a causa e que nada mudou; Desfazer por 10 min.
 */
export type ToolPart = {
  type: string;
  toolCallId: string;
  state: "input-streaming" | "input-available" | "approval-requested" | "approval-responded" | "output-available" | "output-error" | "output-denied";
  input?: Record<string, unknown>;
  output?: unknown;
  errorText?: string;
  approval?: { id: string; approved?: boolean; reason?: string; isAutomatic?: boolean };
};

export function isToolPart(part: { type: string }): part is ToolPart {
  return part.type.startsWith("tool-");
}

export function toolNameOf(part: ToolPart) {
  return part.type.slice("tool-".length);
}

/** Rótulos de vagas já vistos na conversa (saídas de plantao_cadeiras_livres / plantao_escala), por ocorrencia_id. */
export function seatLabelsFrom(parts: ReadonlyArray<{ type: string }>) {
  const labels = new Map<string, string>();
  for (const part of parts) {
    if (!isToolPart(part) || part.state !== "output-available") continue;
    const data = (part.output as ToolResult | undefined)?.data as Record<string, unknown> | undefined;
    for (const key of ["vagas", "ocorrencias", "proximas", "escalado", "removido"]) {
      const rows = data?.[key];
      if (!Array.isArray(rows)) continue;
      for (const row of rows as Array<{ ocorrencia_id?: string; rotulo?: string }>) {
        if (row.ocorrencia_id && row.rotulo) labels.set(row.ocorrencia_id, row.rotulo);
      }
    }
  }
  return labels;
}

function fallbackSeatLabel(id: string) {
  const date = id.slice(-10);
  return `${date.slice(8, 10)}/${date.slice(5, 7)}`;
}

function StepLine({ icon, children, tone }: { icon: React.ReactNode; children: React.ReactNode; tone?: "muted" | "danger" }) {
  return (
    <div className={`director-agent-step${tone === "danger" ? " is-danger" : ""}`} role={tone === "danger" ? "alert" : undefined}>
      <span className="director-agent-step-icon" aria-hidden="true">{icon}</span>
      <div className="director-agent-step-body">{children}</div>
    </div>
  );
}

function ResultText({ text }: { text: string }) {
  return <p className="director-agent-result-text">{text}</p>;
}

function UndoButton({ actionId, undo }: { actionId: string; undo: (actionId: string) => Promise<{ ok: boolean; message: string }> }) {
  const feedback = useFeedback();
  const [state, setState] = useState<"idle" | "sending" | "done" | "failed">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const run = async () => {
    if (state === "sending" || state === "done") return;
    feedback("tap");
    setState("sending");
    const result = await undo(actionId).catch(() => ({ ok: false, message: "Sem conexão. Nada mudou." }));
    setState(result.ok ? "done" : "failed");
    setMessage(result.message);
    feedback(result.ok ? "confirm" : "error");
  };
  return (
    <div className="director-agent-undo">
      <button type="button" className="director-agent-link-button" onClick={run} disabled={state === "sending" || state === "done"} aria-busy={state === "sending"}>
        {state === "sending" ? <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <RotateCcw className="size-3.5" aria-hidden="true" />}
        {state === "done" ? "Desfeito" : state === "failed" ? "Tentar desfazer de novo" : "Desfazer"}
      </button>
      {message ? <span className="director-agent-undo-message" role="status">{message}</span> : null}
    </div>
  );
}

function ApprovalCard({ part, seatLabels, onRespond }: {
  part: ToolPart;
  seatLabels: Map<string, string>;
  onRespond: (approvalId: string, approved: boolean) => void;
}) {
  const feedback = useFeedback();
  const name = toolNameOf(part);
  const entry = catalogEntry(name);
  const input = part.input ?? {};
  const level = entry ? confirmLevelFor(entry, input) : "toque";
  const ids = Array.isArray(input.ocorrencia_ids) ? (input.ocorrencia_ids as string[]) : [];
  const [sent, setSent] = useState<"yes" | "no" | null>(null);
  const verb = name === "plantao_tirar_de_vagas" ? "Tirar" : "Escalar";
  const count = ids.length;
  const title = name === "plantao_escalar_em_vagas"
    ? `${verb} em ${count} ${count === 1 ? "plantão" : "plantões"}?`
    : name === "plantao_tirar_de_vagas" ? `${verb} de ${count} ${count === 1 ? "plantão" : "plantões"}?` : `${entry?.title ?? "Confirmar"}?`;
  const respond = (approved: boolean) => {
    if (sent || !part.approval) return;
    feedback("tap");
    setSent(approved ? "yes" : "no");
    onRespond(part.approval.id, approved);
  };
  return (
    <div className={`director-agent-card${level === "forte" ? " is-strong" : ""}`} role="group" aria-label={title}>
      <p className="director-agent-card-title">{title}</p>
      {ids.length ? (
        <ul className="director-agent-card-list">
          {ids.slice(0, 8).map((id) => <li key={id}>{seatLabels.get(id) ?? fallbackSeatLabel(id)}</li>)}
          {ids.length > 8 ? <li>e mais {ids.length - 8}</li> : null}
        </ul>
      ) : null}
      {entry?.risk.notifies ? <p className="director-agent-card-note">A pessoa recebe aviso no app.</p> : null}
      <div className="director-agent-card-actions">
        <button type="button" className="director-agent-confirm" onClick={() => respond(true)} disabled={Boolean(sent)} aria-busy={sent === "yes"}>
          {sent === "yes" ? <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
          {name === "plantao_escalar_em_vagas" ? `Escalar em ${count}` : name === "plantao_tirar_de_vagas" ? `Tirar de ${count}` : "Confirmar"}
        </button>
        <button type="button" className="director-agent-link-button" onClick={() => respond(false)} disabled={Boolean(sent)}>
          Não fazer
        </button>
      </div>
    </div>
  );
}

function ChoiceCard({ part, onChoose }: { part: ToolPart; onChoose: (toolCallId: string, choice: { id: string; rotulo: string }) => void }) {
  const feedback = useFeedback();
  const [picked, setPicked] = useState<string | null>(null);
  const input = part.input as { pergunta?: string; opcoes?: Array<{ id: string; rotulo: string; detalhe?: string }> } | undefined;
  if (!input?.opcoes?.length) return null;
  return (
    <div className="director-agent-card" role="group" aria-label={input.pergunta ?? "Escolha"}>
      <p className="director-agent-card-title">{input.pergunta}</p>
      <div className="director-agent-choices">
        {input.opcoes.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`director-agent-choice${picked === option.id ? " is-picked" : ""}`}
            disabled={Boolean(picked)}
            onClick={() => {
              feedback("tap");
              setPicked(option.id);
              onChoose(part.toolCallId, { id: option.id, rotulo: option.rotulo });
            }}
          >
            <span>{option.rotulo}</span>
            {option.detalhe ? <span className="director-agent-choice-detail">{option.detalhe}</span> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

export function AgentToolPart({ part, seatLabels, onApprove, onChoose, undo }: {
  part: ToolPart;
  seatLabels: Map<string, string>;
  onApprove: (approvalId: string, approved: boolean) => void;
  onChoose: (toolCallId: string, choice: { id: string; rotulo: string }) => void;
  undo: (actionId: string) => Promise<{ ok: boolean; message: string }>;
}) {
  const name = toolNameOf(part);
  const entry = catalogEntry(name);

  if (name === "escolher") {
    if (part.state === "output-available") {
      const chosen = part.output as { rotulo?: string } | undefined;
      return <StepLine icon={<Check className="size-3.5" />}>Escolhido: {chosen?.rotulo ?? "ok"}</StepLine>;
    }
    return <ChoiceCard part={part} onChoose={onChoose} />;
  }

  switch (part.state) {
    case "input-streaming":
    case "input-available":
    case "approval-responded":
      return <StepLine icon={<Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />}>{entry?.doing ?? "Trabalhando…"}</StepLine>;
    case "approval-requested":
      if (part.approval?.isAutomatic) return <StepLine icon={<Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />}>{entry?.doing ?? "Trabalhando…"}</StepLine>;
      return <ApprovalCard part={part} seatLabels={seatLabels} onRespond={onApprove} />;
    case "output-denied":
      return <StepLine icon={<AlertCircle className="size-3.5" />} tone="danger">Não feito.{part.approval?.reason ? ` ${part.approval.reason}` : ""}</StepLine>;
    case "output-error":
      return <StepLine icon={<AlertCircle className="size-3.5" />} tone="danger">Não consegui concluir. Nada foi alterado.</StepLine>;
    case "output-available": {
      const result = part.output as ToolResult | undefined;
      if (!result) return null;
      // Leitura: o texto final do agente já resume; o passo fica curto.
      if (entry?.risk.readOnly) {
        return (
          <StepLine icon={result.ok ? <Check className="size-3.5" /> : <AlertCircle className="size-3.5" />} tone={result.ok ? undefined : "danger"}>
            {entry.title}
            {result.href ? <> · <Link className="director-agent-inline-link" href={result.href}>Ver na tela</Link></> : null}
          </StepLine>
        );
      }
      return (
        <StepLine icon={result.ok ? <Check className="size-3.5" /> : <AlertCircle className="size-3.5" />} tone={result.ok ? undefined : "danger"}>
          <ResultText text={result.message} />
          <div className="director-agent-result-actions">
            {result.ok && result.undo && result.actionId ? <UndoButton actionId={result.actionId} undo={undo} /> : null}
            {result.href ? <Link className="director-agent-inline-link" href={result.href}>Ver na tela</Link> : null}
          </div>
        </StepLine>
      );
    }
    default:
      return null;
  }
}
