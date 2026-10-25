"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { consultarCotacaoExpress } from "@/features/tenant-intelligence/rag/cotacao-express-actions";
import {
  Sparkle,
  Robot,
  User,
  PaperPlaneRight,
  Lightning,
  Calculator,
  Users,
  ChartBar,
  ShieldCheck,
  Clock,
  CheckCircle,
  WarningCircle,
  CaretRight,
  Code,
  Copy,
  Trash,
  Gear,
  ArrowClockwise,
  MagnifyingGlass,
  FileText,
  Check,
  List,
  SlidersHorizontal,
  X,
  Database,
  Cpu,
  ArrowSquareOut,
  Funnel,
  CaretDown,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AppSelect } from "@/components/ui/select";
import { CopyCheckIcon } from "@/components/motion/copy-check-icon";
import { MOCK_LEAD_CONTEXTS, PRESET_COMMAND_DATA, matchPresetCommand, mockAssistantReply, type ChatMessage } from "./assistente-model";

// -----------------------------------------------------------------------------
// TYPES & INTERFACES
// -----------------------------------------------------------------------------
export type { ChatMessage, McpToolCall } from "./assistente-model";

export interface PresetCommand {
  command: string;
  label: string;
  description: string;
  icon: typeof Calculator;
  prompt: string;
  mcpTool: string;
}

// -----------------------------------------------------------------------------
// PRESET SLASH COMMANDS
// -----------------------------------------------------------------------------
const PRESET_ICONS: Record<string, typeof Calculator> = {
  "/cotacao-express": Calculator,
  "/lead-resumo": User,
  "/distribuir-plantao": Clock,
  "/metricas-filial": ChartBar,
  "/cadencia-waha": Lightning,
  "/auditoria-lgpd": ShieldCheck,
};

const PRESET_COMMANDS: PresetCommand[] = PRESET_COMMAND_DATA.map((data) => ({ ...data, icon: PRESET_ICONS[data.command]! }));

// -----------------------------------------------------------------------------
// MOCK LEADS FOR CONTEXT SELECTOR
// -----------------------------------------------------------------------------
// MOCK_LEAD_CONTEXTS vem do modelo compartilhado.

interface AssistenteChatClientProps {
  tenantId: string;
  userId: string;
  userName?: string;
  userRole: string;
}

export function AssistenteChatClient({ tenantId, userId, userName, userRole }: AssistenteChatClientProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState("lead_carlos_01");
  const [isTyping, setIsTyping] = useState(false);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [showSidePanel, setShowSidePanel] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll ao receber nova mensagem
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Fechar menu slash quando clicar fora
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    if (val.startsWith("/")) {
      setShowSlashMenu(true);
    } else {
      setShowSlashMenu(false);
    }
  };

  const handleSelectCommand = (cmd: PresetCommand) => {
    setInputValue(cmd.prompt);
    setShowSlashMenu(false);
    if (inputRef.current) inputRef.current.focus();
  };

  // Simulação interativa de execução de ferramenta MCP e resposta da IA
  const handleSendMessage = (customPrompt?: string) => {
    const textToSend = (customPrompt || inputValue).trim();
    if (!textToSend || isTyping) return;

    const userMsgId = `msg_user_${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      sender: "user",
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setShowSlashMenu(false);
    setIsTyping(true);

    // Identificar ferramenta MCP correspondente ao prompt
    const matchedCmd = matchPresetCommand(textToSend);

    // Cotação Express consulta o material de operadora no servidor (RAG), sem valores fixos.
    if (matchedCmd?.command === "/cotacao-express") {
      const assistantMsgId = `msg_ai_${Date.now()}`;
      const appendAssistant = (content: string) =>
        setMessages((prev) => [
          ...prev,
          {
            id: assistantMsgId,
            sender: "assistant",
            content,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);

      consultarCotacaoExpress(textToSend)
        .then((result) => {
          if (result.status === "answered") {
            appendAssistant(result.answer);
          } else {
            appendAssistant(result.message);
          }
        })
        .catch(() => appendAssistant("Não foi possível consultar a cotação agora. Tente novamente em instantes."))
        .finally(() => setIsTyping(false));
      return;
    }

    setTimeout(() => {
      const assistantMsgId = `msg_ai_${Date.now()}`;

      const reply = mockAssistantReply(matchedCmd?.command, textToSend, selectedLeadId);
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMsgId,
          sender: "assistant",
          content: reply.content,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          mcpToolCall: reply.mcpToolCall,
        },
      ]);

      setIsTyping(false);
    }, 900);
  };

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleClearChat = () => {
    setMessages([]);
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background text-foreground">
      {/* ----------------------------------------------------------------------------- */}
      {/* HEADER BAR (AIDA: ATTENTION) */}
      {/* ----------------------------------------------------------------------------- */}
      <header className="sticky top-0 z-20 flex h-14 w-full items-center justify-between border-b border-border/60 bg-background/80 px-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/10 text-sky-500 ring-1 ring-sky-500/20">
            <Sparkle size={20} weight="fill" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold tracking-tight">Âncora CRM Copilot</h1>
              <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                MCP Online
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">Assistente comercial inteligente com acesso às ferramentas de dados via MCP</p>
          </div>
        </div>

        {/* CONTROLES SUPERIORES */}
        <div className="flex items-center gap-2">
            {/* Seletor de Contexto do Lead */}
            <AppSelect
              aria-label="Contexto do lead"
              className="hidden w-48 md:block"
              onValueChange={setSelectedLeadId}
              options={MOCK_LEAD_CONTEXTS.map((context) => ({ value: context.id, label: context.name }))}
              size="sm"
              triggerClassName="h-8 rounded-lg bg-card px-2.5 text-xs font-medium"
              value={selectedLeadId}
            />

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8 active:scale-[0.95] transition-transform duration-100" onClick={handleClearChat}><Trash size={16} /></Button>} />
                <TooltipContent>Limpar histórico da conversa</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs font-medium active:scale-[0.97] transition-all duration-100"
              onClick={() => setShowSidePanel(!showSidePanel)}
            >
            <SlidersHorizontal size={14} />
            <span className="hidden sm:inline">{showSidePanel ? "Ocultar Painel MCP" : "Painel MCP"}</span>
          </Button>
        </div>
      </header>

      {/* ----------------------------------------------------------------------------- */}
      {/* CORPO PRINCIPAL (CHAT FEED + SIDE INSPECTOR) */}
      {/* ----------------------------------------------------------------------------- */}
      <div className="flex flex-1 overflow-hidden">
        {/* CHAT FEED CONTAINER */}
        <div className="relative flex flex-1 flex-col justify-between overflow-hidden">
          <ScrollArea className="flex-1 min-h-0" id="chat-messages-scroll-area">
            <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto w-full">
            {messages.length === 0 ? (
              /* ESTADO INICIAL / WELCOME HERO (AIDA: INTEREST) */
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="mx-auto max-w-3xl py-8 text-center space-y-6"
              >
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-b from-sky-500/20 to-sky-600/5 ring-1 ring-sky-500/30">
                  <Robot size={36} className="text-sky-500" weight="duotone" />
                </div>

                <div className="space-y-2">
                  <h2 className="text-xl font-bold tracking-tight md:text-2xl">
                    Como posso ajudar na operação da Âncora Saúde hoje?
                  </h2>
                  <p className="mx-auto max-w-lg text-xs text-muted-foreground leading-relaxed">
                    O Copilot está conectado ao **MCP Server** do Âncora CRM. Você pode emitir comandos em linguagem natural ou utilizar atalhos para cotações, auditoria de SLA e gestão de leads.
                  </p>
                </div>

                {/* GRID DE COMANDOS RÁPIDOS */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 text-left pt-4">
                  {PRESET_COMMANDS.map((cmd) => {
                    const IconComp = cmd.icon;
                    return (
                      <Button
                        key={cmd.command}
                        onClick={() => handleSelectCommand(cmd)}
                        className="group h-auto flex-col items-start justify-between p-3.5 text-left hover:border-primary/40 hover:bg-primary/5"
                        variant="outline"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:bg-sky-500/10 group-hover:text-sky-500">
                            <IconComp size={18} />
                          </div>
                          <span className="font-mono text-[10px] text-muted-foreground group-hover:text-sky-500">{cmd.command}</span>
                        </div>
                        <div className="mt-3">
                          <h3 className="text-xs font-semibold text-foreground group-hover:text-sky-500">{cmd.label}</h3>
                          <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2">{cmd.description}</p>
                        </div>
                      </Button>
                    );
                  })}
                </div>
              </motion.div>
            ) : (
              /* LISTA DE MENSAGENS DO CHAT */
              <div className="mx-auto max-w-3xl space-y-6">
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className={`flex gap-3 ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {msg.sender === "assistant" && (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-500 ring-1 ring-sky-500/20">
                        <Sparkle size={18} weight="fill" />
                      </div>
                    )}

                    <div className={`space-y-3 max-w-[85%] ${msg.sender === "user" ? "items-end text-right" : "items-start"}`}>
                      {/* CARTÃO DE EXECUÇÃO DE FERRAMENTA MCP (SE HOUVER) */}
                      {msg.mcpToolCall && (
                        <div className="rounded-xl border border-sky-500/20 bg-sky-950/20 p-3 text-left shadow-sm backdrop-blur-sm">
                          <div className="flex items-center justify-between border-b border-sky-500/15 pb-2 mb-2.5">
                            <div className="flex items-center gap-2">
                              <Cpu size={15} className="text-sky-400" />
                              <span className="font-mono text-xs font-semibold text-sky-400">{msg.mcpToolCall.displayName}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[10px] text-muted-foreground">{msg.mcpToolCall.executionTimeMs}ms</span>
                              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[9.5px]">
                                <Check size={10} className="mr-1" /> Executado via MCP
                              </Badge>
                            </div>
                          </div>

                          {/* ARGUMENTOS DA FERRAMENTA */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                              <span>Parâmetros de Entrada:</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 text-muted-foreground hover:text-foreground"
                                onClick={() => handleCopyText(JSON.stringify(msg.mcpToolCall?.args, null, 2), msg.id)}
                              >
                                <CopyCheckIcon copied={copiedId === msg.id} className="relative inline-flex size-3 items-center justify-center"><Copy size={12} /></CopyCheckIcon>
                              </Button>
                            </div>
                            <pre className="overflow-x-auto rounded-md bg-black/40 p-2 font-mono text-[10.5px] text-sky-200/90 border border-white/5">
                              {JSON.stringify(msg.mcpToolCall.args, null, 2)}
                            </pre>
                          </div>

                          {/* RESULTADO FORMATADO */}
                          {msg.mcpToolCall.result && (
                            <div className="mt-3 space-y-1.5 border-t border-sky-500/15 pt-2.5">
                              <span className="text-[10px] font-medium text-muted-foreground">Retorno em Tempo Real do Banco CRM:</span>
                              <div className="grid grid-cols-1 gap-1.5 text-xs text-foreground">
                                {Object.entries(msg.mcpToolCall.result).map(([key, val]) => (
                                  <div key={key} className="flex justify-between items-center bg-background/50 px-2.5 py-1.5 rounded border border-border/40">
                                    <span className="font-mono text-[11px] text-muted-foreground capitalize">{key.replace(/_/g, " ")}:</span>
                                    <span className="font-medium text-sky-300 text-right">{typeof val === "object" ? JSON.stringify(val) : String(val)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* CONTEÚDO PRINCIPAL DA MENSAGEM */}
                      <div
                        className={`rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                          msg.sender === "user"
                            ? "bg-sky-600 text-white rounded-br-none font-medium shadow-sm"
                            : "bg-card border border-border text-foreground rounded-bl-none shadow-sm"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>

                      <span className="text-[10px] text-muted-foreground px-1">{msg.timestamp}</span>
                    </div>

                    {msg.sender === "user" && (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <User size={18} />
                      </div>
                    )}
                  </motion.div>
                ))}

                {/* INDICADOR DE TYPING DA IA */}
                {isTyping && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3 items-center text-xs text-muted-foreground">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10 text-sky-500 ring-1 ring-sky-500/20">
                      <Sparkle size={18} className="animate-spin" />
                    </div>
                    <div className="flex items-center gap-1.5 bg-card border border-border px-3 py-2 rounded-2xl">
                      <span className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-bounce"></span>
                      <span className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-bounce [animation-delay:0.2s]"></span>
                      <span className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-bounce [animation-delay:0.4s]"></span>
                      <span className="ml-1 text-[11px] font-mono text-sky-500">Executando ferramenta MCP...</span>
                    </div>
                  </motion.div>
                )}

                <div ref={chatEndRef} />
              </div>
            )}
          </div>
        </ScrollArea>

          {/* ----------------------------------------------------------------------------- */}
          {/* DOCK DE ENTRADA / INPUT BAR */}
          {/* ----------------------------------------------------------------------------- */}
          <div className="relative border-t border-border/60 bg-background/90 p-4 backdrop-blur-md">
            <div className="mx-auto max-w-3xl space-y-2">
              {/* MENU SUSPENSO DE COMANDOS SLASH ( / ) */}
              <AnimatePresence>
                {showSlashMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute bottom-full left-4 right-4 mb-2 z-30"
                  >
                    <ScrollArea className="max-h-60 rounded-xl border border-border bg-card shadow-lg">
                      <div className="p-1.5">
                        <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                          Comandos de Atalho MCP
                        </div>
                        {PRESET_COMMANDS.map((cmd) => (
                          <Button
                            key={cmd.command}
                            onClick={() => handleSelectCommand(cmd)}
                            className="h-auto w-full justify-between px-2.5 py-2 text-left text-xs"
                            variant="ghost"
                          >
                            <div className="flex items-center gap-2">
                              <cmd.icon size={16} className="text-sky-500" />
                              <span className="font-semibold text-foreground">{cmd.label}</span>
                              <span className="text-[11px] text-muted-foreground">{cmd.description}</span>
                            </div>
                            <span className="font-mono text-[10px] text-muted-foreground">{cmd.command}</span>
                          </Button>
                        ))}
                      </div>
                    </ScrollArea>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* CHIPS DE ATALHO RÁPIDO ABAIXO DA ENTRADA */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                <span className="text-[10px] font-medium text-muted-foreground uppercase shrink-0">Atalhos:</span>
                {PRESET_COMMANDS.slice(0, 4).map((cmd) => (
                  <Button
                    key={cmd.command}
                    onClick={() => handleSelectCommand(cmd)}
                    className="h-6 shrink-0 rounded-full px-2.5 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-primary"
                    size="xs"
                    variant="outline"
                  >
                    {cmd.label}
                  </Button>
                ))}
              </div>

              {/* CAMPO DE TEXTO DA MENSAGEM */}
              <div className="relative flex items-center">
                <Input
                  ref={inputRef}
                  value={inputValue}
                  onChange={handleInputChange}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Digite sua instrução ou aperte '/' para comandos MCP..."
                  className="h-11 rounded-xl border-border bg-card pr-12 text-xs shadow-sm focus-visible:ring-sky-500"
                />
                <Button
                  size="icon"
                  onClick={() => handleSendMessage()}
                  disabled={!inputValue.trim() || isTyping}
                  className="absolute right-1.5 h-8 w-8 rounded-lg bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-40 active:scale-[0.95] active:translate-y-[0.5px] transition-all duration-100"
                >
                  <PaperPlaneRight size={16} weight="fill" />
                </Button>
              </div>

              <div className="flex justify-between items-center text-[10px] text-muted-foreground px-1">
                <span>Pressione <kbd className="rounded border bg-muted px-1">Enter</kbd> para enviar, <kbd className="rounded border bg-muted px-1">/</kbd> para comandos</span>
                <span className="flex items-center gap-1"><ShieldCheck size={12} className="text-emerald-500" /> Multi-Tenant RLS Ativo</span>
              </div>
            </div>
          </div>
        </div>

        {/* ----------------------------------------------------------------------------- */}
        {/* PAINEL LATERAL DIREITO — MCP TOOLS & INSPECTOR (AIDA: DESIRE & ACTION) */}
        {/* ----------------------------------------------------------------------------- */}
        <AnimatePresence>
          {showSidePanel && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="hidden lg:flex h-full flex-col border-l border-border/60 bg-card/50 backdrop-blur-sm overflow-hidden"
            >
              <ScrollArea className="flex-1 h-full" id="mcp-inspector-scroll-area">
                <div className="flex flex-col min-h-full justify-between gap-6 p-4">
                  <div className="space-y-6">
                    {/* CABEÇALHO DO PAINEL */}
                    <div className="flex items-center justify-between border-b border-border/60 pb-3">
                       <div className="flex items-center gap-2">
                         <Database size={18} className="text-sky-500" />
                         <h3 className="text-xs font-semibold">Ferramentas MCP Ativas</h3>
                       </div>
                       <Badge variant="outline" className="text-[9.5px]">8 Online</Badge>
                    </div>

                    {/* LISTA DE FERRAMENTAS MCP DISPONÍVEIS */}
                    <div className="space-y-2.5">
                      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Servidor MCP Interno (/lib/mcp)
                      </div>

                      <div className="space-y-2 text-xs">
                        <div className="rounded-lg border border-border/60 bg-background/50 p-2.5 space-y-1">
                          <div className="flex items-center justify-between font-mono text-[11px] font-medium text-sky-400">
                            <span>mcp:quote_calculator</span>
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                          </div>
                          <p className="text-[10.5px] text-muted-foreground">Calcula cotações PME/Adesão com regras de faixa etária e operadoras.</p>
                        </div>

                        <div className="rounded-lg border border-border/60 bg-background/50 p-2.5 space-y-1">
                          <div className="flex items-center justify-between font-mono text-[11px] font-medium text-sky-400">
                            <span>mcp:leads_query</span>
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                          </div>
                          <p className="text-[10.5px] text-muted-foreground">Busca e sintetiza a ficha completa 360º de qualquer lead cadastrado.</p>
                        </div>

                        <div className="rounded-lg border border-border/60 bg-background/50 p-2.5 space-y-1">
                          <div className="flex items-center justify-between font-mono text-[11px] font-medium text-sky-400">
                            <span>mcp:sla_checker</span>
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                          </div>
                          <p className="text-[10.5px] text-muted-foreground">Monitora SLA do plantão e redistribui leads estagnados automaticamente.</p>
                        </div>

                        <div className="rounded-lg border border-border/60 bg-background/50 p-2.5 space-y-1">
                          <div className="flex items-center justify-between font-mono text-[11px] font-medium text-sky-400">
                            <span>mcp:waha_cadence</span>
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                          </div>
                          <p className="text-[10.5px] text-muted-foreground">Agenda réguas de mensagens no WhatsApp via VPS WAHA dedicada.</p>
                        </div>
                      </div>
                    </div>

                    {/* CARD DE CONTEXTO ATIVO DO LEAD */}
                    <div className="space-y-2 border-t border-border/60 pt-4">
                      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Lead em Foco no Atendimento
                      </div>
                      <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-3 space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="text-xs font-bold text-foreground">Carlos Eduardo Silva</h4>
                            <p className="text-[10.5px] text-sky-500 font-medium">Bradesco PME • 4 Vidas</p>
                          </div>
                          <Badge className="bg-sky-500/20 text-sky-400 border-sky-500/30 text-[9px]">Quente</Badge>
                        </div>
                        <div className="text-[10px] text-muted-foreground space-y-1 pt-1 border-t border-border/40">
                          <div className="flex justify-between">
                            <span>Etapa Atual:</span>
                            <strong className="text-foreground">Cotação Enviada</strong>
                          </div>
                          <div className="flex justify-between">
                            <span>Último Contato:</span>
                            <strong className="text-foreground">Há 12 minutos</strong>
                          </div>
                          <div className="flex justify-between">
                            <span>Filial Responsável:</span>
                            <strong className="text-foreground">Filial Jardins</strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* STATUS DE SEGURANÇA E PERFORMANCE */}
                  <div className="rounded-xl border border-border bg-background/50 p-3 space-y-2 text-[10.5px] mt-auto">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Provedor de IA:</span>
                      <span className="font-semibold text-foreground">DeepSeek V3.1 (OpenRouter)</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Latência Média:</span>
                      <span className="font-semibold text-emerald-500">~24 ms</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Multi-tenant RLS:</span>
                      <span className="font-semibold text-emerald-500">Isolado por Corretora</span>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
