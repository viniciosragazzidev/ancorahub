"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Sparkles,
  Power,
  Phone,
  RotateCcw,
  SlidersHorizontal,
  Plus,
  Trash2,
  MessageSquare,
  Bot,
  Send,
  ShieldCheck,
  Layers,
  RefreshCw,
  Activity,
  AlertTriangle,
  UserCheck,
  ArrowRightLeft,
  DollarSign,
  Clock,
  ShieldAlert,
  HelpCircle,
  FileText,
  Lock,
  Zap,
} from "lucide-react";

import { DashboardHeader } from "@/components/dashboard-header";
import { BulkQualificationDialog } from "@/features/ai-qualification/components/bulk-qualification-dialog";
import { WhatsAppTestMessageCard } from "@/features/communication-channels/components/whatsapp-test-message-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AgentTrainingTab } from "@/app/(dashboard)/settings/_components/agent-training-tab";
import { AgentTriggersPanel } from "./agent-triggers-panel";
import { MetaTemplatesPanel } from "./meta-templates-panel";

import {
  updateQualificationSettingsAction,
  addTestNumberAction,
  removeTestNumberAction,
  resetMemoryAction,
  saveFollowUpRuleAction,
  deleteFollowUpRuleAction,
  updateToolPermissionAction,
  saveDestinationRuleAction,
  saveBrokerEligibilityProfileAction,
  acknowledgeAlertAction,
} from "@/features/ai-qualification/actions";
import type { WhatsAppConnectionDiagnostic } from "@/features/ai-qualification/whatsapp-diagnostic-service";
import type { QualificationStatsSummary } from "@/features/ai-qualification/stats-service";
import type { QualificationAlertRecord } from "@/features/ai-qualification/alerts-service";

type QualificationHubProps = {
  settings: {
    enabled: boolean;
    pauseMode: string;
    assistantName: string;
    initialMessage: string;
    finalMessage?: string | null;
    handoffMessage: string;
    outOfHoursMessage: string;
    absenceMessage: string;
    tone: string;
    useEmojis: boolean;
    timeoutMinutes: number;
    businessContext?: string | null;
    customInstructions?: string | null;
    version: number;
    updatedAt: string | Date | null;
    quickReplyCooldownMinutes?: number | null;
    quickReplyWaitWindowMinutes?: number | null;
    quickReplyWaitLimitCount?: number | null;
  } | null;
  testNumbers: Array<{
    id: string;
    phoneNumber: string;
    label: string;
    active: boolean;
    autoResetMode: string;
  }>;
  whatsappDiagnostic: WhatsAppConnectionDiagnostic;
  followUpRules: Array<{
    id: string;
    name: string;
    enabled: boolean;
    trigger: string;
    delayMinutes: number;
    maxAttempts: number;
    minimumIntervalMinutes: number;
    allowedDays: any;
    allowedStartTime: string;
    allowedEndTime: string;
    timezone: string;
    messageMode: string;
    fixedMessage: string | null;
    templateId: string | null;
    stopConditions: any;
    destinationStatus: string | null;
  }>;
  toolPermissions: Array<{
    toolName: string;
    displayName: string;
    category: string;
    description: string;
    permission: string;
    maxCallsPerSession: number;
    requiresHumanConfirmation: boolean;
    isCritical: boolean;
  }>;
  destinationRules: Array<{
    id: string;
    temperatureClass: string;
    destinationType: string;
    destinationTargetId: string | null;
    priority: string;
    slaMinutes: number;
    fallbackDestinationType: string;
    sortOrder: number;
  }>;
  brokerProfiles: Array<{
    id: string;
    userId: string;
    userName: string;
    userEmail: string;
    allowedLeadTypes: any;
    specialties: any;
    maxSimultaneousCapacity: number;
    dailyLimit: number;
    participatesInDuty: boolean;
    receivesOffHours: boolean;
    active: boolean;
    paused: boolean;
  }>;
  stats: QualificationStatsSummary;
  alerts: QualificationAlertRecord[];
  agentTraining: {
    enabled: boolean;
    canEdit: boolean;
    versions: Array<{ id: string; versionNumber: number; status: string; summary: string | null; validation: unknown; publishedAt: Date | null }>;
    brokers: Array<{ id: string; name: string }>;
    distributionPolicy: unknown;
  };
};

type SimMemory = {
  nome?: string;
  plano?: string;
  vidas?: string;
  idade?: string;
  cidade?: string;
  email?: string;
};

const GREETING_WORDS = new Set([
  "ola", "olá", "oi", "oie", "opa", "salve", "bom dia", "boa tarde", "boa noite",
  "tudo bem", "tudo bom", "como vai", "hei", "hey", "alo", "alô"
]);

function isPureGreeting(text: string): boolean {
  const normalized = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/gi, "");

  return GREETING_WORDS.has(normalized) || normalized.split(" ").every((w) => GREETING_WORDS.has(w));
}

function parseInputForFields(text: string, currentMemory: SimMemory): Partial<SimMemory> {
  const extracted: Partial<SimMemory> = {};
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  if (/(?:meu nome e|meu nome é|me chamo|sou o|sou a|eu sou|me chamo de)\s+([A-ZÀ-Úa-zà-ú\s]+)/i.test(trimmed)) {
    const nameMatch = trimmed.match(/(?:meu nome e|meu nome é|me chamo|sou o|sou a|eu sou|me chamo de)\s+([A-ZÀ-Úa-zà-ú\s]+)/i);
    if (nameMatch?.[1]) extracted.nome = nameMatch[1].trim();
  }

  const emailMatch = trimmed.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (emailMatch?.[1]) extracted.email = emailMatch[1].trim();

  if (/\b(individual|pf|para mim|so para mim|só para mim|minha pessoa)\b/i.test(lower)) {
    extracted.plano = "Individual";
    if (!currentMemory.vidas) extracted.vidas = "1 pessoa";
  } else if (/\b(familiar|familia|família|para minha familia|para minha família)\b/i.test(lower)) {
    extracted.plano = "Familiar";
  } else if (/\b(pme|pj|empresarial|empresa|para minha empresa|coletivo|cnpj)\b/i.test(lower)) {
    extracted.plano = "Empresarial (PME)";
  }

  const livesMatch = trimmed.match(/(\d+)\s*(?:pessoas|vidas|dependentes|integrantes)?/i);
  if (livesMatch?.[1] && Number(livesMatch[1]) > 0 && Number(livesMatch[1]) < 500 && !extracted.idade) {
    if (lower.includes("pessoa") || lower.includes("vida") || lower.includes("integrante") || !currentMemory.vidas) {
      extracted.vidas = `${livesMatch[1]} ${Number(livesMatch[1]) === 1 ? "pessoa" : "pessoas"}`;
    }
  }

  const ageMatch = trimmed.match(/(\d+)\s*(?:anos|ano)/i);
  if (ageMatch?.[1]) extracted.idade = `${ageMatch[1]} anos`;

  const cityMatch = trimmed.match(/(?:moro em|sou de|na cidade de|em)\s+([A-ZÀ-Úa-zà-ú\s]+)/i);
  if (cityMatch?.[1]) extracted.cidade = cityMatch[1].trim();

  return extracted;
}

export function QualificationHubClient({
  settings,
  testNumbers: initialTestNumbers,
  whatsappDiagnostic: initialDiagnostic,
  followUpRules: initialFollowUpRules,
  toolPermissions: initialToolPermissions,
  destinationRules: initialDestinationRules,
  brokerProfiles: initialBrokerProfiles,
  stats: initialStats,
  alerts: initialAlerts,
  agentTraining,
}: QualificationHubProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [enabled, setEnabled] = useState(settings?.enabled ?? false);
  const [pauseMode, setPauseMode] = useState(settings?.pauseMode ?? "handoff_active");
  const [assistantName, setAssistantName] = useState(settings?.assistantName ?? "Assistente AncoraHub");
  const [timeoutMinutes, setTimeoutMinutes] = useState(settings?.timeoutMinutes ?? 20);
  const [initialMessage, setInitialMessage] = useState(
    settings?.initialMessage ??
      "Olá! Sou o assistente virtual do AncoraHub. Vou fazer algumas perguntas rápidas para preparar seu atendimento."
  );
  const [handoffMessage, setHandoffMessage] = useState(
    settings?.handoffMessage ?? "Vou encaminhar você para um corretor da equipe agora."
  );
  const [businessContext, setBusinessContext] = useState(settings?.businessContext ?? "");
  const [customInstructions, setCustomInstructions] = useState(settings?.customInstructions ?? "");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setEnabled(settings.enabled);
      setPauseMode(settings.pauseMode || "handoff_active");
      setAssistantName(settings.assistantName || "Assistente AncoraHub");
      setTimeoutMinutes(settings.timeoutMinutes || 30);
      if (settings.initialMessage) setInitialMessage(settings.initialMessage);
      if (settings.handoffMessage) setHandoffMessage(settings.handoffMessage);
      if (settings.businessContext !== undefined) setBusinessContext(settings.businessContext || "");
      if (settings.customInstructions !== undefined) setCustomInstructions(settings.customInstructions || "");
    }
  }, [settings]);

  // States
  const [testNumbers, setTestNumbers] = useState(initialTestNumbers);
  const [newPhone, setNewPhone] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [followUpRules, setFollowUpRules] = useState(initialFollowUpRules);
  const [toolPermissions, setToolPermissions] = useState(initialToolPermissions);
  const [destinationRules, setDestinationRules] = useState(initialDestinationRules);
  const [brokerProfiles, setBrokerProfiles] = useState(initialBrokerProfiles);
  const [alerts, setAlerts] = useState(initialAlerts);

  const activeAlertsCount = alerts.filter((a) => a.status === "active").length;

  const tabs = [
    { id: "overview", label: "1. Contexto & Prompt do Agente", icon: MessageSquare, color: "text-primary" },
    { id: "meta_templates", label: "2. Modelos de Mensagem Meta", icon: FileText, color: "text-blue-500" },
    { id: "agent_triggers", label: "3. Loja de Triggers do Agente", icon: Zap, color: "text-amber-500" },
    { id: "training", label: "4. Treinamento e Versões", icon: Layers },
    { id: "whatsapp_diag", label: "5. WhatsApp Diagnóstico", icon: Phone, color: "text-emerald-500" },
    { id: "followup_rules", label: "6. Regras de Follow-up", icon: Clock, color: "text-purple-500" },
    { id: "mcp_governance", label: "7. Ferramentas & Governança MCP", icon: ShieldAlert, color: "text-amber-500" },
    { id: "destinations", label: "8. Destino dos Leads", icon: ArrowRightLeft, color: "text-sky-500" },
    { id: "brokers", label: "9. Elegibilidade Corretores", icon: UserCheck },
    { id: "alerts", label: `10. Alertas (${activeAlertsCount})`, icon: AlertTriangle, color: activeAlertsCount > 0 ? "text-rose-500" : undefined },
    { id: "simulator", label: "11. Simulador Web", icon: SlidersHorizontal },
  ];

  const requestedTab = searchParams.get("tab");
  const [selectedTab, setSelectedTab] = useState<string | null>(null);

  const activeTab = selectedTab ?? (tabs.some((t) => t.id === requestedTab) ? requestedTab! : "overview");

  const handleSelectTab = (tabId: string) => {
    setSelectedTab(tabId);
    try {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", tabId);
      const newUrl = `${pathname}?${params.toString()}`;
      window.history.replaceState(null, "", newUrl);
    } catch (e) {
      // Fallback
    }
  };

  // Follow-up Rule Form State
  const [newRuleName, setNewRuleName] = useState("");
  const [newRuleTrigger, setNewRuleTrigger] = useState("qualification_abandoned");
  const [newRuleDelay, setNewRuleDelay] = useState(120);
  const [newRuleMessageMode, setNewRuleMessageMode] = useState<"fixed" | "template" | "ai_generated">("fixed");
  const [newRuleMessageText, setNewRuleMessageText] = useState("Olá! Ainda posso te ajudar com a cotação do seu plano?");

  // Simulator State
  const [simMemory, setSimMemory] = useState<SimMemory>({});
  const [simConversation, setSimConversation] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [simMessages, setSimMessages] = useState<Array<{ sender: "user" | "bot"; text: string }>>([
    { sender: "bot", text: initialMessage + " Para começarmos, qual é o seu nome completo?" },
  ]);
  const [simInput, setSimInput] = useState("");
  const [simIsLoading, setSimIsLoading] = useState(false);

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      await updateQualificationSettingsAction({
        enabled,
        pauseMode: pauseMode as "finish_active" | "handoff_active" | "pause_immediately",
        assistantName: assistantName.trim() || "Assistente AncoraHub",
        initialMessage: initialMessage.trim() || "Olá! Sou o assistente virtual do AncoraHub. Vou fazer algumas perguntas rápidas para preparar seu atendimento.",
        handoffMessage: handoffMessage.trim() || "Vou encaminhar você para um corretor da equipe agora.",
        outOfHoursMessage: settings?.outOfHoursMessage || "Recebemos sua mensagem. Nossa equipe responderá no próximo horário de atendimento.",
        absenceMessage: settings?.absenceMessage || "No momento não há um corretor disponível. Deixaremos seu atendimento na fila.",
        tone: settings?.tone ?? "friendly",
        useEmojis: settings?.useEmojis ?? false,
        timeoutMinutes: Number(timeoutMinutes) || 30,
        businessContext,
        customInstructions,
        quickReplyCooldownMinutes: settings?.quickReplyCooldownMinutes ?? 10,
        quickReplyWaitWindowMinutes: settings?.quickReplyWaitWindowMinutes ?? 30,
        quickReplyWaitLimitCount: settings?.quickReplyWaitLimitCount ?? 2,
      });
      toast.success("Configurações e Operação da IA salvas com sucesso!");
      router.refresh();
    } catch (err) {
      console.error("[qualification-hub] handleSaveSettings error:", err);
      toast.error("Erro ao salvar configurações da qualificação.");
    } finally {
      setIsSaving(false);
    }
  };


const handleSaveFollowUpRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleName.trim()) {
      toast.error("Informe o nome da regra de follow-up.");
      return;
    }
    try {
      const updated = await saveFollowUpRuleAction({
        name: newRuleName,
        enabled: false,
        trigger: newRuleTrigger as any,
        delayMinutes: Number(newRuleDelay),
        maxAttempts: 3,
        minimumIntervalMinutes: 60,
        allowedDays: [1, 2, 3, 4, 5],
        allowedStartTime: "08:00",
        allowedEndTime: "18:00",
        timezone: "America/Sao_Paulo",
        messageMode: newRuleMessageMode,
        fixedMessage: newRuleMessageText,
        stopConditions: ["client_responded", "human_taken", "lead_closed", "sale_completed", "opt_out"],
      });
      setFollowUpRules(updated);
      setNewRuleName("");
      toast.success("Regra preparada. O envio automático permanece desativado.");
    } catch (err) {
      toast.error("Erro ao salvar regra de follow-up.");
    }
  };

  const handleDeleteFollowUpRule = async (id: string) => {
    try {
      const updated = await deleteFollowUpRuleAction(id);
      setFollowUpRules(updated);
      toast.success("Regra removida.");
    } catch (err) {
      toast.error("Erro ao remover regra.");
    }
  };

  const handleToggleToolPermission = async (toolName: string, currentPerm: string, isCritical: boolean) => {
    if (isCritical) {
      toast.error("Ações críticas são permanentemente bloqueadas para a IA.");
      return;
    }
    const nextPerm = currentPerm === "allowed" ? "blocked" : "allowed";
    try {
      const updated = await updateToolPermissionAction({
        toolName,
        permission: nextPerm as any,
        maxCallsPerSession: 10,
        requiresHumanConfirmation: false,
      });
      setToolPermissions(updated);
      toast.success(`Permissão para '${toolName}' alterada para '${nextPerm}'.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao alterar permissão.");
    }
  };

  const handleAcknowledgeAlert = async (id: string) => {
    try {
      const updated = await acknowledgeAlertAction(id);
      setAlerts(updated);
      toast.success("Alerta reconhecido e resolvido.");
    } catch (err) {
      toast.error("Erro ao resolver alerta.");
    }
  };

  // Web Simulator Message Send
  const handleSimSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simInput.trim() || simIsLoading) return;
    const userText = simInput.trim();

    const newConversation: Array<{ role: "user" | "assistant"; content: string }> = [
      ...simConversation,
      { role: "user", content: userText },
    ];

    setSimConversation(newConversation);
    setSimMessages((prev) => [...prev, { sender: "user", text: userText }]);
    setSimInput("");
    setSimIsLoading(true);

    const extracted = parseInputForFields(userText, simMemory);
    const updatedMemory: SimMemory = { ...simMemory, ...extracted };
    setSimMemory(updatedMemory);

    try {
      const res = await fetch("/api/qualificacao/simulador", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newConversation,
          memory: Object.fromEntries(Object.entries(updatedMemory).filter(([, v]) => Boolean(v))),
        }),
      });

      const data = (await res.json()) as { reply: string };
      const botReply = data.reply ?? "Desculpe, não consegui gerar uma resposta.";
      setSimConversation((prev) => [...prev, { role: "assistant", content: botReply }]);
      setSimMessages((prev) => [...prev, { sender: "bot", text: botReply }]);
    } catch (err) {
      toast.error("Simulador: Erro ao conectar com a IA.");
      setSimMessages((prev) => [
        ...prev,
        { sender: "bot", text: "Ops! Não consegui conectar com a IA agora. Tente novamente." },
      ]);
    } finally {
      setSimIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen space-y-6">
      <DashboardHeader
        breadcrumb="Qualificação IA"
        title="Qualificação IA"
        rightSlot={
          <div className="flex items-center gap-2">
            <BulkQualificationDialog />
            <Badge variant={enabled ? "success" : "secondary"} className="gap-1 px-2 py-1 text-xs">
              <span className={`size-2 rounded-full ${enabled ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"}`} />
              {enabled ? "IA Operando" : "IA Pausada"}
            </Badge>

            <Button onClick={handleSaveSettings} disabled={isSaving} size="sm" className="gap-1.5 text-xs font-semibold">
              <Sparkles className="size-3.5" />
              {isSaving ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        }
      />

      <div className="space-y-6">
        {/* TOP METRICS SUMMARY */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Card variant="subtle" className="rounded-xl border-border/80">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                Leads Atendidos
                <Activity className="size-4 text-primary" />
              </CardDescription>

              <CardTitle className="text-2xl font-bold tracking-tight">
                {initialStats.operation.startedToday}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[11px] text-muted-foreground">
                {initialStats.operation.active} ativos | {initialStats.operation.transferredToHuman} trans. humano
              </p>
            </CardContent>
          </Card>

          <Card variant="subtle" className="rounded-xl border-border/80">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                Taxa Qualificação
                <Sparkles className="size-4 text-amber-500" />
              </CardDescription>

              <CardTitle className="text-2xl font-bold tracking-tight">
                {initialStats.qualification.totalQualified}
              </CardTitle>
            </CardHeader>

            <CardContent>
              <p className="text-[11px] text-muted-foreground">
                {initialStats.qualification.hotLeads} quentes | {initialStats.qualification.completionRatePct}% conclusão
              </p>
            </CardContent>
          </Card>

          <Card variant="subtle" className="rounded-xl border-border/80">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                Fila de Espera
                <Clock className="size-4 text-purple-500" />
              </CardDescription>

              <CardTitle className="text-2xl font-bold tracking-tight">
                {initialStats.distribution.waitingQueue}
              </CardTitle>
            </CardHeader>

            <CardContent>
              <p className="text-[11px] text-muted-foreground">
                {initialStats.distribution.waitingQueue} em fila | SLA méd. 45s
              </p>
            </CardContent>
          </Card>

          <Card variant="subtle" className="rounded-xl border-border/80">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                Custo de Operação
                <DollarSign className="size-4 text-emerald-500" />
              </CardDescription>

              <CardTitle className="text-2xl font-bold tracking-tight">
                R$ {(initialStats.costs.aiCostBrl + initialStats.costs.whatsappCostBrl).toFixed(2)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[11px] text-muted-foreground">
                R$ {initialStats.costs.avgCostPerSessionBrl.toFixed(2)} / atendimento
              </p>
            </CardContent>
          </Card>

          <Card variant="subtle" className="rounded-xl border-border/80">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                Follow-ups Ativos
                <RotateCcw className="size-4 text-sky-500" />
              </CardDescription>

              <CardTitle className="text-2xl font-bold tracking-tight">
                {initialStats.followup.sent} enviados
              </CardTitle>
            </CardHeader>

            <CardContent>
              <p className="text-[11px] text-muted-foreground">
                {initialStats.followup.conversionsPostFollowup} rec. pós-followup
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 2-COLUMN SETTINGS-STYLE LAYOUT */}
        <div className="grid gap-6 lg:grid-cols-[16.5rem_1fr] items-start">
          {/* MOBILE HORIZONTAL SUBNAV */}
          <ScrollArea orientation="horizontal" className="w-full whitespace-nowrap lg:hidden">
            <nav className="flex gap-1.5 pb-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => handleSelectTab(tab.id)}
                    className={cn(
                      "flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-all",
                      isActive
                        ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                        : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="size-3.5 shrink-0" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </ScrollArea>

          {/* DESKTOP SIDEBAR SUBNAV */}
          <nav className="hidden lg:flex lg:flex-col gap-1 p-2 rounded-2xl border bg-card/80 backdrop-blur-xs shadow-2xs sticky top-4">
            <div className="px-3 py-2 text-[10px] font-bold tracking-wider text-muted-foreground/80 uppercase border-b mb-1">
              Menu de Configuração IA
            </div>
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleSelectTab(tab.id)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs transition-all text-left w-full",
                    isActive
                      ? "bg-primary/10 text-primary font-semibold border-l-4 border-l-primary shadow-2xs"
                      : "text-muted-foreground hover:bg-muted/70 hover:text-foreground font-medium"
                  )}
                >
                  <Icon className={cn("size-4 shrink-0", tab.color ?? "text-muted-foreground")} />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* ACTIVE TAB CONTENT */}
          <div className="min-w-0 space-y-6">
            {activeTab === "overview" && (
              <div className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
              <Card variant="subtle" className="rounded-xl border-border/80">
                <CardHeader>
                  <CardTitle className="text-base font-semibold">Status do Agente e Operação</CardTitle>
                  <CardDescription className="text-xs">Ative ou pause o robô de qualificação por tenant</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/20">
                    <div className="space-y-0.5">
                      <div className="font-semibold text-sm">Operação da IA de Qualificação</div>
                      <div className="text-xs text-muted-foreground">
                        {enabled ? "O robô responderá novos atendimentos via WhatsApp." : "Automação pausada. Mensagens irão direto para fila humana."}
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={(e) => setEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
                    </label>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Modo de Pausa</Label>
                    <Select value={pauseMode} onValueChange={(v) => { if (v) setPauseMode(v); }}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="handoff_active">Transferir ativas para corretores (Recomendado)</SelectItem>
                        <SelectItem value="finish_active">Concluir conversas já iniciadas</SelectItem>
                        <SelectItem value="pause_immediately">Pausar imediatamente todas as conversas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-border/40">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold">Tempo Limite de Qualificação (Sem Resposta)</Label>
                      <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-600 dark:text-amber-400 font-mono">
                        {timeoutMinutes} min
                      </Badge>
                    </div>
                    <Input
                      type="number"
                      min={5}
                      max={120}
                      value={timeoutMinutes}
                      onChange={(e) => setTimeoutMinutes(Number(e.target.value))}
                      placeholder="20"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Se o lead ficar mais de <strong>{timeoutMinutes} minutos sem responder</strong>, a qualificação por IA é encerrada, o lead é etiquetado como <strong>Cold</strong> e enviado direto para a <strong>Fila de Distribuição de Corretores</strong>.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card variant="subtle" className="rounded-xl border-border/80">
                <CardHeader>
                  <CardTitle className="text-base font-semibold">Identidade do Assistente</CardTitle>
                  <CardDescription className="text-xs">Nome exibido e mensagem inicial de acolhimento</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Nome de Exibição do Robô</Label>
                    <Input
                      value={assistantName}
                      onChange={(e) => setAssistantName(e.target.value)}
                      placeholder="Ex: Assistente Virtual Âncora"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Mensagem Inicial (Saudação)</Label>
                    <Textarea
                      value={initialMessage}
                      onChange={(e) => setInitialMessage(e.target.value)}
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card variant="subtle" className="rounded-xl border-border/80 md:col-span-2">
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <div>
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Bot className="size-4 text-primary" />
                      Conhecimento & Diretrizes da Empresa (Prompt de Contexto)
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Instrua o robô com a base de conhecimento institucional, planos comercializados e diretrizes comportamentais.
                    </CardDescription>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSaveSettings}
                    disabled={isSaving}
                    className="gap-1.5 font-semibold"
                  >
                    <Sparkles className="size-3.5" />
                    {isSaving ? "Salvando…" : "Salvar Alterações"}
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Base de Conhecimento da Empresa (Informações & Produtos)</Label>
                    <Textarea
                      value={businessContext}
                      onChange={(e) => setBusinessContext(e.target.value)}
                      rows={4}
                      placeholder="Ex: Somos uma corretora especialista em planos de saúde individuais, familiares e PME em São Paulo e região. Trabalhamos com Amil, Bradesco Saúde, SulAmérica, NotreDame Intermédica e Unimed..."
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Estas informações serão fornecidas à IA para fundamentar o atendimento e esclarecer dúvidas do cliente.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Diretrizes de Atuação & Tom de Voz (Instruções Personalizadas)</Label>
                    <Textarea
                      value={customInstructions}
                      onChange={(e) => setCustomInstructions(e.target.value)}
                      rows={4}
                      placeholder="Ex: Seja cordial, empático e objetivo. Mantenha tom profissional. NUNCA solicite documentos sensíveis como CPF ou fotos no chat..."
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Regras de conduta, tom de voz e limitações que a IA deve respeitar rigorosamente.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* TAB 2: WHATSAPP DIAGNÓSTICO & TESTES */}
        {activeTab === "whatsapp_diag" && (
          <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-3">
              <Card variant="subtle" className="rounded-xl border-border/80 md:col-span-1 space-y-4 p-5">
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Phone className="size-4 text-emerald-500" />
                    Status da Conexão WhatsApp
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">Diagnóstico completo da API Meta WABA</p>
                </div>

                <div className="space-y-3 pt-2 text-xs">
                  <div className="flex justify-between border-b pb-1.5">
                    <span className="text-muted-foreground">Canal conectado:</span>
                    <span className={cn("font-semibold", initialDiagnostic.channelConnected ? "text-emerald-600" : "text-amber-600")}>
                      {initialDiagnostic.channelConnected ? "Conectado" : "Desconectado"}
                    </span>
                  </div>
                  <div className="flex justify-between border-b pb-1.5">
                    <span className="text-muted-foreground">Número oficial:</span>
                    <span className="font-mono">{initialDiagnostic.officialNumber ?? "Não configurado"}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1.5">
                    <span className="text-muted-foreground">Nome exibido:</span>
                    <span className="font-medium">{initialDiagnostic.displayName ?? "Não configurado"}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1.5">
                    <span className="text-muted-foreground">Phone Number ID:</span>
                    <span className="font-mono text-[11px]">{initialDiagnostic.phoneNumberId ?? "Não configurado"}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1.5">
                    <span className="text-muted-foreground">Status do Webhook:</span>
                    <Badge variant={initialDiagnostic.webhookStatus === "active" ? "default" : "outline"} className="text-[10px]">
                      {initialDiagnostic.webhookStatus === "active" ? "Ativo" : "Não configurado"}
                    </Badge>
                  </div>
                  <div className="flex justify-between border-b pb-1.5">
                    <span className="text-muted-foreground">Token Meta API:</span>
                    <span className={cn("font-semibold", initialDiagnostic.tokenStatus === "valid" ? "text-emerald-600" : "text-muted-foreground")}>
                      {initialDiagnostic.tokenStatus === "valid"
                        ? `Válido ${initialDiagnostic.tokenExpirationDays ? `(${initialDiagnostic.tokenExpirationDays} dias)` : ""}`
                        : "Não configurado"}
                    </span>
                  </div>
                  <div className="flex justify-between border-b pb-1.5">
                    <span className="text-muted-foreground">Latência média:</span>
                    <span className="font-semibold">{initialDiagnostic.averageLatencyMs} ms</span>
                  </div>
                </div>
              </Card>

              {/* TEST MESSAGE SENDER */}
              <WhatsAppTestMessageCard className="md:col-span-2" />
            </div>
          </div>
        )}

        {/* TAB 2: MODELOS DE MENSAGEM META */}
        {activeTab === "meta_templates" && <MetaTemplatesPanel />}

        {/* TAB 3: LOJA DE TRIGGERS DO AGENTE */}
        {activeTab === "agent_triggers" && <AgentTriggersPanel />}

        {/* TAB 3: REGRAS DE FOLLOW-UP */}
        {activeTab === "followup_rules" && (
          <div className="space-y-6">
            <Card variant="subtle" className="rounded-xl border-border/80 p-5 space-y-6">
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Clock className="size-4 text-purple-500" />
                  Regras de Acompanhamento (Follow-up)
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Configure mensagens automáticas de retorno por inatividade ou abandono. Respeita opt-out e janela comercial.
                </p>
              </div>

              {/* NEW RULE FORM */}
              <form onSubmit={handleSaveFollowUpRule} className="rounded-lg border p-4 space-y-4 bg-muted/20">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Cadastrar Nova Regra</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Nome da Regra</Label>
                    <Input
                      value={newRuleName}
                      onChange={(e) => setNewRuleName(e.target.value)}
                      placeholder="Ex: Lead abandonou qualificação"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Gatilho (Trigger)</Label>
                    <Select value={newRuleTrigger} onValueChange={(v) => { if (v) setNewRuleTrigger(v); }}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="qualification_abandoned">Lead abandonou a qualificação</SelectItem>
                        <SelectItem value="no_first_response">Sem resposta à 1ª mensagem</SelectItem>
                        <SelectItem value="waiting_broker">Aguardando corretor no plantão</SelectItem>
                        <SelectItem value="quote_without_response">Cotação enviada sem retorno</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Atraso (Minutos)</Label>
                    <Input
                      type="number"
                      value={newRuleDelay}
                      onChange={(e) => setNewRuleDelay(Number(e.target.value))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Modo da Mensagem</Label>
                    <Select
                      value={newRuleMessageMode}
                      onValueChange={(val: any) => setNewRuleMessageMode(val)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed">Mensagem Fixa (Econômica)</SelectItem>
                        <SelectItem value="template">Template Oficial (HSM)</SelectItem>
                        <SelectItem value="ai_generated">Gerada por IA (Custo R$ 0,02)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-xs font-semibold">Texto / Mensagem Fixa</Label>
                    <Input
                      value={newRuleMessageText}
                      onChange={(e) => setNewRuleMessageText(e.target.value)}
                    />
                  </div>
                </div>

                {newRuleMessageMode === "ai_generated" && (
                  <div className="rounded-md bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-600 flex items-center justify-between">
                    <div>
                      <strong>Aviso de Custo:</strong> Esta regra chamará a IA a cada execução (Custo est. R$ 0,02).
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setNewRuleMessageMode("fixed")}
                      className="text-[11px] h-7"
                    >
                      Usar mensagem fixa (Recomendado)
                    </Button>
                  </div>
                )}

                <Button type="submit" size="sm" className="gap-2">
                  <Plus className="size-3.5" /> Adicionar Regra
                </Button>
              </form>

              {/* RULES LIST */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Regras Ativas</h4>
                {followUpRules.map((rule) => (
                  <div key={rule.id} className="flex items-center justify-between p-4 rounded-lg border bg-card">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{rule.name}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {rule.trigger}
                        </Badge>
                        <Badge variant={rule.messageMode === "ai_generated" ? "warning" : "secondary"} className="text-[10px]">
                          {rule.messageMode}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Executa após {rule.delayMinutes} min | Máx {rule.maxAttempts} tentativas | Janela: {rule.allowedStartTime} às {rule.allowedEndTime}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteFollowUpRule(rule.id)}
                      className="text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {activeTab === "training" && (
          <div className="grid gap-6">
            <AgentTrainingTab enabled={agentTraining.enabled} canEdit={agentTraining.canEdit} versions={agentTraining.versions} />
          </div>
        )}

        {/* TAB 4: GOVERNANÇA MCP */}
        {activeTab === "mcp_governance" && (
          <div className="space-y-6">
            <Card variant="subtle" className="rounded-xl border-border/80 p-5 space-y-6">
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <ShieldAlert className="size-4 text-amber-500" />
                  Governança & Permissões de Ferramentas (MCP)
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Controle estrito do que a IA pode consultar ou modificar. Ações críticas permanecem desativadas.
                </p>
              </div>

              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 font-semibold border-b">
                    <tr>
                      <th className="p-3">Ferramenta / Tool</th>
                      <th className="p-3">Categoria</th>
                      <th className="p-3">Descrição</th>
                      <th className="p-3">Permissão</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {toolPermissions.map((tool) => (
                      <tr key={tool.toolName} className={tool.isCritical ? "bg-rose-500/5" : ""}>
                        <td className="p-3 font-semibold">{tool.displayName}</td>
                        <td className="p-3">
                          <Badge
                            variant={
                              tool.category === "critical"
                                ? "destructive"
                                : tool.category === "read_only"
                                ? "secondary"
                                : "outline"
                            }
                            className="text-[10px]"
                          >
                            {tool.category}
                          </Badge>
                        </td>
                        <td className="p-3 text-muted-foreground">{tool.description}</td>
                        <td className="p-3">
                          {tool.isCritical ? (
                            <Badge variant="destructive" className="gap-1 text-[10px]">
                              <Lock className="size-3" /> Bloqueado (Crítico)
                            </Badge>
                          ) : (
                            <Button
                              variant={tool.permission === "allowed" ? "default" : "outline"}
                              size="sm"
                              className="h-7 text-[11px]"
                              onClick={() => handleToggleToolPermission(tool.toolName, tool.permission, tool.isCritical)}
                            >
                              {tool.permission === "allowed" ? "Permitido" : "Bloqueado"}
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* TAB 5: DESTINO DOS LEADS */}
        {activeTab === "destinations" && (
          <div className="space-y-6">
            <Card variant="subtle" className="rounded-xl border-border/80 p-5 space-y-6">
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <ArrowRightLeft className="size-4 text-sky-500" />
                  Destino & Encaminhamento de Leads Qualificados
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Defina a rota e prioridade de distribuição conforme a classificação/temperatura do lead.
                </p>
              </div>

              <div className="space-y-3">
                {destinationRules.map((rule) => (
                  <div key={rule.id} className="p-4 rounded-lg border bg-card flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            rule.temperatureClass === "hot"
                              ? "destructive"
                              : rule.temperatureClass === "warm"
                              ? "warning"
                              : "secondary"
                          }
                          className="uppercase text-[10px]"
                        >
                          Lead {rule.temperatureClass}
                        </Badge>
                        <span className="font-semibold text-sm">Destino: {rule.destinationType}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Prioridade: {rule.priority} | SLA Target: {rule.slaMinutes} min | Fallback: {rule.fallbackDestinationType}
                      </p>
                    </div>
                    <Badge variant="outline">Ordem #{rule.sortOrder}</Badge>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* TAB 6: ELEGIBILIDADE CORRETORES */}
        {activeTab === "brokers" && (
          <div className="space-y-6">
            <Card variant="subtle" className="rounded-xl border-border/80 p-5 space-y-6">
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <UserCheck className="size-4 text-emerald-500" />
                  Elegibilidade e Capacidade dos Corretores
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Defina os limites diários, capacidade simultânea e participação de plantão por corretor.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {brokerProfiles.map((broker) => (
                  <div key={broker.id} className="p-4 rounded-lg border bg-card space-y-3">
                    <div className="flex items-center justify-between border-b pb-2">
                      <div>
                        <div className="font-semibold text-sm">{broker.userName}</div>
                        <div className="text-xs text-muted-foreground">{broker.userEmail}</div>
                      </div>
                      <Badge variant={broker.active ? "success" : "secondary"}>
                        {broker.active ? "Ativo no Plantão" : "Pausado"}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>Capacidade Simultânea: <span className="font-semibold">{broker.maxSimultaneousCapacity} leads</span></div>
                      <div>Limite Diário: <span className="font-semibold">{broker.dailyLimit} leads</span></div>
                      <div>Plantão: <span className="font-semibold">{broker.participatesInDuty ? "Sim" : "Não"}</span></div>
                      <div>Especialidades: <span className="font-semibold">PME, Individual</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* TAB 7: MENSAGENS DO SISTEMA */}
        {activeTab === "system_messages" && (
          <div className="space-y-6">
            <Card variant="subtle" className="rounded-xl border-border/80 p-5 space-y-6">
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="size-4 text-primary" />
                  Mensagens Estáticas do Sistema (Sem uso de IA)
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Respostas fixas para situações determinísticas (Encerramento, Opt-out, Fora de horário, Aguardando corretor).
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Mensagem de Encerramento Determinístico (Após Qualificação)</Label>
                  <Textarea
                    defaultValue={settings?.finalMessage ?? "Obrigado pelas informações, {{firstName}}! Sua qualificação foi concluída e um de nossos corretores entrará em contato em instantes."}
                    rows={3}
                  />
                  <p className="text-[11px] text-muted-foreground">Enviada uma única vez ao finalizar. IA não é chamada.</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Aviso Pós-Encerramento (Aguardando Corretor)</Label>
                  <Textarea
                    defaultValue="Seu atendimento já foi encaminhado. Um corretor entrará em contato assim que estiver disponível."
                    rows={2}
                  />
                  <p className="text-[11px] text-muted-foreground">Enviado apenas no primeiro envio do cliente pós-encerramento. IA desativada.</p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* TAB 8: ALERTAS OPERACIONAIS */}
        {activeTab === "alerts" && (
          <div className="space-y-6">
            <Card variant="subtle" className="rounded-xl border-border/80 p-5 space-y-6">
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle className="size-4 text-rose-500" />
                  Central de Alertas Operacionais
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Monitoramento em tempo real de filas sem corretor, desconexões e problemas operacionais.
                </p>
              </div>

              <div className="space-y-3">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-4 rounded-lg border flex items-start justify-between ${
                      alert.status === "active" ? "bg-rose-500/5 border-rose-500/20" : "bg-card opacity-70"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={alert.level === "critical" ? "destructive" : "warning"} className="text-[10px]">
                          {alert.level}
                        </Badge>
                        <span className="font-semibold text-sm">{alert.alertType}</span>
                      </div>
                      <p className="text-xs text-foreground">{alert.message}</p>
                      {alert.suggestedAction && (
                        <p className="text-[11px] text-muted-foreground font-medium">Ação recomendada: {alert.suggestedAction}</p>
                      )}
                    </div>
                    {alert.status === "active" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAcknowledgeAlert(alert.id)}
                        className="text-xs h-8"
                      >
                        Resolver
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* TAB 9: SIMULADOR WEB */}
        {activeTab === "simulator" && (
          <div className="space-y-6">
            <Card variant="subtle" className="rounded-xl border-border/80 p-5 space-y-4">
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <MessageSquare className="size-4 text-primary" />
                  Simulador de Qualificação (Ambiente Dev Web)
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Testar o comportamento da IA com simulação do motor de memória em tempo real.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 rounded-lg border p-4 bg-muted/20 flex flex-col h-[400px]">
                  <div className="flex-1 overflow-y-auto space-y-3 p-2">
                    {simMessages.map((msg, i) => (
                      <div
                        key={i}
                        className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg p-3 text-xs ${
                            msg.sender === "user"
                              ? "bg-primary text-primary-foreground"
                              : "bg-card border text-card-foreground"
                          }`}
                        >
                          {msg.text}
                        </div>
                      </div>
                    ))}
                  </div>

                  <form onSubmit={handleSimSendMessage} className="flex gap-2 pt-2 border-t">
                    <Input
                      value={simInput}
                      onChange={(e) => setSimInput(e.target.value)}
                      placeholder="Digite a resposta do cliente..."
                    />
                    <Button type="submit" disabled={simIsLoading} size="sm">
                      <Send className="size-4" />
                    </Button>
                  </form>
                </div>

                <div className="rounded-lg border p-4 bg-card space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Inspetor de Memória Extraída</h4>
                  <div className="space-y-2 text-xs">
                    <div>Nome: <span className="font-semibold">{simMemory.nome ?? "—"}</span></div>
                    <div>Plano: <span className="font-semibold">{simMemory.plano ?? "—"}</span></div>
                    <div>Vidas: <span className="font-semibold">{simMemory.vidas ?? "—"}</span></div>
                    <div>Idade: <span className="font-semibold">{simMemory.idade ?? "—"}</span></div>
                    <div>Cidade: <span className="font-semibold">{simMemory.cidade ?? "—"}</span></div>
                    <div>Email: <span className="font-semibold">{simMemory.email ?? "—"}</span></div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  </div>
  </div>
  );
}
