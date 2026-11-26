"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { FileText, Paperclip } from "lucide-react";

import { Button } from "@/components/arc/button/button";
import { motionTokens } from "@/components/arc/motion-tokens";
import { ChatScreen, type CustomBlockApi } from "@/components/chat/chat-screen";
import type { ChatBlock, ChatChoice, ChatScript } from "@/components/chat/types";
import { SaleCelebration, saleCelebrationStats, type SaleCelebrationStat } from "@/components/lite/celebration/sale-celebration";
import { LiteSuccess } from "@/components/lite/motion";
import { useInterfaceMotionEnabled } from "@/components/motion/interface-motion-provider";
import { ASSISTANTS } from "@/features/broker-workspace/chat/assistant-scripts";
import { useFeedback } from "@/lib/feedback/use-feedback";
import { takeSaleDraft, type SaleSpokenDraft } from "@/features/sasa/drafts";
import { mergeSpokenSale } from "@/features/sasa/draft-merge";

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
  saleCatalogSelection,
  saleProgress,
  splitSaleChoice,
  type ExtractedRow,
  type SaleAnswers,
  type SaleCatalog,
  type SaleContractFile,
  type SaleContractReading,
  type SalePaymentMethod,
  type SalePerson,
  type SaleReviewData,
  holderPerson,
  withHolderAge,
} from "../conversation-sale-core";
import styles from "./sale-chat.module.css";

export type SaleChatLead = { id: string; name: string; initials: string; stageLabel: string; monthlyValue: number | null };

/** O que a conversa pede ao servidor (a prévia do laboratório troca por respostas simuladas). */
export type SaleChatServices = {
  /** Lê o contrato e guarda o arquivo (file: null quando não deu para guardar; a leitura continua valendo). */
  readContract: (input: { leadId: string; file: File }) => Promise<{ ok: true; reading: SaleContractReading; file: SaleContractFile | null } | { ok: false; error: string }>;
  register: (input: {
    leadId: string;
    planType: NonNullable<SaleAnswers["planType"]>;
    ages: number[];
    /** Operadora e plano do catálogo antigo (ligados à venda e às comissões); null quando o plano é do catálogo novo. */
    carrierId: string | null;
    planId: string | null;
    /** O plano escolhido, de qualquer catálogo: vai para o lead. */
    leadPlanId?: string | null;
    carrierName?: string | null;
    planName?: string | null;
    approvedValue: number;
    coverageStartDate: string;
    source: "conversa" | "contrato";
    people?: SalePerson[];
    /** Titular confirmado na conversa (26/11/2026): nome, nascimento e CPF substituem os do lead. */
    holderConfirmed?: boolean;
    /** CNPJ da empresa titular (14 dígitos), quando o titular é empresa. */
    holderCnpj?: string | null;
    policyNumber?: string | null;
    paymentMethod?: SalePaymentMethod | null;
    contractTermMonths?: number | null;
    contract?: SaleContractFile | null;
  }) => Promise<{ success: true; saleId: string } | { success?: undefined; error: string }>;
};

const identity = { name: ASSISTANTS.ancora.name, shape: ASSISTANTS.ancora.shape, hue: ASSISTANTS.ancora.hue };
const ACCEPT = "application/pdf,image/jpeg,image/png";
const ACCEPTED = new Set(["application/pdf", "image/jpeg", "image/png"]);
const MAX_BYTES = 10 * 1024 * 1024;

type ContractPhase = { blockId: string; name: string; preview: string | null; phase: "reading" | "read" | "failed" };
/** A conversa guarda os blocos já desenhados: o estado da leitura chega ao cartão por contexto, não por props. */
const ContractPhaseContext = createContext<{ phase: ContractPhase | null; registered: boolean }>({ phase: null, registered: false });

/**
 * Registrar venda em conversa (19/11). Três etapas no total: escolher o cliente (antes desta tela), mandar o
 * contrato (a IA lê tudo) ou responder, e confirmar. Sem formulário.
 */
export function SaleChat(props: { lead: SaleChatLead; catalog: SaleCatalog; services: SaleChatServices; today?: Date; backHref?: string; doneHref?: string; /** O que o corretor disse ao Sasá ("fechou a venda do Carlos…"); sem ele, a tela procura o rascunho guardado no aparelho. */ spokenDraft?: SaleSpokenDraft | null }) {
  const [run, setRun] = useState(0);
  // Sasá (fase 4): o rascunho é lido uma vez, no aparelho, antes da primeira pergunta.
  const [draft, setDraft] = useState<SaleSpokenDraft | null | undefined>(props.spokenDraft === undefined ? undefined : props.spokenDraft);
  const leadId = props.lead.id;
  useEffect(() => { if (draft === undefined) setDraft(takeSaleDraft(leadId)); }, [draft, leadId]);
  if (draft === undefined) return null;
  return <SaleConversation key={run} {...props} draft={run === 0 ? draft : null} onRestart={() => setRun((value) => value + 1)} />;
}

function SaleConversation({ lead, catalog, services, today: fixedToday, backHref = "/dashboard", doneHref, onRestart, draft }: {
  lead: SaleChatLead; catalog: SaleCatalog; services: SaleChatServices; today?: Date; backHref?: string; doneHref?: string; onRestart: () => void; draft?: SaleSpokenDraft | null;
}) {
  const router = useRouter();
  const fire = useFeedback();
  const today = useMemo(() => fixedToday ?? new Date(), [fixedToday]);
  // O que veio do Sasá entra como resposta do corretor; a conversa só pergunta o que faltar.
  const spoken = useMemo(() => (draft ? mergeSpokenSale(draft, catalog, fixedToday ?? new Date()) : null), [catalog, draft, fixedToday]);
  const [answers, setAnswers] = useState<SaleAnswers>(() => spoken?.answers ?? {});
  const answersRef = useRef<SaleAnswers>(spoken?.answers ?? {});
  const files = useRef(new Map<string, File>());
  const round = useRef(0);
  const otherDate = useRef(false);
  const [awaitingDate, setAwaitingDate] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [contractPhase, setContractPhase] = useState<ContractPhase | null>(null);
  const [celebration, setCelebration] = useState<{ key: string; stats: SaleCelebrationStat[] } | null>(null);
  const context = useMemo(() => ({ today, leadValue: lead.monthlyValue, leadName: holderNameFromLead(lead.name) }), [today, lead.monthlyValue, lead.name]);
  const firstName = lead.name.split(" ")[0] ?? lead.name;

  // A prévia da foto vive só enquanto a tela está aberta.
  useEffect(() => () => { if (contractPhase?.preview) URL.revokeObjectURL(contractPhase.preview); }, [contractPhase?.preview]);

  const script = useMemo<ChatScript>(() => ({
    status: { label: "Esperando você", tone: "waiting" },
    blocks: spoken?.found.length
      ? [
        { type: "client", id: "c-lead", name: lead.name, initials: lead.initials, chips: [{ label: lead.stageLabel, tone: "info" }] },
        { type: "assistant", id: "a-intro", text: `Vamos registrar a venda de ${firstName}! Já anotei o que você me disse: ${spoken.found.join(", ")}.` },
        ...nextSaleBlocks(spoken.answers, catalog, { today, leadValue: lead.monthlyValue, leadName: holderNameFromLead(lead.name), turn: 0 }),
      ]
      : [
        { type: "client", id: "c-lead", name: lead.name, initials: lead.initials, chips: [{ label: lead.stageLabel, tone: "info" }] },
        { type: "assistant", id: "a-intro", text: `Vamos registrar a venda de ${firstName}! Manda o contrato ou a proposta, em foto ou PDF, que eu leio e preencho tudo: pessoas, plano, valor e vigência.` },
        { type: "custom", id: "upload-0", kind: "upload", data: null },
      ],
    // Montado uma vez, na entrada: as respostas seguintes chegam pela própria conversa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [firstName, lead.initials, lead.name, lead.stageLabel]);

  const commit = useCallback((next: SaleAnswers) => {
    // Plano individual com o titular confirmado: a idade dele já é a vida, sem perguntar de novo.
    const settled = withHolderAge(next, today);
    answersRef.current = settled;
    setAnswers(settled);
  }, [today]);

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
        ...saleCatalogSelection(catalog, current.carrierId, current.planId),
        approvedValue: current.monthlyValue,
        coverageStartDate: current.coverageStartDate,
        source: current.fromContract ? "contrato" : "conversa",
        people: salePeople(current, today),
        holderConfirmed: Boolean(current.holder?.name),
        holderCnpj: current.holder?.document?.kind === "cnpj" ? current.holder.document.digits : null,
        policyNumber: current.policyNumber ?? null,
        paymentMethod: current.paymentMethod ?? null,
        contractTermMonths: current.contractTermMonths ?? null,
        contract: current.contract ?? null,
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
    if (plan.celebrate) setCelebration({ key: `${lead.id}-${result.saleId}`, stats: saleCelebrationStats({ approvedValue: current.monthlyValue, contractTermMonths: current.contractTermMonths ?? 12 }) });
    const attached = current.contract ? " O contrato ficou anexado ao cliente." : "";
    return [
      { type: "custom", id: `done-${turn}`, kind: "done", data: { text: `${firstName} agora é cliente, ${PLAN_TYPE_LABEL[current.planType].toLowerCase()} de ${money(current.monthlyValue)} por mês.${attached}` } },
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
      setContractPhase((current) => current ? { ...current, phase: "failed" } : current);
      fire("warning");
      return [
        { type: "assistant", id: `a-read-error-${turn}`, text: result.error },
        { type: "custom", id: `upload-${turn}`, kind: "upload", data: null },
      ];
    }
    const merged = mergeContractReading({ ...answersRef.current, contract: result.file }, result.reading, catalog, today);
    commit(merged.answers);
    setContractPhase((current) => current ? { ...current, phase: "read" } : current);
    // Ler o contrato é nível 1 (FEEDBACK.md): confirmação discreta, sem som de festa.
    fire("confirm");
    const done = saleAwaiting(merged.answers, catalog) === "done";
    const foundCount = merged.rows.filter((row) => row.value).length;
    const text = !foundCount
      ? "Li o contrato, mas não achei os dados da venda nele. Vou te perguntar rapidinho."
      : done ? "Achei tudo o que precisava. Confere o resumo:" : "Falta pouco, só o que não estava escrito:";
    return [
      { type: "custom", id: `found-${turn}`, kind: "found", data: { rows: merged.rows, file: file.name } },
      { type: "assistant", id: `a-read-${turn}`, text },
      ...next(merged.answers),
    ];
  }, [catalog, commit, fire, lead.id, next, services, today]);

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
    const applied = applySaleChoice(current, value, catalog, holderNameFromLead(lead.name));
    if (!applied) return [];
    commit(applied);
    return next(applied);
  }, [catalog, commit, lead.name, next, onRestart, readContract, register, registered]);

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

  const pickFile = useCallback((file: File, api: CustomBlockApi, blockId: string): string | null => {
    if (!ACCEPTED.has(file.type)) return "Mande uma foto (JPG ou PNG) ou um PDF do contrato.";
    if (file.size > MAX_BYTES) return "O arquivo passou de 10 MB. Mande uma foto ou um PDF menor.";
    const token = `${blockId}-${Date.now()}`;
    files.current.set(token, file);
    setContractPhase({ blockId, name: file.name, preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : null, phase: "reading" });
    fire("tap");
    api.local(`Enviei ${file.name}`, `contract:${token}`);
    return null;
  }, [fire]);

  const renderCustom = useCallback((block: Extract<ChatBlock, { type: "custom" }>, api: CustomBlockApi) => {
    if (block.kind === "upload") {
      return <ContractUpload blockId={block.id} onFile={(file) => pickFile(file, api, block.id)} onAsk={() => api.local("Prefiro responder as perguntas", "ask:1")} />;
    }
    if (block.kind === "found") {
      const data = block.data as { rows: ExtractedRow[]; file: string };
      return <FoundCard rows={data.rows} />;
    }
    if (block.kind === "review") return <ReviewCard data={block.data as SaleReviewData} />;
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
  }, [pickFile]);
  const phaseContext = useMemo(() => ({ phase: contractPhase, registered }), [contractPhase, registered]);

  const waiting = saleAwaiting(answers, catalog);
  const flowDone = waiting === "done" || registered;
  const placeholder = awaitingDate ? "Ex.: 10/12/2026"
    : waiting === "holderName" ? "Nome completo do titular"
    : waiting === "holderDoc" ? "CPF ou CNPJ"
    : waiting === "holderBirth" ? "Ex.: 15/03/1985"
    : waiting === "ages" ? (answers.planType === "individual" ? "Ex.: 35" : "Ex.: 35, 32, 8")
      : waiting === "value" ? "Ex.: 1.250,90"
        : flowDone ? "Escolha uma opção acima" : undefined;
  const composerInput = awaitingDate ? { label: "Data do início da vigência" }
    : waiting === "holderName" ? { label: "Nome completo do titular" }
    : waiting === "holderDoc" ? { inputMode: "numeric" as const, label: "CPF ou CNPJ do titular" }
    : waiting === "holderBirth" ? { label: "Data de nascimento do titular" }
    : waiting === "ages" ? { inputMode: "numeric" as const, label: "Idades, o titular primeiro, separadas por vírgula" }
      : waiting === "value" ? { inputMode: "numeric" as const, label: "Valor mensal da venda" } : undefined;
  const started = Object.keys(answers).length > 0;

  return (
    <div className={`arc-venancor ${styles.root}`}>
      <ContractPhaseContext.Provider value={phaseContext}>
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
      </ContractPhaseContext.Provider>
      {celebration ? (
        <SaleCelebration open celebrationKey={celebration.key} stats={celebration.stats} feedback={false} onClose={() => { setCelebration(null); router.refresh(); }} />
      ) : null}
    </div>
  );
}

/** Movimento ligado: preferência do sistema, "Animações" do usuário e o kill-switch. */
function useMotionOn() {
  const reduce = useReducedMotion();
  const enabled = useInterfaceMotionEnabled();
  return enabled && !reduce;
}

const enter = { duration: motionTokens.duration.standard, ease: motionTokens.ease.enter };

/** Toque ou arraste o contrato. Depois do envio, o cartão vira a prévia do arquivo com a faixa de leitura. */
function ContractUpload({ blockId, onFile, onAsk }: { blockId: string; onFile: (file: File) => string | null; onAsk: () => void }) {
  const { phase: current, registered: disabled } = useContext(ContractPhaseContext);
  const phase = current?.blockId === blockId ? current : null;
  const [asked, setAsked] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const motionOn = useMotionOn();
  // Cada cartão de envio mostra só o arquivo que saiu dele (um novo cartão aparece se a leitura falhar).
  const shown = phase;

  const take = (file: File | undefined) => {
    if (!file || disabled || shown || asked) return;
    const problem = onFile(file);
    setError(problem);
  };

  return (
    <section
      className={styles.upload}
      aria-label="Enviar o contrato"
      data-dragging={dragging || undefined}
      onDragOver={(event) => { if (shown || disabled) return; event.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => { event.preventDefault(); setDragging(false); take(event.dataTransfer.files?.[0]); }}
    >
      <AnimatePresence mode="wait" initial={false}>
        {shown ? (
          <motion.div key="sheet" className={styles.sheet} initial={motionOn ? { opacity: 0, y: motionTokens.distance.md, filter: `blur(${motionTokens.blur.soft}px)` } : false} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={enter}>
            <span className={styles.thumb}>
              {shown.preview ? <img src={shown.preview} alt="" /> : <FileText size={22} aria-hidden />}
              {shown.phase === "reading" && motionOn ? (
                <motion.span className={styles.beam} aria-hidden initial={{ top: -18 }} animate={{ top: 68 }} transition={{ duration: 1.1, ease: motionTokens.ease.inOut, repeat: Infinity, repeatType: "reverse" }} />
              ) : null}
            </span>
            <span className={styles.sheetBody}>
              <span className={styles.sheetName}>{shown.name}</span>
              <span className={styles.sheetState} data-phase={shown.phase} role="status" aria-live="polite">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span key={shown.phase} initial={motionOn ? { opacity: 0, y: 4 } : false} animate={{ opacity: 1, y: 0 }} exit={motionOn ? { opacity: 0, y: -4 } : { opacity: 0 }} transition={{ duration: motionTokens.duration.fast, ease: motionTokens.ease.enter, delay: motionTokens.beat.text }} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    {shown.phase === "reading" ? <>Lendo o contrato <ReadingDots on={motionOn} /></>
                      : shown.phase === "read" ? <LiteSuccess label="Contrato lido" />
                        : "Não deu para ler este arquivo"}
                  </motion.span>
                </AnimatePresence>
              </span>
            </span>
          </motion.div>
        ) : (
          <motion.div key="pick" style={{ display: "grid", gap: 12 }} exit={motionOn ? { opacity: 0, y: -motionTokens.distance.sm } : { opacity: 0 }} transition={{ duration: motionTokens.duration.exit, ease: motionTokens.ease.exit }}>
            <div className={styles.uploadTop}>
              <span className={styles.uploadIcon} aria-hidden><Paperclip size={20} /></span>
              <div>
                <p className={styles.uploadTitle}>Contrato ou proposta</p>
                <p className={styles.uploadText}>{error ?? "Foto ou PDF de até 10 MB. Ele fica anexado ao cliente."}</p>
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
                take(file);
              }}
            />
            <Button variant="secondary" className={styles.uploadButton} disabled={disabled || asked} onClick={() => input.current?.click()}>
              Enviar foto ou PDF
            </Button>
            {asked ? null : (
              <button type="button" className={styles.askLink} disabled={disabled} onClick={() => { setAsked(true); onAsk(); }}>
                Sem o contrato? Responder as perguntas
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function ReadingDots({ on }: { on: boolean }) {
  return (
    <span className={styles.dots} aria-hidden>
      {[0, 1, 2].map((index) => (
        <motion.span key={index} animate={on ? { opacity: [0.25, 1, 0.25] } : { opacity: 0.6 }} transition={on ? { duration: 1, repeat: Infinity, delay: index * 0.16, ease: "easeInOut" } : undefined} />
      ))}
    </span>
  );
}

function Check({ on, delay }: { on: boolean; delay: number }) {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden>
      <motion.path d="M3.5 8.5 6.5 11.5 12.5 4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        initial={on ? { pathLength: 0 } : false} animate={{ pathLength: 1 }} transition={{ duration: motionTokens.duration.draw, ease: motionTokens.ease.enter, delay }} />
    </svg>
  );
}

/** O que a IA achou no contrato: cada campo chega em sequência, com o check se desenhando. */
function FoundCard({ rows }: { rows: ExtractedRow[] }) {
  const motionOn = useMotionOn();
  const found = rows.filter((row) => row.value).length;
  const step = (index: number) => Math.min(index, motionTokens.stagger.max - 1) * 0.06;
  return (
    <section className={styles.found} aria-label="O que achei no contrato">
      <div className={styles.foundHead}>
        <p className={styles.foundTitle}>Achei no contrato</p>
        <span className={styles.foundCount}>{found} de {rows.length}</span>
      </div>
      {rows.map((row, index) => (
        <motion.div key={row.key} className={styles.foundRow}
          initial={motionOn ? { opacity: 0, y: motionTokens.distance.sm, filter: `blur(${motionTokens.blur.subtle}px)` } : false}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ ...enter, delay: step(index) }}>
          <span className={styles.mark} data-found={Boolean(row.value)}>
            {row.value ? <Check on={motionOn} delay={step(index) + 0.12} /> : <svg viewBox="0 0 16 16" width="10" height="10" aria-hidden><path d="M4 8h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>}
          </span>
          <span>
            <p className={styles.foundLabel}>{row.label}</p>
            <p className={styles.foundValue} data-missing={!row.value || undefined}>{row.value ?? "Não estava no contrato"}</p>
          </span>
        </motion.div>
      ))}
    </section>
  );
}

/** O resumo para confirmar: pessoas, plano e contrato, com a marca do que veio do contrato. */
function ReviewCard({ data }: { data: SaleReviewData }) {
  const motionOn = useMotionOn();
  let index = 0;
  return (
    <motion.section className={styles.review} aria-label="Confira a venda"
      initial={motionOn ? { opacity: 0, y: motionTokens.distance.md, scale: motionTokens.scale.popIn } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }} transition={motionTokens.spring.smooth}>
      <div className={styles.reviewHead}>
        <p className={styles.reviewTitle}>Confira a venda</p>
        <p className={styles.reviewSub}>{data.fromContract ? "Tudo veio do contrato, menos o que está marcado. Corrija o que não bater." : "Se algo não bater, toque em Corrigir algo."}</p>
      </div>
      {data.sections.map((section) => (
        <div key={section.title} className={styles.section}>
          <p className={styles.sectionTitle}>{section.title}</p>
          {section.rows.map((row) => {
            const delay = Math.min(index++, motionTokens.stagger.max - 1) * motionTokens.stagger.item;
            return (
              <motion.div key={`${section.title}-${row.label}-${row.value}`} className={styles.row}
                initial={motionOn ? { opacity: 0, y: motionTokens.distance.xs } : false} animate={{ opacity: 1, y: 0 }}
                transition={{ ...enter, delay: 0.08 + delay }}>
                <span className={styles.rowLabel}>{row.label}</span>
                <span className={styles.rowValue}>{row.value}{data.fromContract && !row.sourced && row.value !== "A informar" ? <span className={styles.tag}>Você informou</span> : null}</span>
              </motion.div>
            );
          })}
        </div>
      ))}
      {data.contractName ? (
        <div className={styles.attach}><Paperclip size={14} aria-hidden /> {data.contractName} fica anexado ao cliente</div>
      ) : null}
    </motion.section>
  );
}

/** O nome do lead serve de sugestão de titular, menos quando é o nome provisório ("Lead sem nome"). */
function holderNameFromLead(name: string) {
  const trimmed = name.trim();
  return trimmed.length >= 3 && !/^lead sem nome|^sem nome/i.test(trimmed) ? trimmed : undefined;
}

/**
 * As pessoas do registro: o titular confirmado na conversa vem primeiro (nome, nascimento e CPF); os dependentes,
 * pelo contrato quando ele bate com as idades, ou só com a idade.
 */
function salePeople(answers: SaleAnswers, today: Date): SalePerson[] | undefined {
  const ages = answers.ages ?? [];
  if (!ages.length) return undefined;
  const fromContract = answers.people?.length === ages.length ? answers.people : null;
  const holder = holderPerson(answers, today);
  if (!holder) return fromContract ?? undefined;
  const dependents = ages.slice(1).map((age, index) => fromContract?.[index + 1] ?? { name: null, age, birthDate: null, cpf: null, relationship: "outro" as const });
  return [{ ...holder, age: ages[0] ?? holder.age }, ...dependents];
}
