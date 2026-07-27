"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { useOptimistic } from "react";
import { ArrowsClockwise, BellRinging, ChatCircleText, ClipboardText, FileText, Note, Quotes } from "@/components/huge-icons";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { addLeadNoteAction, type LeadNoteState } from "@/features/leads/actions";
import { useReducedMotionPreference } from "@/shared/hooks/use-reduced-motion";

type TimelineItem = { id: string; tipo: "status_change" | "note" | "system_alert" | "document_upload" | "document_review" | "quote_generated" | "whatsapp_msg" | "service_started"; conteudo: string; userName: string | null; createdAt: Date };
const eventIcons = { status_change: ArrowsClockwise, note: Note, system_alert: BellRinging, document_upload: FileText, document_review: ClipboardText, quote_generated: Quotes, whatsapp_msg: ChatCircleText, service_started: ChatCircleText } as const;
const eventLabels = { status_change: "Status", note: "Nota", system_alert: "Alerta do sistema", document_upload: "Documento enviado", document_review: "Documento revisado", quote_generated: "Cotação", whatsapp_msg: "WhatsApp", service_started: "Atendimento iniciado" } as const;

export function LeadTimeline({ leadId, interactions }: { leadId: string; interactions: TimelineItem[] }) {
  const router = useRouter();
  const reducedMotion = useReducedMotionPreference();
  const [state, dispatch, pending] = useActionState<LeadNoteState, FormData>(addLeadNoteAction, {});
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const [note, setNote] = useState("");
  const [optimisticNote, addOptimisticNote] = useOptimistic<TimelineItem | null, TimelineItem>(null, (_, item) => item);
  const visibleInteractions = optimisticNote ? [optimisticNote, ...interactions] : interactions;
  useEffect(() => { if (state.success) { toast.success("Nota adicionada à timeline."); router.refresh(); } if (state.error) toast.error(state.error); }, [state.success, state.error, router]);
  function submitNote(formData: FormData) { const content = String(formData.get("content") ?? "").trim(); if (!content) return; addOptimisticNote({ id: `local-${crypto.randomUUID()}`, tipo: "note", conteudo: content, userName: "Você", createdAt: new Date() }); setNote(""); startTransition(() => dispatch(formData)); }
  return <Card className="flex h-[560px] flex-col border-border bg-card shadow-none"><CardHeader className="shrink-0"><CardTitle>Timeline de interações</CardTitle><CardDescription>{visibleInteractions.length} registro(s), mais recente primeiro</CardDescription></CardHeader><CardContent className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden"><form onSubmit={(event) => { event.preventDefault(); submitNote(new FormData(event.currentTarget)); }} className="shrink-0 space-y-2 rounded-lg border border-border bg-background/50 p-3"><input type="hidden" name="leadId" value={leadId} /><div className="flex flex-wrap gap-1.5"><span className="w-full text-xs font-medium text-muted-foreground">Mensagens rápidas (preenchimento para revisão)</span>{["Bom dia! Tudo bem?", "Cotação pronta", "Ainda tem interesse?"].map((message) => <Button key={message} type="button" size="sm" variant="outline" onClick={() => { setNote(message); noteRef.current?.focus(); }}>{message}</Button>)}</div><Textarea ref={noteRef} name="content" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Registre uma observação sobre este lead..." maxLength={2000} disabled={pending} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} /><div className="flex items-center justify-between gap-3"><span className="text-xs text-muted-foreground">Cmd/Ctrl + Enter para salvar</span><Button type="submit" size="sm" disabled={pending}>{pending ? "Sincronizando..." : "Adicionar nota"}</Button></div></form>{visibleInteractions.length === 0 ? <p className="py-4 text-sm text-muted-foreground">Nenhuma interação registrada.</p> : <ScrollArea className="min-h-0 flex-1 pr-3"><ol className="space-y-4">{visibleInteractions.map((interaction) => { const isLocal = interaction.id === optimisticNote?.id; const Icon = isLocal ? ArrowsClockwise : eventIcons[interaction.tipo]; return <li key={interaction.id} className={`t-timeline-item relative flex gap-3 border-l border-border pl-4 ${isLocal ? "t-sync-local" : "t-sync-confirmed"}`}><span className="absolute -left-[13px] top-0 flex size-6 items-center justify-center rounded-full border border-border bg-card" aria-hidden="true"><Icon className={isLocal && !reducedMotion ? "animate-spin" : ""} size={13} weight="bold" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{isLocal ? "Local · aguardando sincronização" : eventLabels[interaction.tipo]}</span><span className="font-mono text-[11px] text-muted-foreground">{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(interaction.createdAt))}</span></div><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-foreground">{interaction.conteudo}</p><p className="mt-1 text-xs text-muted-foreground">por {interaction.userName ?? "Sistema"}</p></div></li>; })}</ol></ScrollArea>}</CardContent></Card>;
}
