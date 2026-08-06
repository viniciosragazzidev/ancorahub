"use client";

import { useState } from "react";
import {
  Sparkles,
  Power,
  Phone,
  RotateCcw,
  SlidersHorizontal,
  Plus,
  Trash2,
  CheckCircle2,
  MessageSquare,
  Bot,
  Send,
} from "lucide-react";

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

export function QualificationHubClient({ settings, testNumbers: initialTestNumbers }: QualificationHubProps) {
  const [enabled, setEnabled] = useState(settings?.enabled ?? false);
  const [pauseMode, setPauseMode] = useState(settings?.pauseMode ?? "handoff_active");
  const [assistantName, setAssistantName] = useState(settings?.assistantName ?? "Assistente Âncora Corretora");
  const [initialMessage, setInitialMessage] = useState(
    settings?.initialMessage ??
      "Olá! Sou o assistente virtual da Âncora Corretora. Vou fazer algumas perguntas rápidas para preparar seu atendimento."
  );
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Test numbers state
  const [testNumbers, setTestNumbers] = useState(initialTestNumbers);
  const [newPhone, setNewPhone] = useState("");
  const [newLabel, setNewLabel] = useState("");

  // Memory reset state
  const [resetLeadId, setResetLeadId] = useState("");
  const [resetReason, setResetReason] = useState("");
  const [resetStatus, setResetStatus] = useState<string | null>(null);

  // Web Simulator state
  const [simMessages, setSimMessages] = useState<Array<{ sender: "user" | "bot"; text: string }>>([
    { sender: "bot", text: initialMessage },
  ]);
  const [simInput, setSimInput] = useState("");

  const handleSaveSettings = async () => {
    setIsSaving(true);
    setFeedback(null);
    try {
      await updateQualificationSettingsAction({
        enabled,
        pauseMode: pauseMode as "finish_active" | "handoff_active" | "pause_immediately",
        assistantName,
        initialMessage,
        handoffMessage: settings?.handoffMessage ?? "Vou encaminhar você para um corretor da equipe agora.",
        outOfHoursMessage: settings?.outOfHoursMessage ?? "Fora do horário",
        absenceMessage: settings?.absenceMessage ?? "Sem corretores",
        tone: settings?.tone ?? "friendly",
        useEmojis: settings?.useEmojis ?? false,
        timeoutMinutes: settings?.timeoutMinutes ?? 30,
      });
      setFeedback("Configurações salvas com sucesso.");
    } catch (err) {
      setFeedback("Erro ao salvar configurações.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddTestNumber = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPhone || !newLabel) return;
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
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveTestNumber = async (id: string) => {
    try {
      await removeTestNumberAction(id);
      setTestNumbers((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const handleResetMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetLeadId || !resetReason) return;
    try {
      await resetMemoryAction({
        leadId: resetLeadId,
        scope: "full_reset",
        reason: resetReason,
        preserveLeadRecord: true,
        preserveCommercialProfile: true,
      });
      setResetStatus("Memória da IA reiniciada com sucesso para o lead.");
      setResetLeadId("");
      setResetReason("");
    } catch (err) {
      setResetStatus("Erro ao reiniciar memória do lead.");
    }
  };

  const handleSimSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!simInput.trim()) return;
    const text = simInput.trim();
    setSimMessages((prev) => [...prev, { sender: "user", text }]);
    setSimInput("");

    setTimeout(() => {
      setSimMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: "Entendido! Em qual cidade você pretende contratar o plano?",
        },
      ]);
    }, 600);
  };

  return (
    <div className="space-y-6">
      {/* Header com Status em Tempo Real */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border/80 bg-card p-5 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Bot className="size-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                Central de Qualificação por IA
              </h1>
              <Badge variant={enabled ? "success" : "secondary"}>
                {enabled ? "● IA Ativa" : "Pausada"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Controle, teste, ative, pause e edite todo o comportamento do robô de atendimento do tenant.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-1.5 text-xs">
            <Power className="size-4 text-muted-foreground" />
            <span className="font-medium">Qualificação por IA</span>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="size-4 rounded accent-primary cursor-pointer"
            />
          </div>
          <Button onClick={handleSaveSettings} disabled={isSaving} size="sm" className="gap-2">
            <Sparkles className="size-4" />
            {isSaving ? "Salvando..." : "Salvar Configuração"}
          </Button>
        </div>
      </div>

      {feedback && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/10 p-3 text-xs text-primary font-medium">
          <CheckCircle2 className="size-4" />
          {feedback}
        </div>
      )}

      {/* Navegação por Abas da Central */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto border-b border-border/60 bg-transparent p-0">
          <TabsTrigger value="overview" className="gap-2 text-xs font-semibold">
            <SlidersHorizontal className="size-3.5" />
            Visão Geral & Ativação
          </TabsTrigger>
          <TabsTrigger value="test_environment" className="gap-2 text-xs font-semibold">
            <Phone className="size-3.5" />
            Números de Teste Dev
          </TabsTrigger>
          <TabsTrigger value="simulator" className="gap-2 text-xs font-semibold">
            <MessageSquare className="size-3.5" />
            Simulador Web
          </TabsTrigger>
          <TabsTrigger value="memory_reset" className="gap-2 text-xs font-semibold">
            <RotateCcw className="size-3.5" />
            Reset de Memória
          </TabsTrigger>
        </TabsList>

        {/* ─── ABA 1: VISÃO GERAL & ATIVAÇÃO ─── */}
        <TabsContent value="overview" className="space-y-6 pt-4">
          <div className="grid gap-6 md:grid-cols-2">
            <Card variant="subtle">
              <CardHeader>
                <CardTitle className="text-base font-bold">Modo de Pausa da IA</CardTitle>
                <CardDescription>
                  O que deve acontecer com as conversas em andamento quando a qualificação for desativada?
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select value={pauseMode} onValueChange={(val) => setPauseMode(val ?? "handoff_active")}>
                  <SelectTrigger className="w-full text-xs">
                    <SelectValue placeholder="Selecione o modo de pausa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="handoff_active" className="text-xs">
                      Pausar e transferir conversas ativas para humanos
                    </SelectItem>
                    <SelectItem value="finish_active" className="text-xs">
                      Concluir conversas atuais e não iniciar novas
                    </SelectItem>
                    <SelectItem value="pause_immediately" className="text-xs">
                      Pausar imediatamente sem transferir
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  O backend valida essa flag antes de cada mensagem no WhatsApp. Nenhuma IA responde quando desativado.
                </p>
              </CardContent>
            </Card>

            <Card variant="subtle">
              <CardHeader>
                <CardTitle className="text-base font-bold">Identidade & Mensagem Inicial</CardTitle>
                <CardDescription>Nome do assistente e saudação enviada ao lead.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Nome do Assistente Virtual</Label>
                  <Input value={assistantName} onChange={(e) => setAssistantName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Saudação Inicial no WhatsApp</Label>
                  <Textarea
                    rows={3}
                    value={initialMessage}
                    onChange={(e) => setInitialMessage(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── ABA 2: NÚMEROS DE TESTE DEV ─── */}
        <TabsContent value="test_environment" className="space-y-6 pt-4">
          <Card variant="subtle">
            <CardHeader>
              <CardTitle className="text-base font-bold">Cadastro de Números de Teste Autorizados</CardTitle>
              <CardDescription>
                Números cadastrados aqui possuem isolamento total: não afetam métricas comerciais reais, não distribuem para a fila de corretores e aceitam comandos administrativos (`/reset`, `/status`, `/restart`).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form onSubmit={handleAddTestNumber} className="flex flex-col sm:flex-row gap-3">
                <Input
                  placeholder="Número (ex: +5571999999999)"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="sm:w-64"
                />
                <Input
                  placeholder="Identificação (ex: Celular do Dev Vinicios)"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  className="flex-1"
                />
                <Button type="submit" className="gap-2">
                  <Plus className="size-4" /> Cadastrar Número
                </Button>
              </form>

              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Números Autorizados ({testNumbers.length})
                </h4>
                {testNumbers.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum número de teste cadastrado.</p>
                ) : (
                  <div className="divide-y border rounded-lg">
                    {testNumbers.map((t) => (
                      <div key={t.id} className="flex items-center justify-between p-3 text-xs">
                        <div>
                          <p className="font-semibold text-foreground">{t.label}</p>
                          <p className="font-mono text-muted-foreground">{t.phoneNumber}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">Isolado de Métricas</Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveTestNumber(t.id)}
                            className="text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="size-4" />
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

        {/* ─── ABA 3: SIMULADOR WEB ─── */}
        <TabsContent value="simulator" className="space-y-6 pt-4">
          <div className="grid gap-6 lg:grid-cols-12">
            <Card variant="subtle" className="lg:col-span-7 flex flex-col h-[500px]">
              <CardHeader className="border-b pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <MessageSquare className="size-4 text-primary" />
                  Simulador de Atendimento WhatsApp
                </CardTitle>
              </CardHeader>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {simMessages.map((m, idx) => (
                  <div
                    key={idx}
                    className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed ${
                        m.sender === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted border border-border/60 text-foreground"
                      }`}
                    >
                      {m.text}
                    </div>
                  </div>
                ))}
              </div>
              <form onSubmit={handleSimSendMessage} className="border-t p-3 flex gap-2">
                <Input
                  placeholder="Digite como se fosse um cliente..."
                  value={simInput}
                  onChange={(e) => setSimInput(e.target.value)}
                  className="text-xs"
                />
                <Button type="submit" size="sm" className="gap-1.5">
                  <Send className="size-3.5" /> Enviar
                </Button>
              </form>
            </Card>

            <Card variant="subtle" className="lg:col-span-5 h-[500px] overflow-y-auto">
              <CardHeader className="border-b pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Bot className="size-4 text-primary" />
                  Inspetor de Estado & Memória
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-4 text-xs">
                <div>
                  <span className="font-semibold text-muted-foreground uppercase text-[10px]">
                    Etapa Atual
                  </span>
                  <p className="font-medium text-foreground">1. Coletar Cidade de Atendimento</p>
                </div>

                <div>
                  <span className="font-semibold text-muted-foreground uppercase text-[10px]">
                    Dados Coletados
                  </span>
                  <div className="mt-1 rounded bg-muted/40 p-2 font-mono text-[11px] space-y-1">
                    <p>plano: &quot;individual&quot;</p>
                    <p>pessoas: &quot;1&quot;</p>
                    <p>cidade: &quot;Salvador&quot;</p>
                  </div>
                </div>

                <div>
                  <span className="font-semibold text-muted-foreground uppercase text-[10px]">
                    Score Calculado
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="success">85 pontos (Quente)</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── ABA 4: RESET DE MEMÓRIA ─── */}
        <TabsContent value="memory_reset" className="space-y-6 pt-4">
          <Card variant="subtle">
            <CardHeader>
              <CardTitle className="text-base font-bold">Reset Administrativo de Memória</CardTitle>
              <CardDescription>
                Reinicie a sessão da IA de um lead específico sem apagar o cadastro do cliente nem a auditoria imutável do sistema.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleResetMemory} className="space-y-4 max-w-md">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">ID do Lead</Label>
                  <Input
                    placeholder="ID do lead a ser resetado"
                    value={resetLeadId}
                    onChange={(e) => setResetLeadId(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Motivo do Reset</Label>
                  <Input
                    placeholder="Ex: Reset de teste durante atendimento dev"
                    value={resetReason}
                    onChange={(e) => setResetReason(e.target.value)}
                  />
                </div>
                <Button type="submit" variant="destructive" className="gap-2">
                  <RotateCcw className="size-4" /> Resetar Memória da IA
                </Button>
              </form>

              {resetStatus && (
                <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/10 p-3 text-xs text-primary font-medium">
                  <CheckCircle2 className="size-4" />
                  {resetStatus}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
