"use client";

/**
 * Hub de qualificação IA no visual Lite, quebrado por aba (cada aba é um arquivo). Mesmos dados, as mesmas Server
 * Actions, mensagens e o mesmo ?tab= (com os redirecionamentos de abas antigas) da tela atual. O salvar do topo grava
 * os campos da aba "Prompt e comportamento", como hoje.
 *
 * Feedback (FEEDBACK.md, nível 1): salvar e configurar mostram o envio no botão, confirmam na própria seção depois
 * do servidor e, se falham, mostram a causa e "Tentar de novo". Toast nenhum repete o que já aparece na tela.
 */
import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { DashboardHeader } from "@/components/dashboard-header";
import page from "@/components/lite/page/lite-page.module.css";
import { LiteActionButton } from "@/components/lite/controls";
import {
  acknowledgeAlertAction,
  deleteFollowUpRuleAction,
  saveFollowUpRuleAction,
  toggleQualificationEnabledAction,
  updateQualificationSettingsAction,
  updateToolPermissionAction,
} from "@/features/ai-qualification/actions";
import { useFeedback } from "@/lib/feedback/use-feedback";
import { BulkQualificationDialog } from "@/features/ai-qualification/components/bulk-qualification-dialog";

import type { QualificationHubProps } from "../qualification-hub-types";
import { parseInputForFields, type SimMemory } from "../simulator-memory";
import { DiagnosticTabLite } from "./diagnostic-tab-lite";
import { FollowUpTabLite, type FollowUpDraft } from "./followup-tab-lite";
import { OverviewTabLite, type OverviewFields } from "./overview-tab-lite";
import { PermissionsTabLite } from "./permissions-tab-lite";
import { SimulatorTabLite } from "./simulator-tab-lite";
import { useActionStatus } from "./action-status-lite";
import styles from "./qualification-lite.module.css";

const TAB_REDIRECTS: Record<string, string> = { mcp_governance: "agent_triggers", destinations: "overview", brokers: "overview", system_messages: "overview", alerts: "simulator", training: "overview" };
const DEFAULT_INITIAL = "Olá! Sou o assistente virtual do AncoraHub. Vou fazer algumas perguntas rápidas para preparar seu atendimento.";
const DEFAULT_HANDOFF = "Vou encaminhar você para um corretor da equipe agora.";

function fieldsFrom(settings: QualificationHubProps["settings"]): OverviewFields {
  return {
    enabled: settings?.enabled ?? false,
    pauseMode: settings?.pauseMode || "handoff_active",
    assistantName: settings?.assistantName || "Assistente AncoraHub",
    timeoutMinutes: settings?.timeoutMinutes ?? 20,
    initialMessage: settings?.initialMessage || DEFAULT_INITIAL,
    businessContext: settings?.businessContext || "",
    customInstructions: settings?.customInstructions || "",
  };
}

export function QualificationHubLite({ settings, whatsappDiagnostic, followUpRules: initialRules, toolPermissions: initialTools, stats, alerts: initialAlerts }: QualificationHubProps) {
  const router = useRouter();
  const fire = useFeedback();
  const searchParams = useSearchParams();
  const [fields, setFields] = useState<OverviewFields>(() => fieldsFrom(settings));
  const [handoffMessage, setHandoffMessage] = useState(settings?.handoffMessage ?? DEFAULT_HANDOFF);
  // Cada edição devolve o "Salvar alterações" ao repouso (o botão confirmado fica travado até mudar algo).
  const [saveRevision, setSaveRevision] = useState(0);
  const { status, run, invalid, clear } = useActionStatus();
  const [rules, setRules] = useState(initialRules);
  const [tools, setTools] = useState(initialTools);
  const [alerts, setAlerts] = useState(initialAlerts);
  const [draft, setDraft] = useState<FollowUpDraft>({ name: "", trigger: "qualification_abandoned", delay: 120, messageMode: "fixed", messageText: "Olá! Ainda posso te ajudar com a cotação do seu plano?" });
  const [simMemory, setSimMemory] = useState<SimMemory>({});
  const [simConversation, setSimConversation] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [simMessages, setSimMessages] = useState<Array<{ sender: "user" | "bot"; text: string }>>(() => [
    { sender: "bot", text: `Olá! Tudo bem? Sou a ${settings?.assistantName || "Ana"} da Âncora Corretora. Que ótimo falar com você! Para te passar as melhores opções de planos, como posso te chamar?` },
  ]);
  const [simInput, setSimInput] = useState("");
  const [simLoading, setSimLoading] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setFields((current) => ({ ...fieldsFrom(settings), timeoutMinutes: settings.timeoutMinutes || 30, initialMessage: settings.initialMessage || current.initialMessage }));
    if (settings.handoffMessage) setHandoffMessage(settings.handoffMessage);
  }, [settings]);

  const activeAlerts = alerts.filter((alert) => alert.status === "active").length;
  const tabs = [
    { id: "overview", label: "Prompt e comportamento" },
    { id: "agent_triggers", label: "Permissões" },
    { id: "followup_rules", label: "Follow-up" },
    { id: "whatsapp_diag", label: "Conectividade" },
    { id: "simulator", label: `Simulador${activeAlerts > 0 ? ` (${activeAlerts})` : ""}` },
  ];
  const requested = searchParams.get("tab");
  // A aba vem da URL: a barra da área Atendimento IA troca a query.
  const resolved = TAB_REDIRECTS[requested ?? ""] ?? requested;
  const activeTab = (tabs.some((tab) => tab.id === resolved) ? resolved! : "overview");

  const toggleEnabled = async (next: boolean) => {
    setFields((current) => ({ ...current, enabled: next }));
    // O que acontece depois do servidor fica dentro da tarefa: o "Tentar de novo" refaz tudo.
    const done = await run("enabled", async () => {
      await toggleQualificationEnabledAction(next);
      setFields((current) => ({ ...current, enabled: next }));
      router.refresh();
      return true;
    }, {
      done: next ? "IA ativada" : "IA pausada",
      fallback: "Não deu para mudar a operação da IA agora.",
      keeps: next ? "A IA continua pausada." : "A IA continua operando.",
    });
    if (!done) setFields((current) => ({ ...current, enabled: !next }));
  };

  const save = async () => {
    await updateQualificationSettingsAction({
      enabled: fields.enabled,
      pauseMode: fields.pauseMode as "finish_active" | "handoff_active" | "pause_immediately",
      assistantName: fields.assistantName.trim() || "Assistente AncoraHub",
      initialMessage: fields.initialMessage.trim() || DEFAULT_INITIAL,
      handoffMessage: handoffMessage.trim() || DEFAULT_HANDOFF,
      outOfHoursMessage: settings?.outOfHoursMessage || "Recebemos sua mensagem. Nossa equipe responderá no próximo horário de atendimento.",
      absenceMessage: settings?.absenceMessage || "No momento não há um corretor disponível. Deixaremos seu atendimento na fila.",
      tone: settings?.tone ?? "friendly",
      useEmojis: settings?.useEmojis ?? false,
      timeoutMinutes: Number(fields.timeoutMinutes) || 30,
      businessContext: fields.businessContext,
      customInstructions: fields.customInstructions,
      quickReplyCooldownMinutes: settings?.quickReplyCooldownMinutes ?? 10,
      quickReplyWaitWindowMinutes: settings?.quickReplyWaitWindowMinutes ?? 30,
      quickReplyWaitLimitCount: settings?.quickReplyWaitLimitCount ?? 2,
    });
    router.refresh();
  };

  const saveRule = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft.name.trim()) {
      invalid("rule", "Informe o nome da regra de follow-up.");
      return;
    }
    await run("rule", async () => {
      const updated = await saveFollowUpRuleAction({
      name: draft.name,
      enabled: false,
      trigger: draft.trigger as Parameters<typeof saveFollowUpRuleAction>[0]["trigger"],
      delayMinutes: Number(draft.delay),
      maxAttempts: 3,
      minimumIntervalMinutes: 60,
      allowedDays: [1, 2, 3, 4, 5],
      allowedStartTime: "08:00",
      allowedEndTime: "18:00",
      timezone: "America/Sao_Paulo",
      messageMode: draft.messageMode,
      fixedMessage: draft.messageText,
      stopConditions: ["client_responded", "human_taken", "lead_closed", "sale_completed", "opt_out"],
      });
      setRules(updated);
      setDraft((current) => ({ ...current, name: "" }));
      return updated;
    }, { done: "Regra preparada. O envio automático segue desligado.", fallback: "Não deu para salvar a regra agora.", keeps: "O formulário continua preenchido." });
  };

  const deleteRule = async (id: string) => {
    await run("rules", async () => {
      const updated = await deleteFollowUpRuleAction(id);
      setRules(updated);
      return updated;
    }, { done: "Regra removida", fallback: "Não deu para remover a regra agora.", keeps: "A regra continua cadastrada." });
  };

  const toggleTool = async (tool: QualificationHubProps["toolPermissions"][number]) => {
    if (tool.isCritical) {
      invalid("tools", "Ações críticas são permanentemente bloqueadas para a IA.");
      return;
    }
    const next = tool.permission === "allowed" ? "blocked" : "allowed";
    await run("tools", async () => {
      const updated = await updateToolPermissionAction({ toolName: tool.toolName, permission: next as Parameters<typeof updateToolPermissionAction>[0]["permission"], maxCallsPerSession: 10, requiresHumanConfirmation: false });
      setTools(updated);
      return updated;
    }, {
      done: `${tool.displayName}: ${next === "allowed" ? "permitida" : "bloqueada"}`,
      fallback: "Não deu para mudar a permissão agora.",
      keeps: `${tool.displayName} continua ${tool.permission === "allowed" ? "permitida" : "bloqueada"}.`,
    });
  };

  const acknowledge = async (id: string) => {
    await run("alerts", async () => {
      const updated = await acknowledgeAlertAction(id);
      setAlerts(updated);
      return updated;
    }, { done: "Alerta resolvido", fallback: "Não deu para resolver o alerta agora.", keeps: "O alerta continua ativo." });
  };

  const sendSim = async (event: FormEvent) => {
    event.preventDefault();
    if (!simInput.trim() || simLoading) return;
    const userText = simInput.trim();
    const conversation = [...simConversation, { role: "user" as const, content: userText }];
    setSimConversation(conversation);
    setSimMessages((current) => [...current, { sender: "user", text: userText }]);
    setSimInput("");
    setSimLoading(true);
    const memory: SimMemory = { ...simMemory, ...parseInputForFields(userText, simMemory) };
    setSimMemory(memory);
    try {
      const response = await fetch("/api/qualificacao/simulador", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: conversation, memory: Object.fromEntries(Object.entries(memory).filter(([, value]) => Boolean(value))) }),
      });
      const data = (await response.json()) as { reply: string };
      const reply = data.reply ?? "Desculpe, não consegui gerar uma resposta.";
      setSimConversation((current) => [...current, { role: "assistant", content: reply }]);
      setSimMessages((current) => [...current, { sender: "bot", text: reply }]);
    } catch {
      // A falha já aparece como resposta do robô na conversa; só o som e a vibração de erro.
      fire("error");
      setSimMessages((current) => [...current, { sender: "bot", text: "Ops! Não consegui conectar com a IA agora. Tente novamente." }]);
    } finally {
      setSimLoading(false);
    }
  };

  return (
    <>
      <DashboardHeader breadcrumb="Qualificação IA" title="Qualificação IA" />
      <main className={page.stack}>
        <div className={styles.actions}>
          <span className={page.badge} data-tone={fields.enabled ? "success" : undefined}>{fields.enabled ? "IA operando" : "IA pausada"}</span>
          <BulkQualificationDialog trigger={<button type="button" className={page.button}>Qualificar em massa</button>} />
          <LiteActionButton key={saveRevision} className={page.toolbarEnd} busyLabel="Salvando…" doneLabel="Alterações salvas" keeps="O que você escreveu continua aqui." errorFallback="As alterações não foram salvas." onAction={save}>Salvar alterações</LiteActionButton>
        </div>
        <div id="qualification-panel" className={page.stack}>
          {activeTab === "overview" ? <OverviewTabLite stats={stats} fields={fields} onChange={(patch) => { setFields((current) => ({ ...current, ...patch })); setSaveRevision((value) => value + 1); }} onToggleEnabled={toggleEnabled} enabledStatus={status.enabled} /> : null}
          {activeTab === "whatsapp_diag" ? <DiagnosticTabLite diagnostic={whatsappDiagnostic} /> : null}
          {activeTab === "agent_triggers" ? <PermissionsTabLite tools={tools} onToggle={toggleTool} status={status} /> : null}
          {activeTab === "followup_rules" ? <FollowUpTabLite rules={rules} draft={draft} onDraft={(patch) => { setDraft((current) => ({ ...current, ...patch })); if (status.rule?.state !== "busy") clear("rule"); }} onSubmit={saveRule} onDelete={deleteRule} ruleStatus={status.rule} rulesStatus={status.rules} /> : null}
          {activeTab === "simulator" ? <SimulatorTabLite alerts={alerts} onAcknowledge={acknowledge} alertsStatus={status.alerts} messages={simMessages} input={simInput} onInput={setSimInput} onSend={sendSim} loading={simLoading} memory={simMemory} /> : null}
        </div>
      </main>
    </>
  );
}
