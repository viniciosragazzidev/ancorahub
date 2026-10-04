"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";

import { ArrowsClockwise, PaperPlaneTilt, Sparkle, Trash } from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetSection, SheetSectionHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "@/components/ui/sonner";
import { Textarea } from "@/components/ui/textarea";
import { deleteFreeMessageTemplateAction, saveFreeMessageTemplateAction } from "@/features/ai-qualification/actions";
import { MESSAGE_EVENT_CATALOG } from "@/features/communication-channels/message-event-catalog";
import { QUICK_REPLY_VARIABLES, USAGE_CHANNEL_LABEL } from "@/features/message-library/catalog";
import { resetQuickReplyTextAction, saveQuickReplyTextAction, suggestMessageVariationsAction } from "@/features/message-library/actions";
import type { LibraryMessage } from "@/features/message-library/service";
import { renderConversationVariables } from "@/features/qualification-engine/reply-composer";
import type { ConversationMemory } from "@/features/ai-agent/memory";

/** What the example preview shows for {{nome}} and {{resumo}}. */
export const PREVIEW_MEMORY: ConversationMemory = {
  customerFirstName: { value: "Torquato", confidence: 1 },
  customerName: { value: "Torquato Silva", confidence: 1 },
  planType: { value: "individual", confidence: 1 },
  age: { value: "40", confidence: 1 },
  city: { value: "Itaboraí", confidence: 1 },
  collectedFields: ["customerName", "planType", "age", "city"],
};

export type DrawerTarget = { mode: "view"; message: LibraryMessage } | { mode: "new_free" } | null;

function Section({ title, description, action, children }: { title: string; description?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <SheetSection>
      <SheetSectionHeader>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{title}</p>
          {description ? <p className="text-xs leading-5 text-muted-foreground">{description}</p> : null}
        </div>
        {action}
      </SheetSectionHeader>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 p-4">{children}</div>
    </SheetSection>
  );
}

/** Neutral example of how the text reaches the customer (no WhatsApp bubble token exists yet). */
export function Preview({ text }: { text: string }) {
  return <p className="whitespace-pre-wrap break-words rounded-[var(--radius-card)] border border-border bg-muted/30 p-3 text-sm leading-6 text-foreground">{text || "Sem texto."}</p>;
}

function Validity({ message }: { message: Pick<LibraryMessage, "validity"> }) {
  return (
    <ul className="grid gap-1 text-sm">
      {message.validity.map((item) => (
        <li key={item.channel} className={item.valid === "never" ? "text-muted-foreground" : "text-foreground"}>{item.label}</li>
      ))}
    </ul>
  );
}

function Usages({ message }: { message: LibraryMessage }) {
  if (!message.usages.length) return <p className="text-sm text-muted-foreground">Nenhum lugar usa esta mensagem.</p>;
  return (
    <ul className="divide-y divide-border/60 rounded-[var(--radius-card)] border border-border/70">
      {message.usages.map((usage) => (
        <li key={usage.label} className="flex items-center justify-between gap-3 px-3 py-2">
          <span className="min-w-0 truncate text-sm">{usage.label}</span>
          {usage.channel ? <Badge variant="outline" className="shrink-0">{USAGE_CHANNEL_LABEL[usage.channel]}</Badge> : null}
        </li>
      ))}
    </ul>
  );
}

/** Up to 3 AI rewordings, each applied only on click. */
export function Suggestions({ text, onUse, useLabel }: { text: string; onUse: (suggestion: string) => void; useLabel: string }) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  return (
    <div className="grid gap-2">
      <Button type="button" variant="outline" size="sm" className="justify-self-start" disabled={pending || text.trim().length < 8} onClick={() => startTransition(async () => {
        const result = await suggestMessageVariationsAction({ text });
        if (!result.success) { toast.error(result.error); return; }
        setSuggestions(result.suggestions);
      })}>
        <Sparkle className="size-3.5" /> {pending ? "Gerando…" : "Sugerir variações com IA"}
      </Button>
      {suggestions.length ? (
        <ul className="divide-y divide-border/60 rounded-[var(--radius-card)] border border-border/70">
          {suggestions.map((suggestion) => (
            <li key={suggestion} className="flex items-start justify-between gap-3 px-3 py-2">
              <p className="min-w-0 whitespace-pre-wrap text-sm leading-6">{suggestion}</p>
              <Button type="button" size="sm" variant="outline" className="shrink-0" onClick={() => { onUse(suggestion); setSuggestions((current) => current.filter((item) => item !== suggestion)); }}>{useLabel}</Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function QuickReplyBody({ message, onChanged }: { message: LibraryMessage; onChanged: () => void }) {
  const [text, setText] = useState(message.text);
  const [pending, startTransition] = useTransition();
  const textarea = useRef<HTMLTextAreaElement>(null);
  const reply = message.quickReply!;
  const insert = (variable: string) => {
    const element = textarea.current;
    const token = `{{${variable}}}`;
    if (!element) { setText((current) => `${current}${token}`); return; }
    const start = element.selectionStart ?? text.length;
    const end = element.selectionEnd ?? text.length;
    setText(`${text.slice(0, start)}${token}${text.slice(end)}`);
    requestAnimationFrame(() => { element.focus(); element.setSelectionRange(start + token.length, start + token.length); });
  };
  const save = () => startTransition(async () => {
    const result = await saveQuickReplyTextAction({ ruleKey: reply.ruleKey, body: text });
    if (!result.success) { toast.error(result.error); return; }
    toast.success("Texto salvo. A IA já usa a nova versão.");
    onChanged();
  });
  const reset = () => startTransition(async () => {
    const result = await resetQuickReplyTextAction(reply.ruleKey);
    if (!result.success) { toast.error(result.error); return; }
    setText(reply.defaultText);
    toast.success("Voltou ao texto padrão.");
    onChanged();
  });

  return (
    <>
      <Section title="Texto" description="A IA envia este texto nesta situação, pelo mesmo canal em que o cliente escreveu.">
        <Textarea ref={textarea} value={text} onChange={(event) => setText(event.target.value)} rows={5} aria-label="Texto da resposta" />
        <div className="flex flex-wrap gap-1.5">
          {QUICK_REPLY_VARIABLES.map((variable) => (
            <Button key={variable.key} type="button" size="sm" variant="outline" title={`${variable.label} — ex.: ${variable.example}`} onClick={() => insert(variable.key)}>{`{{${variable.key}}}`}</Button>
          ))}
        </div>
        <p className="text-xs leading-5 text-muted-foreground">Se o cliente ainda não contou algo, a variável some junto com a pontuação em volta.</p>
        <Suggestions text={text} useLabel="Usar" onUse={setText} />
      </Section>
      <Section title="Prévia" description="Exemplo com um cliente que já contou: individual, 40 anos, Itaboraí.">
        <Preview text={renderConversationVariables(text, PREVIEW_MEMORY)} />
      </Section>
      <SheetFooter>
        {reply.customized ? <Button type="button" variant="outline" disabled={pending} onClick={reset}><ArrowsClockwise className="size-3.5" /> Voltar ao padrão</Button> : null}
        <Button type="button" disabled={pending || text.trim() === message.text.trim()} onClick={save}>{pending ? "Salvando…" : "Salvar texto"}</Button>
      </SheetFooter>
    </>
  );
}

function FreeMessageBody({ message, onChanged, onClose }: { message: LibraryMessage | null; onChanged: () => void; onClose: () => void }) {
  const [name, setName] = useState(message?.name ?? "");
  const [content, setContent] = useState(message?.text ?? "");
  const [pending, startTransition] = useTransition();
  const save = () => startTransition(async () => {
    try {
      await saveFreeMessageTemplateAction({ id: message?.id, name, category: message?.category ?? "operacional", content });
      toast.success(message ? "Mensagem salva." : "Mensagem criada.");
      onChanged();
      if (!message) onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar a mensagem.");
    }
  });
  const createVariation = (suggestion: string) => startTransition(async () => {
    try {
      await saveFreeMessageTemplateAction({ name: `${name} (variação)`, category: message?.category ?? "operacional", content: suggestion });
      toast.success("Variação criada como nova mensagem.");
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível criar a variação.");
    }
  });
  const remove = () => startTransition(async () => {
    if (!message) return;
    const result = await deleteFreeMessageTemplateAction(message.id);
    if (!result.success) { toast.error(result.error); return; }
    toast.success("Mensagem removida.");
    onChanged();
    onClose();
  });

  return (
    <>
      <Section title="Texto" description="Texto livre: sai pelo WhatsApp da empresa a qualquer hora e pela Meta só nas 24h depois que a pessoa escreveu.">
        <label className="grid gap-1.5 text-xs font-medium text-foreground">Nome
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Lead atribuído — versão curta" />
        </label>
        <label className="grid gap-1.5 text-xs font-medium text-foreground">Mensagem
          <Textarea value={content} onChange={(event) => setContent(event.target.value)} rows={6} />
        </label>
        {message?.variables.length ? (
          <div className="flex flex-wrap gap-1.5">
            {message.variables.map((variable) => <Badge key={variable} variant="outline">{`{{${variable}}}`}</Badge>)}
          </div>
        ) : null}
        <Suggestions text={content} useLabel={message ? "Criar como nova" : "Usar"} onUse={message ? createVariation : setContent} />
      </Section>
      <Section title="Prévia"><Preview text={content} /></Section>
      {message ? (
        <>
          <Section title="Onde vale"><Validity message={message} /></Section>
          <Section title="Onde é usada" description="Com o canal por onde cada uso sai."><Usages message={message} /></Section>
        </>
      ) : null}
      <SheetFooter>
        {message ? <Button type="button" variant="outline" disabled={pending || message.usages.length > 0} title={message.usages.length ? "Em uso: troque a mensagem nesses lugares antes de remover." : undefined} onClick={remove}><Trash className="size-3.5" /> Remover</Button> : null}
        <Button type="button" disabled={pending || name.trim().length < 2 || content.trim().length < 3} onClick={save}>{pending ? "Salvando…" : message ? "Salvar mensagem" : "Criar mensagem"}</Button>
      </SheetFooter>
    </>
  );
}

function MetaTemplateBody({ message, onChanged, onClose, onUseInSituation }: { message: LibraryMessage; onChanged: () => void; onClose: () => void; onUseInSituation: (templateId: string, eventKey: string) => void }) {
  const meta = message.meta!;
  const [phone, setPhone] = useState("");
  const [situation, setSituation] = useState<string>(MESSAGE_EVENT_CATALOG[0]?.key ?? "FIRST_CONTACT");
  const [pending, startTransition] = useTransition();
  const approved = meta.rawStatus === "APPROVED";
  const sendTest = () => startTransition(async () => {
    const response = await fetch(`/api/integrations/whatsapp/templates/${message.id}/test`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ destinationPhone: phone }) }).catch(() => null);
    const data = response ? await response.json().catch(() => ({})) as { error?: string } : { error: "Erro de conexão." };
    if (!response?.ok) { toast.error(data.error ?? "Não foi possível enviar o teste."); return; }
    toast.success("Mensagem de teste enviada.");
  });
  const remove = () => startTransition(async () => {
    if (!window.confirm("Excluir este template na Meta? Os lugares que o usam deixam de enviá-lo.")) return;
    const response = await fetch(`/api/integrations/whatsapp/templates/${message.id}`, { method: "DELETE" }).catch(() => null);
    const data = response ? await response.json().catch(() => ({})) as { error?: string } : { error: "Erro de conexão." };
    if (!response?.ok) { toast.error(data.error ?? "Não foi possível excluir o template."); return; }
    toast.success("Template excluído.");
    onChanged();
    onClose();
  });

  return (
    <>
      {meta.rejectedReason ? <p className="rounded-[var(--radius-card)] border border-destructive/30 bg-destructive/5 p-3 text-sm text-foreground">Motivo da rejeição: {meta.rejectedReason}</p> : null}
      <Section title="Texto" description={`${message.category ?? "Sem categoria"} · ${meta.language}${meta.headerType !== "NONE" ? ` · cabeçalho ${meta.headerType.toLowerCase()}` : ""}. O texto de um template só muda criando outro e aprovando na Meta.`}>
        <Preview text={[message.text, meta.footerText].filter(Boolean).join("\n\n")} />
      </Section>
      <Section title="Onde vale"><Validity message={message} /></Section>
      <Section title="Onde é usado" description="Com o canal por onde cada uso sai."><Usages message={message} /></Section>
      {approved ? (
        <>
          <Section title="Usar numa situação" description="Aplica este template como mensagem principal de uma situação; só vale depois de salvar e publicar.">
            <Select value={situation} onValueChange={(value) => value && setSituation(String(value))}>
              <SelectTrigger aria-label="Situação"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MESSAGE_EVENT_CATALOG.map((event) => <SelectItem key={event.key} value={event.key}>{event.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={() => onUseInSituation(message.id, situation)}>Aplicar e abrir situações</Button>
          </Section>
          <Section title="Enviar teste" description="Sai pela Meta oficial para o número informado.">
            <div className="flex gap-2">
              <Input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="DDD + telefone" inputMode="tel" />
              <Button type="button" variant="outline" disabled={pending || phone.replace(/\D/g, "").length < 10} onClick={sendTest}><PaperPlaneTilt className="size-3.5" /> Enviar</Button>
            </div>
          </Section>
        </>
      ) : null}
      <SheetFooter>
        <Button type="button" variant="outline" disabled={pending} onClick={remove}><Trash className="size-3.5" /> Excluir template na Meta</Button>
      </SheetFooter>
    </>
  );
}

export function MessageDrawer({ target, onClose, onChanged, onUseInSituation }: {
  target: DrawerTarget;
  onClose: () => void;
  onChanged: () => void;
  onUseInSituation: (templateId: string, eventKey: string) => void;
}) {
  const message = target?.mode === "view" ? target.message : null;
  const title = target?.mode === "new_free" ? "Nova mensagem livre" : message?.name ?? "";
  const description = target?.mode === "new_free"
    ? "Texto próprio para avisos da equipe e situações."
    : message ? `${message.kindLabel} · ${message.status}` : "";

  return (
    <Sheet open={Boolean(target)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="data-[side=right]:w-[min(100vw-1rem,38rem)]">
        {target ? (
          <>
            <SheetHeader>
              <SheetTitle>{title}</SheetTitle>
              <SheetDescription>{description}</SheetDescription>
            </SheetHeader>
            <SheetBody contentClassName="grid grid-cols-[minmax(0,1fr)] gap-4">
              {target.mode === "new_free" ? <FreeMessageBody key="new" message={null} onChanged={onChanged} onClose={onClose} /> : null}
              {message?.kind === "free_message" ? <FreeMessageBody key={message.id} message={message} onChanged={onChanged} onClose={onClose} /> : null}
              {message?.kind === "quick_reply" ? <QuickReplyBody key={message.id} message={message} onChanged={onChanged} /> : null}
              {message?.kind === "meta_template" ? <MetaTemplateBody key={message.id} message={message} onChanged={onChanged} onClose={onClose} onUseInSituation={onUseInSituation} /> : null}
            </SheetBody>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
