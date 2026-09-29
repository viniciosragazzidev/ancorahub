"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";

import { Plus, Trash, XIcon } from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetSection, SheetSectionHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "@/components/ui/sonner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { deleteCustomSituationAction, saveBuiltinSituationAction, saveCustomSituationAction, saveGuidedSituationAction } from "@/features/attendance-situations/actions";
import { cleanPhrases, MAX_SITUATION_PHRASES, SITUATION_ACTION_LABEL, type SituationAction } from "@/features/attendance-situations/catalog";
import type { SituationRow } from "@/features/attendance-situations/service";
import { QUICK_REPLY_VARIABLES } from "@/features/message-library/catalog";
import { saveQuickReplyTextAction } from "@/features/message-library/actions";
import { renderConversationVariables } from "@/features/qualification-engine/reply-composer";
import { Preview, PREVIEW_MEMORY, Suggestions } from "../../mensagens/_components/message-drawer";

export type SituationTarget = { mode: "view"; situation: SituationRow } | { mode: "new" } | null;

export const CHANNEL_NOTE = "A resposta sai pelo mesmo canal em que o cliente escreveu (Meta oficial ou WhatsApp da empresa). Responder por outro número no meio da conversa confundiria o cliente.";

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

/** Phrases as removable chips, added one by one. */
function PhraseEditor({ phrases, onChange, placeholder }: { phrases: string[]; onChange: (phrases: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const next = cleanPhrases([...phrases, draft]);
    if (next.length === phrases.length) { setDraft(""); return; }
    onChange(next);
    setDraft("");
  };
  return (
    <div className="grid gap-2">
      <div className="flex gap-2">
        <Input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={placeholder} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); add(); } }} disabled={phrases.length >= MAX_SITUATION_PHRASES} />
        <Button type="button" size="icon-sm" variant="outline" className="shrink-0 self-center" aria-label="Adicionar frase" disabled={!draft.trim() || phrases.length >= MAX_SITUATION_PHRASES} onClick={add}><Plus className="size-4" /></Button>
      </div>
      {phrases.length ? (
        <ul className="flex flex-wrap gap-1.5">
          {phrases.map((phrase) => (
            <li key={phrase} className="flex items-center gap-1 rounded-full border border-border py-0.5 pl-2.5 pr-1 text-xs">
              {phrase}
              <button type="button" className="grid size-4 place-items-center rounded-full text-muted-foreground hover:text-foreground" aria-label={`Remover ${phrase}`} onClick={() => onChange(phrases.filter((item) => item !== phrase))}><XIcon className="size-3" /></button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Reply text with the {{nome}} / {{resumo}} buttons and the example preview. */
function ReplyEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  const insert = (variable: string) => {
    const token = `{{${variable}}}`;
    const element = textarea.current;
    const start = element?.selectionStart ?? value.length;
    const end = element?.selectionEnd ?? value.length;
    onChange(`${value.slice(0, start)}${token}${value.slice(end)}`);
    requestAnimationFrame(() => { element?.focus(); element?.setSelectionRange(start + token.length, start + token.length); });
  };
  return (
    <>
      <Textarea ref={textarea} value={value} onChange={(event) => onChange(event.target.value)} rows={4} aria-label="Resposta" />
      <div className="flex flex-wrap gap-1.5">
        {QUICK_REPLY_VARIABLES.map((variable) => (
          <Button key={variable.key} type="button" size="sm" variant="outline" title={`${variable.label} — ex.: ${variable.example}`} onClick={() => insert(variable.key)}>{`{{${variable.key}}}`}</Button>
        ))}
      </div>
      <Suggestions text={value} useLabel="Usar" onUse={onChange} />
      <div className="grid gap-1.5">
        <p className="text-xs font-medium text-muted-foreground">Prévia com um cliente de exemplo</p>
        <Preview text={renderConversationVariables(value, PREVIEW_MEMORY)} />
      </div>
    </>
  );
}

function ChannelSection() {
  return (
    <Section title="Canal">
      <div className="flex items-center gap-2"><Badge variant="outline">Mesmo canal da conversa</Badge></div>
      <p className="text-xs leading-5 text-muted-foreground">{CHANNEL_NOTE}</p>
    </Section>
  );
}

function BuiltinBody({ situation, onDone }: { situation: SituationRow; onDone: () => void }) {
  const [phrases, setPhrases] = useState(situation.phrases);
  const [enabled, setEnabled] = useState(situation.enabled);
  const [text, setText] = useState(situation.response);
  const [pending, startTransition] = useTransition();
  const save = () => startTransition(async () => {
    const saved = await saveBuiltinSituationAction({ key: situation.key, phrases, enabled });
    if (!saved.success) { toast.error(saved.error); return; }
    if (text.trim() !== situation.response.trim()) {
      const textSaved = await saveQuickReplyTextAction({ ruleKey: situation.key, body: text });
      if (!textSaved.success) { toast.error(textSaved.error); return; }
    }
    toast.success("Situação salva. A conversa já usa as mudanças.");
    onDone();
  });
  return (
    <>
      <Section title="Como é reconhecida" description="O sistema já entende frases como estas, e variações delas.">
        <div className="flex flex-wrap gap-1.5">{situation.recognizedBy.map((example) => <Badge key={example} variant="secondary">{example}</Badge>)}</div>
      </Section>
      <Section title="Frases que a empresa ensinou" description="Frases do seu público que o sistema não reconhece sozinho. Vale a frase inteira, sem acento nem pontuação.">
        <PhraseEditor phrases={phrases} onChange={setPhrases} placeholder="Ex.: quero conversar com alguém" />
      </Section>
      <Section title="Resposta"><ReplyEditor value={text} onChange={setText} /></Section>
      <Section title="O que acontece">
        <p className="text-sm">{SITUATION_ACTION_LABEL[situation.action as SituationAction]}</p>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>{situation.critical ? "Sempre ligada: desligar deixaria o cliente sem resposta ou sem atendimento humano" : "Ligada"}</span>
          <Switch checked={enabled} disabled={situation.critical} onCheckedChange={(checked) => setEnabled(checked === true)} aria-label="Situação ligada" />
        </label>
      </Section>
      <ChannelSection />
      <SheetFooter>
        <Button type="button" disabled={pending} onClick={save}>{pending ? "Salvando…" : "Salvar situação"}</Button>
      </SheetFooter>
    </>
  );
}

function CustomBody({ situation, onDone, onClose }: { situation: SituationRow | null; onDone: () => void; onClose: () => void }) {
  const [title, setTitle] = useState(situation?.title ?? "");
  const [phrases, setPhrases] = useState(situation?.phrases ?? []);
  const [response, setResponse] = useState(situation?.response ?? "");
  const [action, setAction] = useState<"continue" | "transfer">(situation?.action === "transfer" ? "transfer" : "continue");
  const [enabled, setEnabled] = useState(situation?.enabled ?? true);
  const [pending, startTransition] = useTransition();
  const save = () => startTransition(async () => {
    const result = await saveCustomSituationAction({ key: situation?.key ?? null, title, phrases, response, action, enabled });
    if (!result.success) { toast.error(result.error); return; }
    toast.success(situation ? "Situação salva." : "Situação criada. A conversa já reconhece essas frases.");
    onDone();
    if (!situation) onClose();
  });
  const remove = () => startTransition(async () => {
    if (!situation || !window.confirm(`Remover a situação "${situation.title}"?`)) return;
    const result = await deleteCustomSituationAction(situation.key);
    if (!result.success) { toast.error(result.error); return; }
    toast.success("Situação removida.");
    onDone();
    onClose();
  });
  return (
    <>
      <Section title="Nome">
        <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Atendem em Niterói?" />
      </Section>
      <Section title="Quando o cliente diz" description="Frases que disparam esta situação no meio da qualificação. Vale a frase inteira, sem acento nem pontuação.">
        <PhraseEditor phrases={phrases} onChange={setPhrases} placeholder="Ex.: atendem em niterói" />
      </Section>
      <Section title="Resposta"><ReplyEditor value={response} onChange={setResponse} /></Section>
      <Section title="O que acontece">
        <Select value={action} onValueChange={(value) => value && setAction(value as "continue" | "transfer")}>
          <SelectTrigger aria-label="Ação"><SelectValue>{SITUATION_ACTION_LABEL[action]}</SelectValue></SelectTrigger>
          <SelectContent>
            <SelectItem value="continue">{SITUATION_ACTION_LABEL.continue} (repete a pergunta pendente)</SelectItem>
            <SelectItem value="transfer">{SITUATION_ACTION_LABEL.transfer} (com o resumo do que o cliente contou)</SelectItem>
          </SelectContent>
        </Select>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>Ligada</span>
          <Switch checked={enabled} onCheckedChange={(checked) => setEnabled(checked === true)} aria-label="Situação ligada" />
        </label>
      </Section>
      <ChannelSection />
      <SheetFooter>
        {situation ? <Button type="button" variant="outline" disabled={pending} onClick={remove}><Trash className="size-3.5" /> Remover</Button> : null}
        <Button type="button" disabled={pending} onClick={save}>{pending ? "Salvando…" : situation ? "Salvar situação" : "Criar situação"}</Button>
      </SheetFooter>
    </>
  );
}

function GuidedBody({ situation, onDone }: { situation: SituationRow; onDone: () => void }) {
  const guided = situation.guided!;
  const [title, setTitle] = useState(guided.title);
  const [trigger, setTrigger] = useState(guided.triggerCondition);
  const [example, setExample] = useState(guided.exampleCustomerInput);
  const [reference, setReference] = useState(guided.recommendedResponse);
  const [enabled, setEnabled] = useState(guided.enabled);
  const [pending, startTransition] = useTransition();
  const save = () => startTransition(async () => {
    const result = await saveGuidedSituationAction({ id: guided.id, title, triggerCondition: trigger, exampleCustomerInput: example, recommendedResponse: reference, enabled });
    if (!result.success) { toast.error(result.error); return; }
    toast.success("Roteiro salvo.");
    onDone();
  });
  return (
    <>
      <p className="rounded-lg border border-border bg-muted/30 p-3 text-xs leading-5 text-muted-foreground">
        Orientação para a IA: não é enviada igual. Quando o cliente pergunta algo que nenhuma situação cobre, a IA usa este roteiro como referência para responder, sem preço, carência nem promessa.
      </p>
      <Section title="Nome"><Input value={title} onChange={(event) => setTitle(event.target.value)} /></Section>
      <Section title="Quando usar"><Textarea value={trigger} onChange={(event) => setTrigger(event.target.value)} rows={3} /></Section>
      <Section title="Exemplo do que o cliente diz"><Input value={example} onChange={(event) => setExample(event.target.value)} /></Section>
      <Section title="Resposta de referência" description="Variáveis antigas deste roteiro, como {cliente_nome}, continuam valendo.">
        <Textarea value={reference} onChange={(event) => setReference(event.target.value)} rows={5} />
      </Section>
      <Section title="Uso">
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>A IA usa este roteiro</span>
          <Switch checked={enabled} onCheckedChange={(checked) => setEnabled(checked === true)} aria-label="Roteiro ligado" />
        </label>
      </Section>
      <ChannelSection />
      <SheetFooter>
        <Button type="button" disabled={pending} onClick={save}>{pending ? "Salvando…" : "Salvar roteiro"}</Button>
      </SheetFooter>
    </>
  );
}

const KIND_LABEL: Record<SituationRow["kind"], string> = { builtin: "Do sistema · resposta pronta", custom: "Da empresa · resposta pronta", guided: "Orientação para a IA" };

export function SituationDrawer({ target, onClose, onDone }: { target: SituationTarget; onClose: () => void; onDone: () => void }) {
  const situation = target?.mode === "view" ? target.situation : null;
  return (
    <Sheet open={Boolean(target)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="data-[side=right]:w-[min(100vw-1rem,38rem)]">
        {target ? (
          <>
            <SheetHeader>
              <SheetTitle>{situation?.title ?? "Nova situação"}</SheetTitle>
              <SheetDescription>{situation ? KIND_LABEL[situation.kind] : "Uma frase do cliente, uma resposta pronta e o que acontece depois."}</SheetDescription>
            </SheetHeader>
            <SheetBody contentClassName="grid grid-cols-[minmax(0,1fr)] gap-4">
              {target.mode === "new" ? <CustomBody key="new" situation={null} onDone={onDone} onClose={onClose} /> : null}
              {situation?.kind === "builtin" ? <BuiltinBody key={situation.id} situation={situation} onDone={onDone} /> : null}
              {situation?.kind === "custom" ? <CustomBody key={situation.id} situation={situation} onDone={onDone} onClose={onClose} /> : null}
              {situation?.kind === "guided" ? <GuidedBody key={situation.id} situation={situation} onDone={onDone} /> : null}
            </SheetBody>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
