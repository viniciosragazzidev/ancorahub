"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
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

// -----------------------------------------------------------------------------
// TYPES & INTERFACES
// -----------------------------------------------------------------------------
export interface McpToolCall {
  id: string;
  toolName: string;
  displayName: string;
  args: Record<string, unknown>;
  status: "running" | "completed" | "error";
  result?: Record<string, unknown>;
  executionTimeMs?: number;
}

export interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  content: string;
  timestamp: string;
  mcpToolCall?: McpToolCall;
}

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
const PRESET_COMMANDS: PresetCommand[] = [
  {
    command: "/cotacao-express",
    label: "Cotação Express",
    description: "Calcula estudo comparativo de planos PME / Adesão",
    icon: Calculator,
    prompt: "Calcule uma cotação comparativa de planos PME para 4 pessoas (42, 38, 12 e 8 anos) entre Bradesco, Amil e SulAmérica.",
    mcpTool: "mcp:quote_calculator",
  },
  {
    command: "/lead-resumo",
    label: "Resumo do Lead",
    description: "Analisa a ficha 360º, qualificação e linha do tempo",
    icon: User,
    prompt: "Gere o resumo completo do lead selecionado, incluindo qualificação por IA, score comercial e recomendação de próxima ação.",
    mcpTool: "mcp:leads_query",
  },
  {
    command: "/distribuir-plantao",
    label: "Auditoria de SLA & Plantão",
    description: "Verifica leads parados e aciona redistribuição",
    icon: Clock,
    prompt: "Verifique os leads estagnados no plantão há mais de 15 minutos sem primeiro contato e execute a redistribuição automática.",
    mcpTool: "mcp:sla_checker",
  },
  {
    command: "/metricas-filial",
    label: "Métricas de Filiais",
    description: "Consulta taxa de conversão e SLA por unidade",
    icon: ChartBar,
    prompt: "Mostre o desempenho comercial e tempo médio de resposta das filiais da Âncora Saúde neste mês.",
    mcpTool: "mcp:get_executive_analytics",
  },
  {
    command: "/cadencia-waha",
    label: "Agendar Cadência WAHA",
    description: "Ativa régua comercial em VPS própria no WhatsApp",
    icon: Lightning,
    prompt: "Programe a cadência automatizada de acompanhamento no WhatsApp via VPS WAHA para o lead de cotação enviada.",
    mcpTool: "mcp:waha_cadence",
  },
  {
    command: "/auditoria-lgpd",
    label: "Auditoria de Acessos",
    description: "Consulta registros imutáveis de documentos e RLS",
    icon: ShieldCheck,
    prompt: "Exiba os últimos registros de auditoria de visualização de documentos de beneficiários para verificação de LGPD.",
    mcpTool: "mcp:audit_logger",
  },
];

// -----------------------------------------------------------------------------
// MOCK LEADS FOR CONTEXT SELECTOR
// -----------------------------------------------------------------------------
const MOCK_LEAD_CONTEXTS = [
  { id: "none", name: "Sem contexto de lead específico", details: "Consulta geral da operação" },
  { id: "lead_carlos_01", name: "Carlos Eduardo Silva", details: "Bradesco PME • 4 Vidas • R$ 3.840/mês" },
  { id: "lead_ana_02", name: "Ana Paula Ribeiro", details: "SulAmérica Adesão • 2 Vidas • R$ 1.950/mês" },
  { id: "lead_empresa_03", name: "TechMed Soluções PME", details: "Amil Saúde PME • 18 Vidas • R$ 14.200/mês" },
];

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
    const matchedCmd = PRESET_COMMANDS.find(
      (c) => textToSend.toLowerCase().includes(c.command) || textToSend.toLowerCase().includes(c.label.toLowerCase())
    );

    setTimeout(() => {
      const assistantMsgId = `msg_ai_${Date.now()}`;

      if (matchedCmd) {
        // Resposta com execução de ferramenta MCP
        let mcpToolCall: McpToolCall;
        let responseContent = "";

        if (matchedCmd.command === "/cotacao-express") {
          mcpToolCall = {
            id: `mcp_${Date.now()}`,
            toolName: "mcp:calculate_quote_options",
            displayName: "mcp:quote_calculator",
            args: {
              ages: [42, 38, 12, 8],
              operators: ["Bradesco Saúde", "Amil", "SulAmérica"],
              plan_type: "PME Flex",
              copay: true,
            },
            status: "completed",
            executionTimeMs: 142,
            result: {
              bradesco: "R$ 3.840,00/mês (Top Nacional)",
              amil: "R$ 3.420,00/mês (S750 Promo)",
              sulamerica: "R$ 3.690,00/mês (Exato Apt)",
              recommended: "Bradesco Saúde (Melhor rede hospitalar regional)",
            },
          };
          responseContent = `Elaborei o estudo comparativo de cotação PME para as 4 vidas informadas. Os valores e opções de operadoras foram consultados em tempo real no banco do Âncora CRM via MCP.`;
        } else if (matchedCmd.command === "/lead-resumo") {
          mcpToolCall = {
            id: `mcp_${Date.now()}`,
            toolName: "mcp:leads_query",
            displayName: "mcp:summarize_lead_profile",
            args: {
              lead_id: selectedLeadId,
              include_timeline: true,
              include_family: true,
              include_conversations: true,
            },
            status: "completed",
            executionTimeMs: 98,
            result: {
              name: "Carlos Eduardo Silva",
              qualification_score: "94/100 (Lead Quente)",
              stage: "Cotação Enviada",
              operator_preference: "Bradesco ou SulAmérica PME",
              family_members: "4 vidas (Titular 42y, Cônjuge 38y, Filhos 12y e 8y)",
              sla_status: "Dentro do prazo (Atendido há 12 min)",
              next_recommended_action: "Agendar ligação de fechamento até quinta-feira 14h",
            },
          };
          responseContent = `Aqui está a ficha sintetizada 360º do lead **Carlos Eduardo Silva**. A IA pré-qualificou a família com alta intenção de fechamento no segmento PME.`;
        } else if (matchedCmd.command === "/distribuir-plantao") {
          mcpToolCall = {
            id: `mcp_${Date.now()}`,
            toolName: "mcp:sla_checker",
            displayName: "mcp:audit_and_reassign_duty",
            args: {
              max_unattended_minutes: 15,
              branch_filter: "Filial Jardins",
              auto_reassign: true,
            },
            status: "completed",
            executionTimeMs: 215,
            result: {
              audited_leads: 18,
              stale_leads_found: 2,
              reassigned_brokers: [
                { lead: "Lead #8942 (Marcos)", from: "Corretor A (Ausente)", to: "Corretor B (Em Plantão)" },
                { lead: "Lead #8945 (Juliana)", from: "Fila Geral", to: "Corretora C (Em Plantão)" },
              ],
              status: "Fila de atendimento 100% normalizada",
            },
          };
          responseContent = `Concluí a auditoria de SLA no plantão da **Filial Jardins**. 2 leads que aguardavam há mais de 15 minutos foram redistribuídos automaticamente via MCP para corretores ativos.`;
        } else if (matchedCmd.command === "/metricas-filial") {
          mcpToolCall = {
            id: `mcp_${Date.now()}`,
            toolName: "mcp:get_executive_analytics",
            displayName: "mcp:branch_performance_analytics",
            args: {
              period: "2026-08",
              metrics: ["conversion_rate", "response_time_seconds", "top_operator"],
            },
            status: "completed",
            executionTimeMs: 180,
            result: {
              matriz_sp: { conversion: "34.2%", avg_response: "1m 45s", top: "Bradesco" },
              filial_jardins: { conversion: "38.6%", avg_response: "58s", top: "SulAmérica" },
              filial_campinas: { conversion: "29.8%", avg_response: "2m 10s", top: "Amil" },
            },
          };
          responseContent = `Consultei as métricas executivas consolidadas de vendas e tempo de resposta das filiais da **Âncora Saúde** no mês atual.`;
        } else if (matchedCmd.command === "/cadencia-waha") {
          mcpToolCall = {
            id: `mcp_${Date.now()}`,
            toolName: "mcp:waha_cadence",
            displayName: "mcp:schedule_whatsapp_cadence",
            args: {
              lead_id: selectedLeadId,
              cadence_template: "pos_cotacao_pme_v1",
              vps_engine: "waha_node_01 (R$ 77,99/mês)",
              business_hours_only: true,
            },
            status: "completed",
            executionTimeMs: 165,
            result: {
              scheduled_steps: [
                { step: 1, delay: "+24h", text: "Envio de resumo com opção de agendamento" },
                { step: 2, delay: "+48h", text: "Material explicativo sobre rede credenciada" },
                { step: 3, delay: "+72h", text: "Alerta de vigência da tabela promocional" },
              ],
              auto_stop_condition: "Qualquer resposta do cliente pausa a cadência imediatamente",
            },
          };
          responseContent = `Programada a cadência comercial de 3 etapas no WhatsApp via motor WAHA em nossa VPS dedicada. Se o cliente responder, a automação para e avisa o corretor.`;
        } else {
          mcpToolCall = {
            id: `mcp_${Date.now()}`,
            toolName: "mcp:audit_logger",
            displayName: "mcp:query_security_audit_logs",
            args: {
              resource: "beneficiary_documents",
              limit: 5,
              tenant_isolation: "enforced",
            },
            status: "completed",
            executionTimeMs: 85,
            result: {
              logs_count: 5,
              all_compliant: true,
              last_event: "Documento RG/CPF acessado por gestor autorizado com log de IP",
            },
          };
          responseContent = `Consultei o registro imutável de auditoria de acessos aos documentos dos beneficiários. Todas as operações estão em conformidade com as regras de segurança e LGPD.`;
        }

        setMessages((prev) => [
          ...prev,
          {
            id: assistantMsgId,
            sender: "assistant",
            content: responseContent,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            mcpToolCall,
          },
        ]);
      } else {
        // Resposta inteligente genérica com simulação de MCP query
        const genericMcpToolCall: McpToolCall = {
          id: `mcp_${Date.now()}`,
          toolName: "mcp:general_query",
          displayName: "mcp:ancora_crm_engine",
          args: { prompt: textToSend, lead_context: selectedLeadId },
          status: "completed",
          executionTimeMs: 110,
          result: { status: "processed", context: "Âncora CRM Multi-tenant Safe" },
        };

        setMessages((prev) => [
          ...prev,
          {
            id: assistantMsgId,
            sender: "assistant",
            content: `Entendido! Processei sua solicitação via **MCP Engine** utilizando os dados em tempo real da Âncora Saúde. Como posso ajudá-lo a avançar com o atendimento do lead?`,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            mcpToolCall: genericMcpToolCall,
          },
        ]);
      }

      setIsTyping(false);
    }, 900);
  };

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
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
                      <button
                        key={cmd.command}
                        onClick={() => handleSelectCommand(cmd)}
                        className="group flex flex-col justify-between rounded-xl border border-border/80 bg-card p-3.5 text-left transition-all hover:border-sky-500/50 hover:bg-sky-500/5 hover:shadow-sm active:scale-[0.98] active:translate-y-[0.5px] duration-150"
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
                      </button>
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
                                {copiedId === msg.id ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
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
                          <button
                            key={cmd.command}
                            onClick={() => handleSelectCommand(cmd)}
                            className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition-all hover:bg-muted active:scale-[0.98] active:translate-y-[0.5px]"
                          >
                            <div className="flex items-center gap-2">
                              <cmd.icon size={16} className="text-sky-500" />
                              <span className="font-semibold text-foreground">{cmd.label}</span>
                              <span className="text-[11px] text-muted-foreground">{cmd.description}</span>
                            </div>
                            <span className="font-mono text-[10px] text-muted-foreground">{cmd.command}</span>
                          </button>
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
                  <button
                    key={cmd.command}
                    onClick={() => handleSelectCommand(cmd)}
                    className="shrink-0 rounded-full border border-border/80 bg-card px-2.5 py-0.5 text-[11px] text-muted-foreground transition-all hover:border-sky-500/40 hover:text-sky-500 active:scale-[0.95] active:translate-y-[0.5px]"
                  >
                    {cmd.label}
                  </button>
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
