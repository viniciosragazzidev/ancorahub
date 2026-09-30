"use client";

import { useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "@/components/ui/sonner";
import { SITUATION_ACTION_LABEL } from "@/features/attendance-situations/catalog";
import type { SituationRow } from "@/features/attendance-situations/service";
import { approveSuggestionAction, dismissSuggestionAction, mergeSuggestionAction } from "@/features/situation-learning/actions";
import type { SuggestionRow } from "@/features/situation-learning/service";
import { ChannelSection, PhraseEditor, ReplyEditor, Section } from "./situation-drawer";

export function formatAskedAt(value: string | null) {
  return value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "—";
}

function Evidence({ suggestion }: { suggestion: SuggestionRow }) {
  return (
    <Section title="O que os clientes perguntaram" description={`${suggestion.occurrences} ${suggestion.occurrences === 1 ? "vez" : "vezes"} · última em ${formatAskedAt(suggestion.lastAskedAt)}. Dados pessoais removidos.`}>
      <ul className="grid gap-1.5">
        {suggestion.examples.map((example) => <li key={example} className="rounded-lg border border-border px-3 py-2 text-sm">{example}</li>)}
      </ul>
    </Section>
  );
}

/** Situations a suggestion's phrases can be taught to: the system's and the tenant's own (not the roteiros). */
function MergeTarget({ situations, value, onChange }: { situations: SituationRow[]; value: string; onChange: (key: string) => void }) {
  const targets = situations.filter((situation) => situation.kind !== "guided");
  return (
    <Select value={value} onValueChange={(next) => next && onChange(next as string)}>
      <SelectTrigger aria-label="Situação"><SelectValue>{targets.find((situation) => situation.key === value)?.title ?? "Escolha a situação"}</SelectValue></SelectTrigger>
      <SelectContent>
        {targets.map((situation) => <SelectItem key={situation.key} value={situation.key}>{situation.title}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function NewSituationBody({ suggestion, situations, onDone }: { suggestion: SuggestionRow; situations: SituationRow[]; onDone: () => void }) {
  const [title, setTitle] = useState(suggestion.title);
  const [phrases, setPhrases] = useState(suggestion.phrases);
  const [version, setVersion] = useState(0);
  const [response, setResponse] = useState(suggestion.responses[0] ?? "");
  const [action, setAction] = useState<"continue" | "transfer">(suggestion.action);
  const [mergeKey, setMergeKey] = useState("");
  const [pending, startTransition] = useTransition();
  const pick = (index: number) => { setVersion(index); setResponse(suggestion.responses[index] ?? ""); };
  const approve = () => startTransition(async () => {
    const result = await approveSuggestionAction({ id: suggestion.id, title, phrases, response, action });
    if (!result.success) { toast.error(result.error); return; }
    toast.success("Situação criada e ligada. A conversa já reconhece essas frases.");
    onDone();
  });
  const merge = () => startTransition(async () => {
    const result = await mergeSuggestionAction({ id: suggestion.id, targetKey: mergeKey, phrases });
    if (!result.success) { toast.error(result.error); return; }
    toast.success("Frases ensinadas à situação escolhida.");
    onDone();
  });
  const dismiss = () => startTransition(async () => {
    const result = await dismissSuggestionAction(suggestion.id);
    if (!result.success) { toast.error(result.error); return; }
    toast.success("Sugestão descartada.");
    onDone();
  });
  return (
    <>
      <Evidence suggestion={suggestion} />
      <Section title="Nome"><Input value={title} onChange={(event) => setTitle(event.target.value)} /></Section>
      <Section title="Quando o cliente diz" description="Frases sugeridas pela IA e perguntas reais. Vale a frase inteira, sem acento nem pontuação.">
        <PhraseEditor phrases={phrases} onChange={setPhrases} placeholder="Ex.: atendem em niterói" />
      </Section>
      <Section title="Resposta" description="Versões sugeridas; nenhuma traz preço, carência ou promessa. Escolha uma e ajuste se quiser.">
        <div className="flex flex-wrap gap-1.5">
          {suggestion.responses.map((reply, index) => (
            <Button key={reply} type="button" size="sm" variant={version === index ? "default" : "outline"} aria-pressed={version === index} onClick={() => pick(index)}>
              {suggestion.fromBroker && index === 0 ? "Resposta do corretor" : `Versão ${suggestion.fromBroker ? index : index + 1}`}
            </Button>
          ))}
        </div>
        <ReplyEditor value={response} onChange={setResponse} />
      </Section>
      <Section title="O que acontece">
        <Select value={action} onValueChange={(value) => value && setAction(value as "continue" | "transfer")}>
          <SelectTrigger aria-label="Ação"><SelectValue>{SITUATION_ACTION_LABEL[action]}</SelectValue></SelectTrigger>
          <SelectContent>
            <SelectItem value="continue">{SITUATION_ACTION_LABEL.continue} (repete a pergunta pendente)</SelectItem>
            <SelectItem value="transfer">{SITUATION_ACTION_LABEL.transfer} (com o resumo do que o cliente contou)</SelectItem>
          </SelectContent>
        </Select>
      </Section>
      <Section title="Ou juntar a uma situação existente" description="Quando a dúvida já tem situação: as frases acima passam a disparar a situação escolhida, com a resposta dela.">
        <div className="flex gap-2">
          <MergeTarget situations={situations} value={mergeKey} onChange={setMergeKey} />
          <Button type="button" variant="outline" className="shrink-0" disabled={pending || !mergeKey} onClick={merge}>Juntar</Button>
        </div>
      </Section>
      <ChannelSection />
      <SheetFooter>
        <Button type="button" variant="outline" disabled={pending} onClick={dismiss}>Descartar</Button>
        <Button type="button" disabled={pending} onClick={approve}>{pending ? "Salvando…" : "Aprovar situação"}</Button>
      </SheetFooter>
    </>
  );
}

function MergeBody({ suggestion, situations, onDone }: { suggestion: SuggestionRow; situations: SituationRow[]; onDone: () => void }) {
  const [phrases, setPhrases] = useState(suggestion.phrases.length ? suggestion.phrases : suggestion.examples);
  const [targetKey, setTargetKey] = useState(suggestion.targetSituationKey ?? "");
  const [pending, startTransition] = useTransition();
  const merge = () => startTransition(async () => {
    const result = await mergeSuggestionAction({ id: suggestion.id, targetKey, phrases });
    if (!result.success) { toast.error(result.error); return; }
    toast.success("Frases ensinadas. A conversa já reconhece esse jeito de perguntar.");
    onDone();
  });
  const dismiss = () => startTransition(async () => {
    const result = await dismissSuggestionAction(suggestion.id);
    if (!result.success) { toast.error(result.error); return; }
    toast.success("Sugestão descartada.");
    onDone();
  });
  return (
    <>
      <p className="rounded-lg border border-border bg-muted/30 p-3 text-xs leading-5 text-muted-foreground">
        Os clientes perguntaram algo que já tem situação, com palavras que ela ainda não reconhece. Ensinar estas frases faz a situação responder da próxima vez.
      </p>
      <Evidence suggestion={suggestion} />
      <Section title="Situação"><MergeTarget situations={situations} value={targetKey} onChange={setTargetKey} /></Section>
      <Section title="Frases para ensinar" description="Vale a frase inteira, sem acento nem pontuação. Remova as que não fizerem sentido.">
        <PhraseEditor phrases={phrases} onChange={setPhrases} placeholder="Ex.: quanto fica por mês" />
      </Section>
      <SheetFooter>
        <Button type="button" variant="outline" disabled={pending} onClick={dismiss}>Descartar</Button>
        <Button type="button" disabled={pending || !targetKey} onClick={merge}>{pending ? "Salvando…" : "Ensinar à situação"}</Button>
      </SheetFooter>
    </>
  );
}

/** Review of one AI suggestion: approve (as is or edited), merge into an existing situation, or dismiss. */
export function SuggestionDrawer({ suggestion, situations, onClose, onDone }: { suggestion: SuggestionRow | null; situations: SituationRow[]; onClose: () => void; onDone: () => void }) {
  return (
    <Sheet open={Boolean(suggestion)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="data-[side=right]:w-[min(100vw-1rem,38rem)]">
        {suggestion ? (
          <>
            <SheetHeader>
              <SheetTitle>{suggestion.kind === "merge" ? `Ensinar a "${suggestion.targetTitle ?? suggestion.title}"` : suggestion.title}</SheetTitle>
              <SheetDescription className="flex flex-wrap items-center gap-1.5">
                <span>Sugestão da IA · {suggestion.kind === "merge" ? "frases novas para uma situação existente" : "situação nova"}</span>
                {suggestion.fromBroker ? <Badge variant="outline">Com resposta do corretor</Badge> : null}
              </SheetDescription>
            </SheetHeader>
            <SheetBody contentClassName="grid grid-cols-[minmax(0,1fr)] gap-4">
              {suggestion.kind === "merge"
                ? <MergeBody key={suggestion.id} suggestion={suggestion} situations={situations} onDone={() => { onDone(); onClose(); }} />
                : <NewSituationBody key={suggestion.id} suggestion={suggestion} situations={situations} onDone={() => { onDone(); onClose(); }} />}
            </SheetBody>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
