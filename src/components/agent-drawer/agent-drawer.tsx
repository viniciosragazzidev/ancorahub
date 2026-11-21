"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  lastAssistantMessageIsCompleteWithToolCalls,
  type UIMessage,
} from "ai";
import {
  X,
  Maximize2,
  Minimize2,
  Paperclip,
  ArrowUp,
  Sparkles,
  ChevronDown,
  RotateCcw,
  Bot,
  User,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { AgentShortcutChips } from "./agent-shortcut-chips";
import { useAgentDrawer } from "./agent-drawer-provider";
import { useArcScopeEnabled } from "@/components/arc/arc-scope-context";
import { catalogEntry } from "@/features/agent/catalog-meta";
import type { ToolResult } from "@/features/agent/types";
import { undoAgentActionAction } from "@/features/agent/undo-action";
import { useDevLab } from "@/lib/dev-lab";
import { useFeedback } from "@/lib/feedback/use-feedback";
import { AgentToolPart, isToolPart, seatLabelsFrom } from "./agent-parts";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function AgentDrawer() {
  const directorLite = useArcScopeEnabled();
  const { isOpen, setIsOpen, user, shortcuts, activePrompt, setActivePrompt } = useAgentDrawer();
  const [isExpanded, setIsExpanded] = useState(false);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const lab = useDevLab()?.directorAgent ?? null;
  const transport = useMemo(() => lab?.transport ?? new DefaultChatTransport<UIMessage>({ api: "/api/ai/agent-drawer/chat" }), [lab]);
  const undo = lab?.undo ?? undoAgentActionAction;
  const feedback = useFeedback();
  const { messages, sendMessage, status, setMessages, error, addToolApprovalResponse, addToolOutput, regenerate } = useChat({
    transport,
    // Continua sozinho depois de um toque em "Escalar"/"Não fazer" ou de uma escolha ("qual Ana?").
    sendAutomaticallyWhen: ({ messages: current }) => {
      if (lastAssistantMessageIsCompleteWithApprovalResponses({ messages: current })) return true;
      const last = current.at(-1);
      const lastTool = last?.role === "assistant" ? [...last.parts].reverse().find(isToolPart) : undefined;
      return lastTool?.type === "tool-escolher" && lastTool.state === "output-available" && lastAssistantMessageIsCompleteWithToolCalls({ messages: current });
    },
  });
  const isLoading = status === "submitted" || status === "streaming";
  const seatLabels = useMemo(() => seatLabelsFrom(messages.flatMap((message) => message.parts)), [messages]);

  // Nível 1 (FEEDBACK.md): confirmação só depois do servidor, uma vez por ação de escrita.
  const confirmed = useRef(new Set<string>());
  useEffect(() => {
    for (const message of messages) {
      for (const part of message.parts) {
        if (!isToolPart(part) || part.state !== "output-available" || confirmed.current.has(part.toolCallId)) continue;
        confirmed.current.add(part.toolCallId);
        const entry = catalogEntry(part.type.slice(5));
        if (!entry || entry.risk.readOnly) continue;
        feedback((part.output as ToolResult | undefined)?.ok ? "confirm" : "error");
      }
    }
  }, [messages, feedback]);

  // Handle active prompt triggered by keyboard shortcuts or chip clicks
  useEffect(() => {
    if (activePrompt) {
      setInput(activePrompt);
      setActivePrompt(null);
    }
  }, [activePrompt, setActivePrompt]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleShortcutClick = (promptText: string) => {
    setInput(promptText);
  };

  const handleNewChat = () => {
    setMessages([]);
    setInput("");
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;
    const textToSend = input.trim();
    setInput("");
    sendMessage({ text: textToSend });
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent
        side="right"
        className={`${directorLite ? "director-agent-drawer" : "p-0 flex flex-col transition-all duration-300 border-l border-border/80 bg-background shadow-2xl"} ${
          isExpanded ? "w-full sm:max-w-4xl" : "w-full sm:max-w-lg"
        }`}
      >
        {/* Header with dotted canvas background */}
        <div className="relative border-b border-border/80 bg-muted/20 overflow-hidden shrink-0">
          {/* Dotted canvas is retained in the regular experience only. */}
          {!directorLite ? <div
            className="absolute inset-0 opacity-40 pointer-events-none"
            style={{
              backgroundImage: "radial-gradient(var(--border) 1px, transparent 1px)",
              backgroundSize: "10px 10px",
            }}
          /> : null}

          <SheetHeader className="relative p-4 flex flex-row items-center justify-between space-y-0">
            {/* Left Header Controls: New Chat Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1.5 text-xs font-semibold rounded-lg bg-card/80 border border-border/70 hover:bg-accent cursor-pointer"
                  >
                    <span>{directorLite ? "Nova conversa" : "New Chat"}</span>
                    <ChevronDown className="size-3 text-muted-foreground" />
                  </Button>
                }
              />
              <DropdownMenuContent align="start" className="w-44 text-xs">
                <DropdownMenuItem onClick={handleNewChat} className="gap-2 cursor-pointer font-medium">
                  <RotateCcw className="size-3.5" />
                  <span>Nova conversa</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Right Header Controls: Expand & Close */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-8 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
                onClick={() => setIsExpanded((prev) => !prev)}
                title={isExpanded ? "Recolher" : "Expandir"}
              >
                {isExpanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
                onClick={() => setIsOpen(false)}
                title="Fechar (Esc)"
              >
                <X className="size-4" />
              </Button>
            </div>
          </SheetHeader>

          {/* Agent Banner Title */}
          <div className="relative px-6 pb-6 pt-2 space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-foreground tracking-tight">{directorLite ? "Agente IA" : "Agent"}</span>
              <Badge variant="outline" className={directorLite ? "text-xs font-medium bg-card" : "text-[10px] font-semibold tracking-wide uppercase px-1.5 py-0.2 bg-card"}>
                Beta
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {directorLite ? "Consulte a operação e encontre o próximo passo." : "Consulte e gerencie a sua operação na plataforma CorreTop. Como posso ajudar agora?"}
            </p>
          </div>
        </div>

        {/* Scrollable Message Feed & Shortcuts Area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 ? (
            <div className="space-y-6">
              <div className="space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">
                  {directorLite ? "Atalhos rápidos" : `Atalhos Rápidos (${user?.role?.toUpperCase() ?? "OPERACIONAL"})`}
                </span>
                <AgentShortcutChips shortcuts={shortcuts} onSelectShortcut={handleShortcutClick} />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((m: any) => (
                <div
                  key={m.id}
                  className={directorLite ? `director-agent-message ${m.role === "user" ? "is-user" : "is-assistant"}` : `flex gap-3 text-xs leading-relaxed ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {m.role !== "user" && (
                    <div className="size-7 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20 mt-0.5">
                      <Bot className="size-4" />
                    </div>
                  )}

                  <div
                    className={directorLite ? `director-agent-bubble ${m.role === "user" ? "is-user" : "is-assistant"}` : `max-w-[85%] rounded-2xl px-4 py-3 space-y-2 ${m.role === "user" ? "bg-primary text-primary-foreground font-medium rounded-tr-xs" : "bg-card border border-border/80 text-foreground shadow-2xs rounded-tl-xs"}`}
                  >
                    {m.parts.map((part: { type: string; text?: string }, idx: number) => {
                      if (part.type === "text") return part.text ? <div key={idx} className="whitespace-pre-wrap">{part.text}</div> : null;
                      if (isToolPart(part)) {
                        return (
                          <AgentToolPart
                            key={part.toolCallId}
                            part={part}
                            seatLabels={seatLabels}
                            undo={undo}
                            onApprove={(id, approved) => addToolApprovalResponse({ id, approved, reason: approved ? undefined : "O diretor preferiu não fazer." })}
                            onChoose={(toolCallId, choice) => addToolOutput({ tool: "escolher", toolCallId, output: choice })}
                          />
                        );
                      }
                      return null;
                    })}
                  </div>

                  {m.role === "user" && (
                    <div className="size-7 rounded-xl bg-muted text-muted-foreground flex items-center justify-center shrink-0 border border-border/80 mt-0.5">
                      <User className="size-4" />
                    </div>
                  )}
                </div>
              ))}

              {error && !isLoading ? (
                <div className="director-agent-step is-danger" role="alert">
                  <div className="director-agent-step-body">
                    Não consegui responder agora. Nada foi alterado.{" "}
                    <button type="button" className="director-agent-link-button" onClick={() => void regenerate()}>Tentar de novo</button>
                  </div>
                </div>
              ) : null}

              {isLoading && (
                <div className="flex gap-3 items-center text-xs text-muted-foreground pl-1">
                  <div className="size-7 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
                    <Sparkles className={directorLite ? "size-4" : "size-4 animate-pulse"} />
                  </div>
                  <span className={directorLite ? "font-medium" : "animate-pulse font-medium"}>{directorLite ? "Consultando a operação..." : "Agente consultando operação..."}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input box footer */}
        <div className="p-4 border-t border-border/80 bg-background space-y-2 shrink-0">
          <form onSubmit={handleSubmit} className="relative rounded-2xl border border-border/80 bg-card p-3 shadow-sm focus-within:ring-2 focus-within:ring-primary/20 transition-all">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder={directorLite ? "Escreva sua pergunta..." : "Ask anything..."}
              rows={2}
              className="min-h-12 w-full resize-none border-0 bg-transparent p-0 text-xs shadow-none focus-visible:ring-0"
            />

            <div className="flex items-center justify-between pt-2 border-t border-border/40">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-foreground rounded-lg cursor-pointer"
                title="Anexar arquivo"
              >
                <Paperclip className="size-3.5" />
              </Button>

              <Button
                type="submit"
                size="icon"
                disabled={!input.trim() || isLoading}
                className="size-7 rounded-lg shrink-0 bg-foreground text-background hover:bg-foreground/90 disabled:opacity-40 cursor-pointer"
              >
                <ArrowUp className="size-3.5" />
              </Button>
            </div>
          </form>

          <p className="text-[10px] text-center text-muted-foreground/70">
            {directorLite ? "Confirme informações importantes antes de agir." : "Agent pode cometer erros. Verifique informações críticas da operação."}
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
