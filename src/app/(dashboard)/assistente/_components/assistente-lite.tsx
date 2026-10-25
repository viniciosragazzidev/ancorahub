"use client";

/**
 * Assistente no visual Lite. Mesmo comportamento da tela atual (comandos com "/", atalhos, contexto de lead,
 * resposta simulada das ferramentas MCP e Cotação Express no servidor), com a conversa em balões de tokens,
 * os detalhes da ferramenta recolhidos e o painel MCP como cartão lateral. Sem gradiente, sem loop infinito.
 */
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { BarChart3, Calculator, Check, ChevronDown, Clock, Copy, PanelRight, SendHorizontal, ShieldCheck, Sparkles, Trash2, User, Zap } from "lucide-react";

import { LiteSelect } from "@/components/lite/controls";
import { liteDateFormatter } from "@/components/lite/format/date";
import page from "@/components/lite/page/lite-page.module.css";
import { consultarCotacaoExpress } from "@/features/tenant-intelligence/rag/cotacao-express-actions";

import { MOCK_LEAD_CONTEXTS, PRESET_COMMAND_DATA, matchPresetCommand, mockAssistantReply, type ChatMessage } from "./assistente-model";
import styles from "./assistente-lite.module.css";

const PRESET_ICONS: Record<string, typeof Calculator> = {
  "/cotacao-express": Calculator,
  "/lead-resumo": User,
  "/distribuir-plantao": Clock,
  "/metricas-filial": BarChart3,
  "/cadencia-waha": Zap,
  "/auditoria-lgpd": ShieldCheck,
};

const MCP_TOOLS = [
  { name: "mcp:quote_calculator", description: "Calcula cotações PME/Adesão com regras de faixa etária e operadoras." },
  { name: "mcp:leads_query", description: "Busca e sintetiza a ficha completa 360º de qualquer lead cadastrado." },
  { name: "mcp:sla_checker", description: "Monitora SLA do plantão e redistribui leads estagnados automaticamente." },
  { name: "mcp:waha_cadence", description: "Agenda réguas de mensagens no WhatsApp via VPS WAHA dedicada." },
];

const clock = liteDateFormatter({ hour: "2-digit", minute: "2-digit" });

/** "**texto**" vira negrito; o resto fica como está. */
export function richText(text: string): ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={index}>{part.slice(2, -2)}</strong> : <Fragment key={index}>{part}</Fragment>,
  );
}

/** "qualification_score" vira "Qualification score": caixa de frase, sem sublinhado. */
function keyLabel(key: string) {
  const text = key.replace(/_/g, " ");
  return text.charAt(0).toLocaleUpperCase("pt-BR") + text.slice(1);
}

function ToolCall({ message, copied, onCopy }: { message: ChatMessage; copied: boolean; onCopy: () => void }) {
  const call = message.mcpToolCall!;
  return (
    <details className={styles.tool}>
      <summary className={styles.toolSummary}>
        <span className={styles.toolName}>{call.displayName}</span>
        <span className={`${page.cellSub} ${page.numeric}`}>{call.executionTimeMs} ms</span>
        <span className={page.badge} data-tone="success"><Check aria-hidden="true" size={12} />&nbsp;Executado via MCP</span>
        <ChevronDown aria-hidden="true" size={16} className={styles.toolChevron} />
      </summary>
      <div className={styles.toolBody}>
        <div className={styles.toolArgsHead}>
          <span className={page.cellSub}>Parâmetros de entrada</span>
          <button type="button" className={page.iconButton} aria-label={copied ? "Parâmetros copiados" : "Copiar parâmetros"} onClick={onCopy}>
            {copied ? <Check aria-hidden="true" size={16} /> : <Copy aria-hidden="true" size={16} />}
          </button>
        </div>
        <pre className={styles.pre}>{JSON.stringify(call.args, null, 2)}</pre>
        {call.result ? (
          <>
            <span className={page.cellSub}>Retorno do CRM</span>
            <dl className={styles.result}>
              {Object.entries(call.result).map(([key, value]) => (
                <div key={key}>
                  <dt>{keyLabel(key)}</dt>
                  <dd>{typeof value === "object" ? JSON.stringify(value) : String(value)}</dd>
                </div>
              ))}
            </dl>
          </>
        ) : null}
      </div>
    </details>
  );
}

export function AssistenteLite() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState("lead_carlos_01");
  const [isTyping, setIsTyping] = useState(false);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [showSidePanel, setShowSidePanel] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Nova mensagem: a conversa rola até o fim (dentro do cartão, nunca a página).
  useEffect(() => {
    const feed = feedRef.current;
    if (feed && (messages.length > 0 || isTyping)) feed.scrollTop = feed.scrollHeight;
  }, [messages, isTyping]);

  const now = () => clock.format(new Date());

  const selectCommand = (prompt: string) => {
    setInputValue(prompt);
    setShowSlashMenu(false);
    inputRef.current?.focus();
  };

  const send = () => {
    const textToSend = inputValue.trim();
    if (!textToSend || isTyping) return;
    setMessages((previous) => [...previous, { id: `msg_user_${Date.now()}`, sender: "user", content: textToSend, timestamp: now() }]);
    setInputValue("");
    setShowSlashMenu(false);
    setIsTyping(true);

    const matched = matchPresetCommand(textToSend);
    const assistantId = `msg_ai_${Date.now()}`;
    // Cotação Express consulta o material de operadora no servidor (RAG), sem valores fixos.
    if (matched?.command === "/cotacao-express") {
      const append = (content: string) => setMessages((previous) => [...previous, { id: assistantId, sender: "assistant", content, timestamp: now() }]);
      consultarCotacaoExpress(textToSend)
        .then((result) => append(result.status === "answered" ? result.answer : result.message))
        .catch(() => append("Não foi possível consultar a cotação agora. Tente novamente em instantes."))
        .finally(() => setIsTyping(false));
      return;
    }
    window.setTimeout(() => {
      const reply = mockAssistantReply(matched?.command, textToSend, selectedLeadId);
      setMessages((previous) => [...previous, { id: assistantId, sender: "assistant", content: reply.content, timestamp: now(), mcpToolCall: reply.mcpToolCall }]);
      setIsTyping(false);
    }, 900);
  };

  const copy = (text: string, id: string) => {
    void navigator.clipboard?.writeText(text);
    setCopiedId(id);
    window.setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className={`arc-venancor ${page.stack}`} data-skin="diretor">
      <div className={page.toolbar}>
        <span className={page.badge} data-tone="success"><span className={styles.dot} aria-hidden="true" />MCP online</span>
        <p className={page.muted}>Assistente comercial com acesso às ferramentas de dados via MCP.</p>
        <div className={`${styles.leadSelect} ${page.toolbarEnd}`}>
          <LiteSelect label="Contexto do lead" hideLabel value={selectedLeadId} onChange={setSelectedLeadId} options={MOCK_LEAD_CONTEXTS.map((context) => ({ value: context.id, label: context.name }))} />
        </div>
        <button type="button" className={page.iconButton} aria-label="Limpar histórico da conversa" title="Limpar histórico da conversa" onClick={() => setMessages([])}>
          <Trash2 aria-hidden="true" size={18} />
        </button>
        <button type="button" className={page.button} aria-pressed={showSidePanel} onClick={() => setShowSidePanel((open) => !open)}>
          <PanelRight aria-hidden="true" size={16} />{showSidePanel ? "Ocultar painel MCP" : "Painel MCP"}
        </button>
      </div>

      <div className={styles.layout} data-panel={showSidePanel ? "open" : "closed"}>
        <section className={styles.chat} aria-label="Conversa com o assistente">
          <div ref={feedRef} className={styles.feed}>
            {messages.length === 0 ? (
              <div className={styles.welcome}>
                <span className={styles.welcomeIcon} aria-hidden="true"><Sparkles size={24} /></span>
                <h2 className={page.sectionTitle}>Como posso ajudar na operação hoje?</h2>
                <p className={page.muted}>Escreva em linguagem natural ou use um atalho para cotações, auditoria de SLA e gestão de leads.</p>
                <ul className={styles.presets}>
                  {PRESET_COMMAND_DATA.map((command) => {
                    const Icon = PRESET_ICONS[command.command] ?? Sparkles;
                    return (
                      <li key={command.command}>
                        <button type="button" className={styles.preset} onClick={() => selectCommand(command.prompt)}>
                          <span className={styles.presetHead}>
                            <Icon aria-hidden="true" size={18} />
                            <span className={page.cellTitle}>{command.label}</span>
                          </span>
                          <span className={page.cellSub}>{command.description}</span>
                          <span className={styles.command}>{command.command}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              <ol className={styles.messages} aria-label="Mensagens">
                {messages.map((message) => (
                  <li key={message.id} className={styles.message} data-sender={message.sender}>
                    {message.mcpToolCall ? <ToolCall message={message} copied={copiedId === message.id} onCopy={() => copy(JSON.stringify(message.mcpToolCall?.args, null, 2), message.id)} /> : null}
                    <div className={styles.bubble}>{richText(message.content)}</div>
                    <span className={`${page.cellSub} ${page.numeric}`}>{message.timestamp}</span>
                  </li>
                ))}
                {isTyping ? (
                  <li className={styles.message} data-sender="assistant" aria-live="polite">
                    <div className={`${styles.bubble} ${styles.typing}`}>
                      <span className={styles.typingDots} aria-hidden="true"><span /><span /><span /></span>
                      Executando ferramenta MCP
                    </div>
                  </li>
                ) : null}
              </ol>
            )}
          </div>

          <div className={styles.composer}>
            {showSlashMenu ? (
              <ul className={styles.slashMenu} aria-label="Comandos de atalho MCP">
                {PRESET_COMMAND_DATA.map((command) => (
                  <li key={command.command}>
                    <button type="button" className={styles.slashItem} onClick={() => selectCommand(command.prompt)}>
                      <span className={styles.slashText}>
                        <span className={page.cellTitle}>{command.label}</span>
                        <span className={page.cellSub}>{command.description}</span>
                      </span>
                      <span className={styles.command}>{command.command}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className={styles.chips} aria-label="Atalhos">
              {PRESET_COMMAND_DATA.slice(0, 4).map((command) => (
                <button key={command.command} type="button" className={styles.chip} onClick={() => selectCommand(command.prompt)}>{command.label}</button>
              ))}
            </div>
            <div className={styles.inputRow}>
              <input
                ref={inputRef}
                className={styles.input}
                value={inputValue}
                aria-label="Mensagem para o assistente"
                placeholder="Escreva sua instrução ou digite / para ver os comandos"
                onChange={(event) => {
                  setInputValue(event.target.value);
                  setShowSlashMenu(event.target.value.startsWith("/"));
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    send();
                  }
                }}
              />
              <button type="button" className={`${page.iconButton} ${styles.send}`} aria-label="Enviar mensagem" disabled={!inputValue.trim() || isTyping} onClick={send}>
                <SendHorizontal aria-hidden="true" size={18} />
              </button>
            </div>
            <p className={styles.hint}>
              <span>Enter envia, / abre os comandos</span>
              <span><ShieldCheck aria-hidden="true" size={14} /> Isolamento por corretora ativo</span>
            </p>
          </div>
        </section>

        {showSidePanel ? (
          <aside className={page.card} aria-labelledby="assistente-painel">
            <div className={styles.panelHead}>
              <h2 id="assistente-painel" className={page.sectionTitle}>Ferramentas MCP ativas</h2>
              <span className={page.badge}>8 online</span>
            </div>
            <ul className={styles.tools}>
              {MCP_TOOLS.map((tool) => (
                <li key={tool.name} className={styles.toolItem}>
                  <span className={styles.toolName}><span className={styles.dot} data-tone="success" aria-hidden="true" />{tool.name}</span>
                  <span className={page.cellSub}>{tool.description}</span>
                </li>
              ))}
            </ul>
            <div className={styles.focus}>
              <span className={page.cellSub}>Lead em foco no atendimento</span>
              <div className={styles.focusHead}>
                <span>
                  <span className={page.cellTitle}>Carlos Eduardo Silva</span>
                  <span className={page.cellSub}>Bradesco PME · 4 vidas</span>
                </span>
                <span className={page.badge} data-tone="danger">Quente</span>
              </div>
              <dl className={styles.facts}>
                <div><dt>Etapa atual</dt><dd>Cotação enviada</dd></div>
                <div><dt>Último contato</dt><dd>Há 12 minutos</dd></div>
                <div><dt>Filial responsável</dt><dd>Filial Jardins</dd></div>
              </dl>
            </div>
            <dl className={styles.facts}>
              <div><dt>Provedor de IA</dt><dd>DeepSeek V3.1 (OpenRouter)</dd></div>
              <div><dt>Latência média</dt><dd>~24 ms</dd></div>
              <div><dt>Multi-tenant RLS</dt><dd>Isolado por corretora</dd></div>
            </dl>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
