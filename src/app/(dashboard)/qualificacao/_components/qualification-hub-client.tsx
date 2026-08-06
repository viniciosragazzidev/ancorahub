"use client";

import { useState } from "react";
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
  Check,
  RefreshCw,
} from "lucide-react";

import { DashboardHeader } from "@/components/dashboard-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  updateQualificationSettingsAction,
  addTestNumberAction,
  removeTestNumberAction,
  resetMemoryAction,
} from "@/features/ai-qualification/actions";

type QualificationHubProps = {
  settings: {
    enabled: boolean;
    pauseMode: string;
    assistantName: string;
    initialMessage: string;
    handoffMessage: string;
    outOfHoursMessage: string;
    absenceMessage: string;
    tone: string;
    useEmojis: boolean;
    timeoutMinutes: number;
    version: number;
    updatedAt: string | Date | null;
  } | null;
  testNumbers: Array<{
    id: string;
    phoneNumber: string;
    label: string;
    active: boolean;
    autoResetMode: string;
  }>;
};

type SimMemory = {
  nome?: string;
  plano?: string;
  vidas?: string;
  idade?: string;
  cidade?: string;
  email?: string;
};

// --- Context & NLP Helpers for Web Simulator ---

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

  // 1. Name Pattern
  const nameMatch = trimmed.match(/(?:meu nome e|meu nome é|me chamo|sou o|sou a|eu sou|me chamo de)\s+([A-ZÀ-Úa-zà-ú\s]+)/i);
  if (nameMatch?.[1]) {
    extracted.nome = nameMatch[1].trim();
  }

  // 2. Email Pattern
  const emailMatch = trimmed.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (emailMatch?.[1]) {
    extracted.email = emailMatch[1].trim();
  }

  // 3. Plan Type Pattern
  if (/\b(individual|pf|para mim|so para mim|só para mim|minha pessoa)\b/i.test(lower)) {
    extracted.plano = "Individual";
    if (!currentMemory.vidas) extracted.vidas = "1 pessoa";
  } else if (/\b(familiar|familia|família|para minha familia|para minha família)\b/i.test(lower)) {
    extracted.plano = "Familiar";
  } else if (/\b(pme|pj|empresarial|empresa|para minha empresa|coletivo|cnpj)\b/i.test(lower)) {
    extracted.plano = "Empresarial (PME)";
  }

  // 4. Lives Pattern
  const livesMatch = trimmed.match(/(\d+)\s*(?:pessoas|vidas|dependentes|integrantes)?/i);
  if (livesMatch?.[1] && Number(livesMatch[1]) > 0 && Number(livesMatch[1]) < 500 && !extracted.idade) {
    if (lower.includes("pessoa") || lower.includes("vida") || lower.includes("integrante") || !currentMemory.vidas) {
      extracted.vidas = `${livesMatch[1]} ${Number(livesMatch[1]) === 1 ? "pessoa" : "pessoas"}`;
    }
  }

  // 5. Age Pattern
  const ageMatch = trimmed.match(/(\d+)\s*(?:anos|ano)/i);
  if (ageMatch?.[1]) {
    extracted.idade = `${ageMatch[1]} anos`;
  }

  // 6. City Pattern
  const cityMatch = trimmed.match(/(?:moro em|sou de|na cidade de|em)\s+([A-ZÀ-Úa-zà-ú\s]+)/i);
  if (cityMatch?.[1]) {
    extracted.cidade = cityMatch[1].trim();
  }

  return extracted;
}

export function QualificationHubClient({ settings, testNumbers: initialTestNumbers }: QualificationHubProps) {
  const [enabled, setEnabled] = useState(settings?.enabled ?? false);
  const [pauseMode, setPauseMode] = useState(settings?.pauseMode ?? "handoff_active");
  const [assistantName, setAssistantName] = useState(settings?.assistantName ?? "Assistente Âncora Corretora");
  const [initialMessage, setInitialMessage] = useState(
    settings?.initialMessage ??
      "Olá! Sou o assistente virtual da Âncora Corretora. Vou fazer algumas perguntas rápidas para preparar seu atendimento."
  );
  const [handoffMessage, setHandoffMessage] = useState(
    settings?.handoffMessage ?? "Vou encaminhar você para um corretor da equipe agora."
  );
  const [isSaving, setIsSaving] = useState(false);

  // Test numbers state
  const [testNumbers, setTestNumbers] = useState(initialTestNumbers);
  const [newPhone, setNewPhone] = useState("");
  const [newLabel, setNewLabel] = useState("");

  // Memory reset state
  const [resetLeadId, setResetLeadId] = useState("");
  const [resetReason, setResetReason] = useState("");

  // Web Simulator State Engine
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
        assistantName,
        initialMessage,
        handoffMessage,
        outOfHoursMessage: settings?.outOfHoursMessage ?? "Fora do horário",
        absenceMessage: settings?.absenceMessage ?? "Sem corretores",
        tone: settings?.tone ?? "friendly",
        useEmojis: settings?.useEmojis ?? false,
        timeoutMinutes: settings?.timeoutMinutes ?? 30,
      });
      toast.success("Configurações da qualificação salvas com sucesso!");
    } catch (err) {
      toast.error("Erro ao salvar configurações da qualificação.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddTestNumber = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPhone || !newLabel) {
      toast.error("Preencha o número e a identificação.");
      return;
    }
    try {
      const added = await addTestNumberAction({
        phoneNumber: newPhone,
        label: newLabel,
        autoResetMode: "before_each_session",
        isolatedFromMetrics: true,
        isolatedFromQueues: true,
        allowTestCommands: true,
      });
      setTestNumbers((prev) => [...prev, added]);
      setNewPhone("");
      setNewLabel("");
      toast.success("Número de teste cadastrado.");
    } catch (err) {
      toast.error("Erro ao cadastrar número de teste.");
    }
  };

  const handleRemoveTestNumber = async (id: string) => {
    try {
      await removeTestNumberAction(id);
      setTestNumbers((prev) => prev.filter((t) => t.id !== id));
      toast.success("Número de teste removido.");
    } catch (err) {
      toast.error("Erro ao remover número de teste.");
    }
  };

  const handleResetMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetLeadId || !resetReason) {
      toast.error("Informe o ID do lead e o motivo do reset.");
      return;
    }
    try {
      await resetMemoryAction({
        leadId: resetLeadId,
        scope: "full_reset",
        reason: resetReason,
        preserveLeadRecord: true,
        preserveCommercialProfile: true,
      });
      toast.success("Memória da IA reiniciada com sucesso para o lead.");
      setResetLeadId("");
      setResetReason("");
    } catch (err) {
      toast.error("Erro ao reiniciar memória do lead.");
    }
  };

  // Context-Aware Simulator Processor — uses real AI via API
  const handleRestartSimulator = () => {
    setSimMemory({});
    setSimConversation([]);
    setSimMessages([
      { sender: "bot", text: initialMessage + " Para começarmos, qual é o seu nome completo?" },
    ]);
    setSimInput("");
  };

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

    // Update memory locally (for real-time inspector display)
    const extracted = parseInputForFields(userText, simMemory);
    const updatedMemory: SimMemory = { ...simMemory, ...extracted };
    if (!updatedMemory.nome && !isPureGreeting(userText)) {
      updatedMemory.nome = userText;
    }
    setSimMemory(updatedMemory);

    try {
      const res = await fetch("/api/qualificacao/simulador", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newConversation,
          memory: updatedMemory as Record<string, string>,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Erro desconhecido" }));
        throw new Error(err.error ?? "Falha na API do simulador");
      }

      const data = await res.json() as {
        reply: string;
        modelUsed: string;
        latencyMs: number;
        shouldTransferToHuman: boolean;
      };

      const botReply = data.reply;
      setSimConversation((prev) => [...prev, { role: "assistant", content: botReply }]);
      setSimMessages((prev) => [...prev, { sender: "bot", text: botReply }]);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Erro ao conectar com a IA.";
      toast.error(`Simulador: ${errorMsg}`);
      setSimMessages((prev) => [
        ...prev,
        { sender: "bot", text: "Ops! Não consegui conectar com a IA agora. Verifique se a chave OpenRouter está configurada." },
      ]);
    } finally {
      setSimIsLoading(false);
    }
  };

  function getNextQuestionPrompt(mem: SimMemory): string {
    if (!mem.nome) return "Para começarmos, qual é o seu nome completo?";
    if (!mem.plano) return `Prazer, ${mem.nome}! Para quantas pessoas você busca o plano de saúde (Individual, Familiar ou PME)?`;
    if (!mem.vidas) return "Entendido! Quantas pessoas serão incluídas no plano?";
    if (!mem.idade) return "Perfeito! Qual a idade das pessoas que serão incluídas?";
    if (!mem.cidade) return "Ótimo! Em qual cidade e estado você pretende contratar o plano?";
    if (!mem.email) return "Excelente! Para finalizar, qual o seu melhor e-mail para envio da cotação?";
    return `${handoffMessage} Um de nossos especialistas entrará em contato em instantes!`;
  }

  function generateContextualBotReply(mem: SimMemory, handoffMsg: string): string {
    if (!mem.plano) {
      return `Prazer, ${mem.nome}! Para quantas pessoas você busca o plano de saúde (Individual, Familiar ou PME)?`;
    }
    if (!mem.vidas) {
      return `Entendido, plano ${mem.plano}! Quantas pessoas serão incluídas no plano?`;
    }
    if (!mem.idade) {
      return `Perfeito! Qual a idade da(s) pessoa(s) que será(ão) incluída(s)?`;
    }
    if (!mem.cidade) {
      return `Ótimo! Em qual cidade e estado você pretende contratar o plano?`;
    }
    if (!mem.email) {
      return `Perfeito, ${mem.cidade}! E para finalizar, qual o seu melhor e-mail para enviarmos a cotação comparativa?`;
    }
    return `${handoffMsg} Todos os dados foram coletados com sucesso!`;
  }

  // Calculate dynamic simulator score and active step title
  const collectedFieldsList = Object.keys(simMemory).filter((k) => Boolean(simMemory[k as keyof SimMemory]));
  const collectedCount = collectedFieldsList.length;
  const currentScore = Math.min(100, collectedCount * 18 + (collectedCount === 6 ? 10 : 0));

  const activeStepTitle =
    !simMemory.nome ? "1. Coleta do Nome do Cliente"
      : !simMemory.plano ? "2. Coleta do Tipo de Plano"
        : !simMemory.vidas ? "3. Coleta de Quantidade de Vidas"
          : !simMemory.idade ? "4. Coleta da Idade"
            : !simMemory.cidade ? "5. Coleta da Cidade de Atendimento"
              : !simMemory.email ? "6. Coleta do E-mail para Cotação"
                : "Qualificação Concluída (Handoff)";

  return (
    <div className="flex flex-col min-h-screen">
      <DashboardHeader
        breadcrumb="Gestão de Operação"
        title="Qualificação IA"
        rightSlot={
          <div className="flex items-center gap-2">
            <Badge variant={enabled ? "success" : "secondary"} className="gap-1 px-2 py-1 text-xs">
              <span className={`size-2 rounded-full ${enabled ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"}`} />
              {enabled ? "IA Ativa" : "Pausada"}
            </Badge>

            <Button onClick={handleSaveSettings} disabled={isSaving} size="sm" className="gap-1.5 text-xs font-semibold">
              <Sparkles className="size-3.5" />
              {isSaving ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        }
      />

      <main className="flex-1 p-4 lg:p-6 space-y-6 max-w-7xl w-full mx-auto">
        {/* Metric Cards Top Overview */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card variant="subtle" className="rounded-xl border-border/80">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Estado da IA
              </CardTitle>
              <Power className={`size-4 ${enabled ? "text-emerald-500" : "text-muted-foreground"}`} />
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xl font-bold tracking-tight text-foreground">
                  {enabled ? "Ativada" : "Pausada"}
                </span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary" />
                </label>
              </div>
              <p className="text-[11px] text-muted-foreground">Controle central do robô por tenant</p>
            </CardContent>
          </Card>

          <Card variant="subtle" className="rounded-xl border-border/80">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Modo de Pausa
              </CardTitle>
              <ShieldCheck className="size-4 text-primary" />
            </CardHeader>
            <CardContent className="space-y-1">
              <span className="text-sm font-bold tracking-tight text-foreground truncate block">
                {pauseMode === "handoff_active"
                  ? "Transferir para Humano"
                  : pauseMode === "finish_active"
                    ? "Concluir Atuais"
                    : "Pausar Imediatamente"}
              </span>
              <p className="text-[11px] text-muted-foreground">Tratamento seguro em transições</p>
            </CardContent>
          </Card>

          <Card variant="subtle" className="rounded-xl border-border/80">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Números de Teste
              </CardTitle>
              <Phone className="size-4 text-sky-500" />
            </CardHeader>
            <CardContent className="space-y-1">
              <span className="text-xl font-bold tracking-tight text-foreground">
                {testNumbers.length} cadastrados
              </span>
              <p className="text-[11px] text-muted-foreground">Devs isolados das métricas reais</p>
            </CardContent>
          </Card>

          <Card variant="subtle" className="rounded-xl border-border/80">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Versão da Configuração
              </CardTitle>
              <Layers className="size-4 text-amber-500" />
            </CardHeader>
            <CardContent className="space-y-1">
              <span className="text-xl font-bold tracking-tight text-foreground">
                v{settings?.version ?? 1} Publicada
              </span>
              <p className="text-[11px] text-muted-foreground">Auditável e rastreável no banco</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabbed Configuration Sections */}
        <Tabs defaultValue="simulator" className="w-full space-y-4">
          <TabsList className="w-full justify-start overflow-x-auto border-b border-border/60 bg-transparent p-0">
            <TabsTrigger value="overview" className="gap-2 text-xs font-semibold py-2.5">
              <SlidersHorizontal className="size-3.5" />
              Visão Geral & Ativação
            </TabsTrigger>
            <TabsTrigger value="prompts" className="gap-2 text-xs font-semibold py-2.5">
              <Bot className="size-3.5" />
              Identidade & Saudações
            </TabsTrigger>
            <TabsTrigger value="test_environment" className="gap-2 text-xs font-semibold py-2.5">
              <Phone className="size-3.5" />
              Números de Teste Dev
            </TabsTrigger>
            <TabsTrigger value="simulator" className="gap-2 text-xs font-semibold py-2.5">
              <MessageSquare className="size-3.5" />
              Simulador Web (Contexto IA)
            </TabsTrigger>
            <TabsTrigger value="memory_reset" className="gap-2 text-xs font-semibold py-2.5">
              <RotateCcw className="size-3.5" />
              Reset de Memória
            </TabsTrigger>
          </TabsList>

          {/* ─── TAB 1: VISÃO GERAL & ATIVAÇÃO ─── */}
          <TabsContent value="overview" className="space-y-6 pt-2">
            <div className="grid gap-6 md:grid-cols-2">
              <Card variant="subtle" className="rounded-xl border-border/80">
                <CardHeader>
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Power className="size-4 text-primary" />
                    Ativação da Qualificação por IA
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Ative ou pause o robô para todo o tenant. O servidor valida a chave antes de responder a qualquer mensagem.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg border border-border/60 p-4 bg-card">
                    <div>
                      <p className="text-xs font-bold text-foreground">Status do Atendimento por IA</p>
                      <p className="text-[11px] text-muted-foreground">
                        {enabled ? "A IA está processando qualificação de novos leads." : "Qualificação por IA desativada."}
                      </p>
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

                  <div className="space-y-2 pt-2">
                    <Label className="text-xs font-semibold">Regra de Transição no Desligamento</Label>
                    <Select value={pauseMode} onValueChange={(val) => setPauseMode(val ?? "handoff_active")}>
                      <SelectTrigger className="w-full text-xs">
                        <SelectValue placeholder="Selecione o modo de pausa" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="handoff_active" className="text-xs">
                          Pausar imediatamente e transferir conversas para atendimento humano
                        </SelectItem>
                        <SelectItem value="finish_active" className="text-xs">
                          Concluir conversas em andamento e não iniciar novas
                        </SelectItem>
                        <SelectItem value="pause_immediately" className="text-xs">
                          Pausar imediatamente sem transferir
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              <Card variant="subtle" className="rounded-xl border-border/80">
                <CardHeader>
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <ShieldCheck className="size-4 text-primary" />
                    Segurança & Multi-Tenant
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Regras ativas de integridade e escopo de acesso comercial.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  <div className="flex items-start gap-2.5 rounded-lg border border-border/40 p-3 bg-muted/20">
                    <Check className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-foreground">Isolamento Estrito por Tenant</p>
                      <p className="text-[11px] text-muted-foreground">Toda mensagem passa pela validação de tenantId no servidor.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 rounded-lg border border-border/40 p-3 bg-muted/20">
                    <Check className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-foreground">Auditoria Imutável</p>
                      <p className="text-[11px] text-muted-foreground">Todas as alterações de versão e resets são gravados em logs.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ─── TAB 2: IDENTIDADE & PROMPTS ─── */}
          <TabsContent value="prompts" className="space-y-6 pt-2">
            <Card variant="subtle" className="rounded-xl border-border/80">
              <CardHeader>
                <CardTitle className="text-sm font-bold">Identidade do Assistente & Respostas Padrão</CardTitle>
                <CardDescription className="text-xs">
                  Configure o nome, saudação e mensagem de transferência apresentados no WhatsApp.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5 max-w-md">
                  <Label className="text-xs font-semibold">Nome do Assistente Virtual</Label>
                  <Input
                    value={assistantName}
                    onChange={(e) => setAssistantName(e.target.value)}
                    className="text-xs"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2 pt-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Saudação Inicial (Primeiro Contato)</Label>
                    <Textarea
                      rows={4}
                      value={initialMessage}
                      onChange={(e) => setInitialMessage(e.target.value)}
                      className="text-xs leading-relaxed"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Mensagem de Transferência Humana</Label>
                    <Textarea
                      rows={4}
                      value={handoffMessage}
                      onChange={(e) => setHandoffMessage(e.target.value)}
                      className="text-xs leading-relaxed"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── TAB 3: NÚMEROS DE TESTE DEV ─── */}
          <TabsContent value="test_environment" className="space-y-6 pt-2">
            <Card variant="subtle" className="rounded-xl border-border/80">
              <CardHeader>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Phone className="size-4 text-sky-500" />
                  Números de Teste de Desenvolvedor & QA
                </CardTitle>
                <CardDescription className="text-xs">
                  Cadastre números para testar o bot sem contaminar métricas de conversão reais nem enviar leads de teste para corretores.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <form onSubmit={handleAddTestNumber} className="flex flex-col sm:flex-row gap-3">
                  <Input
                    placeholder="Telefone (ex: +5571999999999)"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="sm:w-64 text-xs"
                  />
                  <Input
                    placeholder="Identificação (ex: Celular Dev Vinicios)"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    className="flex-1 text-xs"
                  />
                  <Button type="submit" size="sm" className="gap-1.5 text-xs font-semibold">
                    <Plus className="size-3.5" /> Cadastrar Número
                  </Button>
                </form>

                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Números Autorizados ({testNumbers.length})
                  </h4>
                  {testNumbers.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">Nenhum número de teste cadastrado.</p>
                  ) : (
                    <div className="divide-y border rounded-xl overflow-hidden bg-card">
                      {testNumbers.map((t) => (
                        <div key={t.id} className="flex items-center justify-between p-3 text-xs">
                          <div>
                            <p className="font-semibold text-foreground">{t.label}</p>
                            <p className="font-mono text-muted-foreground text-[11px]">{t.phoneNumber}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px]">
                              Isolado de Métricas
                            </Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveTestNumber(t.id)}
                              className="size-7 text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── TAB 4: SIMULADOR WEB (CONTEXTO IA) ─── */}
          <TabsContent value="simulator" className="space-y-6 pt-2">
            <div className="grid gap-6 lg:grid-cols-12">
              <Card variant="subtle" className="lg:col-span-7 flex flex-col h-[530px] rounded-xl border-border/80 overflow-hidden">
                <CardHeader className="border-b pb-3 bg-muted/20 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <MessageSquare className="size-4 text-primary" />
                    Simulador de WhatsApp (IA com Contexto)
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRestartSimulator}
                    className="gap-1.5 text-xs h-7 px-2.5"
                  >
                    <RefreshCw className="size-3" /> Reiniciar Conversa
                  </Button>
                </CardHeader>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-card">
                  {simMessages.map((m, idx) => (
                    <div
                      key={idx}
                      className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
                          m.sender === "user"
                            ? "bg-primary text-primary-foreground font-medium"
                            : "bg-muted/80 border border-border/60 text-foreground"
                        }`}
                      >
                        {m.text}
                      </div>
                    </div>
                  ))}
                  {simIsLoading && (
                    <div className="flex justify-start">
                      <div className="bg-muted/80 border border-border/60 rounded-2xl px-4 py-3 flex items-center gap-1.5">
                        <span className="size-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:0ms]" />
                        <span className="size-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:150ms]" />
                        <span className="size-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:300ms]" />
                      </div>
                    </div>
                  )}
                </div>
                <form onSubmit={handleSimSendMessage} className="border-t p-3 flex gap-2 bg-card">
                  <Input
                    placeholder={simIsLoading ? "IA processando..." : "Converse naturalmente com a IA..."}
                    value={simInput}
                    onChange={(e) => setSimInput(e.target.value)}
                    disabled={simIsLoading}
                    className="text-xs"
                  />
                  <Button type="submit" size="sm" disabled={simIsLoading} className="gap-1.5 text-xs font-semibold">
                    <Send className="size-3.5" /> {simIsLoading ? "..." : "Enviar"}
                  </Button>
                </form>
              </Card>

              <Card variant="subtle" className="lg:col-span-5 h-[530px] rounded-xl border-border/80 overflow-y-auto">
                <CardHeader className="border-b pb-3 bg-muted/20">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Bot className="size-4 text-primary" />
                    Inspetor de Estado & Diagnóstico
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-4 text-xs">
                  <div>
                    <span className="font-semibold text-muted-foreground uppercase text-[10px]">
                      Etapa do Fluxo (IA Contextual)
                    </span>
                    <p className="font-medium text-foreground mt-0.5">{activeStepTitle}</p>
                  </div>

                  <div>
                    <span className="font-semibold text-muted-foreground uppercase text-[10px]">
                      Memória Estruturada
                    </span>
                    <div className="mt-1 rounded-lg border border-border/60 bg-muted/30 p-2.5 font-mono text-[11px] space-y-1">
                      {collectedCount === 0 ? (
                        <p className="text-muted-foreground italic">Nenhum dado coletado ainda.</p>
                      ) : (
                        Object.entries(simMemory).map(([k, v]) => (
                          <p key={k}>
                            <span className="text-primary font-semibold">{k}</span>: &quot;{v}&quot;
                          </p>
                        ))
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="font-semibold text-muted-foreground uppercase text-[10px]">
                      Score da Qualificação
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={currentScore >= 70 ? "success" : currentScore >= 40 ? "secondary" : "outline"}>
                        {currentScore} pontos ({currentScore >= 70 ? "Lead Quente" : currentScore >= 40 ? "Morno" : "Início"})
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ─── TAB 5: RESET DE MEMÓRIA ─── */}
          <TabsContent value="memory_reset" className="space-y-6 pt-2">
            <Card variant="subtle" className="rounded-xl border-border/80 max-w-2xl">
              <CardHeader>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <RotateCcw className="size-4 text-destructive" />
                  Reset Administrativo da Memória da IA
                </CardTitle>
                <CardDescription className="text-xs">
                  Reinicie a qualificação de um lead sem apagar o histórico de auditoria nem o cadastro comercial.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <form onSubmit={handleResetMemory} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">ID do Lead</Label>
                    <Input
                      placeholder="ID do lead"
                      value={resetLeadId}
                      onChange={(e) => setResetLeadId(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Motivo do Reset</Label>
                    <Input
                      placeholder="Ex: Reinício para teste dev"
                      value={resetReason}
                      onChange={(e) => setResetReason(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                  <Button type="submit" variant="destructive" size="sm" className="gap-1.5 text-xs font-semibold">
                    <RotateCcw className="size-3.5" /> Executar Reset da Memória
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
