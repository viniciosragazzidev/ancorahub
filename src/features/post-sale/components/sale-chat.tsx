"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";

import { Button } from "@/components/arc/button/button";
import { ChatScreen, type CustomBlockApi } from "@/components/chat/chat-screen";
import type { ChatBlock, ChatChoice, ChatScript } from "@/components/chat/types";
import { SaleCelebration, saleCelebrationStats, type SaleCelebrationStat } from "@/components/lite/celebration/sale-celebration";
import { LiteSuccess } from "@/components/lite/motion";
import { ASSISTANTS } from "@/features/broker-workspace/chat/assistant-scripts";
import { useFeedback } from "@/lib/feedback/use-feedback";

import {
  applySaleChoice,
  applySaleText,
  fixBlocks,
  mergeContractReading,
  money,
  nextSaleBlocks,
  PLAN_TYPE_LABEL,
  resetSaleAnswers,
  saleAwaiting,
  saleProgress,
  splitSaleChoice,
  type SaleAnswers,
  type SaleCatalog,
  type SaleContractReading,
} from "../conversation-sale-core";
import styles from "./sale-chat.module.css";

export type SaleChatLead = { id: string; name: string; initials: string; stageLabel: string; monthlyValue: number | null };

/** O que a conversa pede ao servidor (a prévia do laboratório troca por respostas simuladas). */
export type SaleChatServices = {
  readContract: (input: { leadId: string; file: File }) => Promise<{ ok: true; reading: SaleContractReading } | { ok: false; error: string }>;
  register: (input: {
    leadId: string;
    planType: NonNullable<SaleAnswers["planType"]>;
    ages: number[];
    carrierId: string | null;
    planId: string | null;
    approvedValue: number;
    coverageStartDate: string;
    source: "conversa" | "contrato";
  }) => Promise<{ success: true; saleId: string } | { success?: undefined; error: string }>;
};

const identity = { name: ASSISTANTS.ancora.name, shape: ASSISTANTS.ancora.shape, hue: ASSISTANTS.ancora.hue };
const ACCEPT = "application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif";

/**
 * Registrar venda em conversa (19/11). Três etapas no total: escolher o cliente (antes desta tela), responder
 * (ou mandar o contrato) e confirmar. Sem formulário e sem documentos nesta fase.
 */
export function SaleChat(props: { lead: SaleChatLead; catalog: SaleCatalog; services: SaleChatServices; today?: Date; backHref?: string; doneHref?: string }) {
  const [run, setRun] = useState(0);
  return <SaleConversation key={run} {...props} onRestart={() => setRun((value) => value + 1)} />;
}

function SaleConversation({ lead, catalog, services, today: fixedToday, backHref = "/dashboard", doneHref, onRestart }: {
  lead: SaleChatLead; catalog: SaleCatalog; services: SaleChatServices; today?: Date; backHref?: string; doneHref?: string; onRestart: () => void;
}) {
  const router = useRouter();
  const fire = useFeedback();
  const today = useMemo(() => fixedToday ?? new Date(), [fixedToday]);
  const [answers, setAnswers] = useState<SaleAnswers>({});
  const answersRef = useRef<SaleAnswers>({});
  const files = useRef(new Map<string, File>());
  const round = useRef(0);
  const otherDate = useRef(false);
  const [awaitingDate, setAwaitingDate] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [celebration, setCelebration] = useState<{ key: string; stats: SaleCelebrationStat[] } | null>(null);
  const context = useMemo(() => ({ today, leadValue: lead.monthlyValue }), [today, lead.monthlyValue]);
  const firstName = lead.name.split(" ")[0] ?? lead.name;

  const script = useMemo<ChatScript>(() => ({
    status: { label: "Esperando você", tone: "waiting" },
    blocks: [
      { type: "client", id: "c-lead", name: lead.name, initials: lead.initials, chips: [{ label: lead.stageLabel, tone: "info" }] },
      { type: "assistant", id: "a-intro", text: `Vamos registrar a venda de ${firstName}! Tem o contrato ou a proposta aí? Manda uma foto ou o PDF que eu leio e preencho tudo.` },
      { type: "custom", id: "upload-0", kind: "upload", data: null },
      { type: "question", id: "q-mode", prompt: "Sem o contrato à mão?", choices: [{ id: "mode-ask", label: "Responder as perguntas", hint: "São 6, rapidinho", action: { kind: "local", value: "ask:1" } }] },
    ],
  }), [firstName, lead.initials, lead.name, lead.stageLabel]);

  const commit = useCallback((next: SaleAnswers) => {
    answersRef.current = next;
    setAnswers(next);
  }, []);

  const next = useCallback((current: SaleAnswers) => nextSaleBlocks(current, catalog, { ...context, turn: ++round.current }), [catalog, context]);

  const register = useCallback(async (): Promise<ChatBlock[]> => {
    const current = answersRef.current;
    const turn = ++round.current;
    if (saleAwaiting(current, catalog) !== "done" || !current.planType || !current.ages || !current.monthlyValue || !current.coverageStartDate) return next(current);
    let result: Awaited<ReturnType<SaleChatServices["register"]>>;
    try {
      result = await services.register({
        leadId: lead.id,
        planType: current.planType,
        ages: current.ages,
        carrierId: current.carrierId ?? null,
        planId: current.planId ?? null,
        approvedValue: current.monthlyValue,
        coverageStartDate: current.coverageStartDate,
        source: current.fromContract ? "contrato" : "conversa",
      });
    } catch {
      result = { error: "Sem conexão com o servidor. Confira a internet." };
    }
    if (!("success" in result) || !result.success) {
      fire("error");
      return [
        { type: "assistant", id: `a-error-${turn}`, text: `${result.error} A venda ainda não foi registrada; suas respostas continuam aqui.` },
        { type: "question", id: `q-retry-${turn}`, prompt: "Como quer seguir?", choices: [{ id: "retry", label: "Tentar de novo", action: { kind: "local", value: "confirm:1" } }, { id: "fix", label: "Corrigir algo", action: { kind: "local", value: "fix:1" } }] },
      ];
    }
    // Registrar venda é nível 3 (FEEDBACK.md): a tela cheia aparece quando o limite do dia e as preferências deixam.
    const plan = fire("celebrate", { budgetKey: "venda" });
    setRegistered(true);
    if (plan.celebrate) setCelebration({ key: `${lead.id}-${result.saleId}`, stats: saleCelebrationStats({ approvedValue: current.monthlyValue, contractTermMonths: 12 }) });
    return [
      { type: "custom", id: `done-${turn}`, kind: "done", data: { text: `${firstName} agora é cliente, ${PLAN_TYPE_LABEL[current.planType].toLowerCase()} de ${money(current.monthlyValue)} por mês. Os documentos ficam para depois.` } },
      { type: "button", id: `b-lead-${turn}`, label: `Abrir ${firstName}`, href: doneHref ?? `/leads/${encodeURIComponent(lead.id)}`, tone: "action" },
    ];
  }, [catalog, doneHref, fire, firstName, lead.id, next, services]);

  const readContract = useCallback(async (token: string): Promise<ChatBlock[]> => {
    const file = files.current.get(token);
    const turn = ++round.current;
    if (!file) return [];
    let result: Awaited<ReturnType<SaleChatServices["readContract"]>>;
    try {
      result = await services.readContract({ leadId: lead.id, file });
    } catch {
      result = { ok: false, error: "Sem conexão com o servidor. Confira a internet." };
    }
    if (!result.ok) {
      return [
        { type: "assistant", id: `a-read-error-${turn}`, text: result.error },
        { type: "custom", id: `upload-${turn}`, kind: "upload", data: null },
        { type: "question", id: `q-mode-${turn}`, prompt: "Ou, se preferir", choices: [{ id: "mode-ask", label: "Responder as perguntas", action: { kind: "local", value: "ask:1" } }] },
      ];
    }
    const merged = mergeContractReading(answersRef.current, result.reading, catalog);
    commit(merged.answers);
    const done = saleAwaiting(merged.answers, catalog) === "done";
    const text = merged.found.length
      ? `Li o contrato: ${merged.found.join(", ")}.${done ? "" : " Falta pouco, só o que não estava escrito."}`
      : "Li o contrato, mas não achei os dados da venda nele. Vou te perguntar rapidinho.";
    return [{ type: "assistant", id: `a-read-${turn}`, text }, ...next(merged.answers)];
  }, [catalog, commit, lead.id, next, services]);

  const onLocalChoice = useCallback(async (_choice: ChatChoice, value: string): Promise<ChatBlock[]> => {
    if (registered) return [];
    const current = answersRef.current;
    const [field, raw] = splitSaleChoice(value);
    switch (field) {
      case "restart": onRestart(); return [];
      case "ask": return next(current);
      case "contract": return readContract(raw);
      case "confirm": return register();
      case "fix": return fixBlocks(++round.current);
      case "reset": {
        const reset = resetSaleAnswers(current, raw);
        commit(reset);
        return next(reset);
      }
      case "startOther":
        otherDate.current = true;
        setAwaitingDate(true);
        return [{ type: "assistant", id: `a-date-${++round.current}`, text: "Qual a data do início da vigência? Ex.: 10/12/2026" }];
    }
    const applied = applySaleChoice(current, value, catalog);
    if (!applied) return [];
    commit(applied);
    return next(applied);
  }, [catalog, commit, next, onRestart, readContract, register, registered]);

  const onFreeText = useCallback(async (text: string): Promise<ChatBlock[]> => {
    const turn = ++round.current;
    if (registered) return [{ type: "assistant", id: `a-after-${turn}`, text: "A venda já foi registrada. Toque no botão acima para abrir o cliente." }];
    const current = answersRef.current;
    if (otherDate.current) {
      const outcome = applySaleText({ ...current, coverageStartDate: undefined }, text, catalog, today);
      if ("error" in outcome) return [{ type: "assistant", id: `a-date-error-${turn}`, text: outcome.error }];
      otherDate.current = false;
      setAwaitingDate(false);
      commit(outcome.answers);
      return next(outcome.answers);
    }
    const outcome = applySaleText(current, text, catalog, today);
    if ("error" in outcome) return [{ type: "assistant", id: `a-text-error-${turn}`, text: outcome.error }];
    commit(outcome.answers);
    return next(outcome.answers);
  }, [catalog, commit, next, registered, today]);

  const localWorkingLabel = useCallback((value: string) => {
    const [field] = splitSaleChoice(value);
    if (field === "contract") return "Lendo o contrato…";
    if (field === "confirm") return "Registrando a venda…";
    return null;
  }, []);

  const renderCustom = useCallback((block: Extract<ChatBlock, { type: "custom" }>, api: CustomBlockApi) => {
    if (block.kind === "upload") {
      return (
        <ContractUpload
          disabled={registered}
          onFile={(file) => {
            const token = `${block.id}-${Date.now()}`;
            files.current.set(token, file);
            api.local(`Enviei ${file.name}`, `contract:${token}`);
          }}
        />
      );
    }
    if (block.kind === "done") {
      const data = block.data as { text: string };
      return (
        <section className={styles.done} aria-label="Venda registrada">
          <LiteSuccess label="Venda registrada" className={styles.doneTitle} />
          <p className={styles.doneText}>{data.text}</p>
        </section>
      );
    }
    return null;
  }, [registered]);

  const waiting = saleAwaiting(answers, catalog);
  const flowDone = waiting === "done" || registered;
  const placeholder = awaitingDate ? "Ex.: 10/12/2026"
    : waiting === "ages" ? (answers.planType === "individual" ? "Ex.: 35" : "Ex.: 35, 32, 8")
      : waiting === "value" ? "Ex.: 1.250,90"
        : flowDone ? "Escolha uma opção acima" : undefined;
  const composerInput = awaitingDate ? { label: "Data do início da vigência" }
    : waiting === "ages" ? { inputMode: "numeric" as const, label: "Idades, o titular primeiro, separadas por vírgula" }
      : waiting === "value" ? { inputMode: "numeric" as const, label: "Valor mensal da venda" } : undefined;
  const started = Object.keys(answers).length > 0;

  return (
    <div className={`arc-venancor ${styles.root}`}>
      <ChatScreen
        identity={identity}
        backHref={backHref}
        script={script}
        onLocalChoice={onLocalChoice}
        onFreeText={onFreeText}
        localWorkingLabel={localWorkingLabel}
        renderCustom={renderCustom}
        closePassedQuestions
        progress={flowDone || !started ? null : saleProgress(answers)}
        placeholder={placeholder}
        composerInput={composerInput}
      />
      {celebration ? (
        <SaleCelebration open celebrationKey={celebration.key} stats={celebration.stats} feedback={false} onClose={() => { setCelebration(null); router.refresh(); }} />
      ) : null}
    </div>
  );
}

function ContractUpload({ onFile, disabled }: { onFile: (file: File) => void; disabled: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [sent, setSent] = useState(false);
  return (
    <section className={styles.upload} aria-label="Enviar o contrato">
      <div className={styles.uploadTop}>
        <span className={styles.uploadIcon} aria-hidden><FileText size={20} /></span>
        <div>
          <p className={styles.uploadTitle}>Contrato ou proposta</p>
          <p className={styles.uploadText}>Foto ou PDF. Eu acho as vidas, a operadora, o plano e o valor.</p>
        </div>
      </div>
      <input
        ref={input}
        className={styles.file}
        type="file"
        accept={ACCEPT}
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          setSent(true);
          onFile(file);
        }}
      />
      <Button variant="secondary" className={styles.uploadButton} disabled={disabled || sent} onClick={() => input.current?.click()}>
        {sent ? "Contrato enviado" : "Enviar foto ou PDF"}
      </Button>
    </section>
  );
}
