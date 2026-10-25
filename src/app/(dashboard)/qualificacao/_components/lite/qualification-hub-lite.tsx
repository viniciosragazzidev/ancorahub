"use client";

/**
 * Hub de qualificação IA no visual Lite, quebrado por aba (cada aba é um arquivo). Mesmos dados, as mesmas Server
 * Actions, mensagens e o mesmo ?tab= (com os redirecionamentos de abas antigas) da tela atual. O salvar do topo grava
 * os campos da aba "Prompt e comportamento", como hoje.
 */
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { DashboardHeader } from "@/components/dashboard-header";
import page from "@/components/lite/page/lite-page.module.css";
import { toast } from "@/components/ui/sonner";
import {
  acknowledgeAlertAction,
  deleteFollowUpRuleAction,
  saveFollowUpRuleAction,
  toggleQualificationEnabledAction,
  updateQualificationSettingsAction,
  updateToolPermissionAction,
} from "@/features/ai-qualification/actions";
import { BulkQualificationDialog } from "@/features/ai-qualification/components/bulk-qualification-dialog";

import type { QualificationHubProps } from "../qualification-hub-types";
import { parseInputForFields, type SimMemory } from "../simulator-memory";
import { DiagnosticTabLite } from "./diagnostic-tab-lite";
import { FollowUpTabLite, type FollowUpDraft } from "./followup-tab-lite";
import { OverviewTabLite, type OverviewFields } from "./overview-tab-lite";
import { PermissionsTabLite } from "./permissions-tab-lite";
import { SimulatorTabLite } from "./simulator-tab-lite";
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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [fields, setFields] = useState<OverviewFields>(() => fieldsFrom(settings));
  const [handoffMessage, setHandoffMessage] = useState(settings?.handoffMessage ?? DEFAULT_HANDOFF);
  const [isSaving, setIsSaving] = useState(false);
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
  const [selectedTab, setSelectedTab] = useState<string | null>(null);

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
  const resolved = TAB_REDIRECTS[requested ?? ""] ?? requested;
  const activeTab = selectedTab ?? (tabs.some((tab) => tab.id === resolved) ? resolved! : "overview");

  const selectTab = (id: string) => {
    setSelectedTab(id);
    try {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", id);
      window.history.replaceState(null, "", `${pathname}?${params.toString()}`);
    } catch {
      // Sem histórico (testes): a aba troca do mesmo jeito.
    }
  };

  const toggleEnabled = async (next: boolean) => {
    setFields((current) => ({ ...current, enabled: next }));
    try {
      await toggleQualificationEnabledAction(next);
      toast.success(next ? "Operação da IA ativada com sucesso!" : "Operação da IA pausada com sucesso!");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao alterar status da IA.");
      setFields((current) => ({ ...current, enabled: !next }));
    }
  };

  const save = async () => {
    setIsSaving(true);
    try {
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
      toast.success("Configurações e Operação da IA salvas com sucesso!");
      router.refresh();
    } catch {
      toast.error("Erro ao salvar configurações da qualificação.");
    } finally {
      setIsSaving(false);
    }
  };

  const saveRule = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft.name.trim()) {
      toast.error("Informe o nome da regra de follow-up.");
      return;
    }
    try {
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
      toast.success("Regra preparada. O envio automático permanece desativado.");
    } catch {
      toast.error("Erro ao salvar regra de follow-up.");
    }
  };

  const deleteRule = async (id: string) => {
    try {
      setRules(await deleteFollowUpRuleAction(id));
      toast.success("Regra removida.");
    } catch {
      toast.error("Erro ao remover regra.");
    }
  };

  const toggleTool = async (tool: QualificationHubProps["toolPermissions"][number]) => {
    if (tool.isCritical) {
      toast.error("Ações críticas são permanentemente bloqueadas para a IA.");
      return;
    }
    const next = tool.permission === "allowed" ? "blocked" : "allowed";
    try {
      setTools(await updateToolPermissionAction({ toolName: tool.toolName, permission: next as Parameters<typeof updateToolPermissionAction>[0]["permission"], maxCallsPerSession: 10, requiresHumanConfirmation: false }));
      toast.success(`Permissão para '${tool.toolName}' alterada para '${next}'.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao alterar permissão.");
    }
  };

  const acknowledge = async (id: string) => {
    try {
      setAlerts(await acknowledgeAlertAction(id));
      toast.success("Alerta reconhecido e resolvido.");
    } catch {
      toast.error("Erro ao resolver alerta.");
    }
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
      toast.error("Simulador: Erro ao conectar com a IA.");
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
          <Link href="/qualificacao/turbo" className={page.button}>Qualificação turbo</Link>
          <BulkQualificationDialog trigger={<button type="button" className={page.button}>Qualificar em massa</button>} />
          <button type="button" className={`${page.primaryButton} ${page.toolbarEnd}`} onClick={save} disabled={isSaving}>{isSaving ? "Salvando..." : "Salvar alterações"}</button>
        </div>
        <div role="tablist" aria-label="Áreas da qualificação" className={styles.tabs}>
          {tabs.map((tab) => (
            <button key={tab.id} type="button" role="tab" id={`qualification-tab-${tab.id}`} aria-selected={tab.id === activeTab} aria-controls="qualification-panel" className={styles.tab} onClick={() => selectTab(tab.id)}>
              {tab.label}
            </button>
          ))}
        </div>
        <div role="tabpanel" id="qualification-panel" aria-labelledby={`qualification-tab-${activeTab}`} className={page.stack}>
          {activeTab === "overview" ? <OverviewTabLite stats={stats} fields={fields} onChange={(patch) => setFields((current) => ({ ...current, ...patch }))} onToggleEnabled={toggleEnabled} /> : null}
          {activeTab === "whatsapp_diag" ? <DiagnosticTabLite diagnostic={whatsappDiagnostic} /> : null}
          {activeTab === "agent_triggers" ? <PermissionsTabLite tools={tools} onToggle={toggleTool} /> : null}
          {activeTab === "followup_rules" ? <FollowUpTabLite rules={rules} draft={draft} onDraft={(patch) => setDraft((current) => ({ ...current, ...patch }))} onSubmit={saveRule} onDelete={deleteRule} /> : null}
          {activeTab === "simulator" ? <SimulatorTabLite alerts={alerts} onAcknowledge={acknowledge} messages={simMessages} input={simInput} onInput={setSimInput} onSend={sendSim} loading={simLoading} memory={simMemory} /> : null}
        </div>
      </main>
    </>
  );
}
