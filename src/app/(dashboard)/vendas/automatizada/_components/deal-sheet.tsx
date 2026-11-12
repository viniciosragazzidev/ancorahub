"use client";

import { useCallback, useEffect, useState, useTransition, type ReactNode } from "react";

import { FileArrowDown, MoreHorizontalIcon } from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetSection, SheetSectionHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "@/components/ui/sonner";
import { Textarea } from "@/components/ui/textarea";
import { approveAutoSaleMessageAction, discardAutoSaleMessageAction, getAutoSaleDealAction, searchHandOffBrokersAction, updateAutoSaleDealAction } from "@/features/auto-sale/actions";
import { CHANNEL_LABEL, formatCents, MODE_LABEL, STAGE_LABEL, STATUS_LABEL, type AutoSaleMode } from "@/features/auto-sale/contracts";
import { formatUsd } from "@/features/auto-sale/metrics";
import type { DealDetail } from "@/features/auto-sale/queries";

import { formatWhen, STATUS_TONE } from "./format";

type Detail = NonNullable<DealDetail>;

const OUTBOX_LABEL: Record<string, string> = { draft: "Aguardando você", simulated: "Simulação (não sai)", approved: "Na fila", sending: "Enviando", sent: "Enviada", held: "Retida", failed: "Falhou", cancelled: "Descartada" };
const KIND_LABEL: Record<string, string> = { text: "Mensagem", document: "PDF da cotação", image: "Imagem do plano" };
const ACTION_LABEL: Record<string, string> = {
  ask: "perguntou", confirm: "confirmou os dados", quote: "cotou", recommend: "recomendou", cheaper: "buscou a mais em conta", handle_objection: "tratou a objeção",
  close: "pediu o fechamento", request_documents: "pediu os documentos", call_manager: "chamou você", hold: "segurou a conversa", end: "encerrou",
};
const INTENT_LABEL: Record<string, string> = {
  confirm: "confirmou", answer: "respondeu", question: "perguntou", objection: "objetou", accept: "aceitou", reject: "recusou", documents: "mandou documentos",
  unclear: "não deu para entender", small_talk: "conversa", other: "outro",
};
const OBJECTION_LABEL: Record<string, string> = {
  expensive: "achou caro", pays_today: "compara com o que paga", hospital: "hospital", coparticipation: "coparticipação", waiting_period: "carência",
  spouse: "vai falar com a família", ad_price: "valor do anúncio", age: "idade", scam: "desconfiança", think: "vai pensar", other: "outra",
};

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

function PendingMessage({ item, onDone }: { item: Detail["outbox"][number]; onDone: () => void }) {
  const [body, setBody] = useState(item.body);
  const [confirm, setConfirm] = useState(false);
  const [pending, startTransition] = useTransition();
  const approve = () => startTransition(async () => {
    const result = await approveAutoSaleMessageAction({ outboxId: item.id, body: item.kind === "text" ? body : undefined, confirmOverride: confirm });
    if (!result.ok) { toast.error(result.error); return; }
    if (result.data.violations?.length) { setConfirm(true); toast.warning("O texto editado cita valor ou promessa fora da cotação. Confira e confirme para enviar mesmo assim."); return; }
    toast.success("Mensagem aprovada. Ela sai na próxima rodada do envio.");
    onDone();
  });
  const discard = () => startTransition(async () => {
    const result = await discardAutoSaleMessageAction(item.id);
    if (!result.ok) { toast.error(result.error); return; }
    onDone();
  });
  return (
    <div className="grid gap-2 rounded-[var(--radius-card)] border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={item.status === "held" ? "warning" : "outline"}>{OUTBOX_LABEL[item.status]}</Badge>
        <span className="text-xs text-muted-foreground">{KIND_LABEL[item.kind]}{item.mediaFilename ? `: ${item.mediaFilename}` : ""}</span>
      </div>
      {item.holdReason ? <p className="text-xs text-muted-foreground">{item.holdReason}</p> : null}
      {item.kind === "text" ? (
        <Textarea aria-label="Texto da mensagem" value={body} onChange={(event) => { setBody(event.target.value); setConfirm(false); }} rows={Math.min(6, Math.max(2, Math.ceil(body.length / 60)))} />
      ) : <p className="whitespace-pre-wrap text-sm">{item.body}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={discard}>Descartar</Button>
        <Button type="button" size="sm" variant="outline" disabled={pending || !body.trim()} onClick={approve}>{confirm ? "Confirmar e enviar" : "Enviar"}</Button>
      </div>
    </div>
  );
}

function HandOff({ dealId, onDone }: { dealId: string; onDone: () => void }) {
  const [query, setQuery] = useState("");
  const [brokers, setBrokers] = useState<{ id: string; name: string }[]>([]);
  const [pending, startTransition] = useTransition();
  const search = () => startTransition(async () => {
    const result = await searchHandOffBrokersAction(query);
    if (!result.ok) { toast.error(result.error); return; }
    setBrokers(result.data);
  });
  const handOff = (brokerId: string, name: string) => startTransition(async () => {
    const result = await updateAutoSaleDealAction({ op: "hand_off", dealId, brokerId });
    if (!result.ok) { toast.error(result.error); return; }
    toast.success(`Lead entregue a ${name}. A assistente parou.`);
    onDone();
  });
  return (
    <Section title="Entregar a um corretor" description="Só você escolhe quem recebe. O corretor recebe o lead pela atribuição manual, com a etapa mantida.">
      <div className="flex gap-2">
        <Input value={query} aria-label="Buscar corretor" placeholder="Nome do corretor" onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); search(); } }} />
        <Button type="button" variant="outline" disabled={pending} onClick={search}>Buscar</Button>
      </div>
      <ul className="grid gap-1.5">
        {brokers.map((broker) => (
          <li key={broker.id} className="flex min-h-11 items-center justify-between gap-2 rounded-[var(--radius-card)] border border-border px-3">
            <span className="truncate text-sm">{broker.name}</span>
            <Button type="button" size="sm" disabled={pending} onClick={() => handOff(broker.id, broker.name)}>Entregar</Button>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** Detalhe da negociação: etapa, mensagens para aprovar, conversa, ofertas com PDF, decisões da IA e custo. */
export function DealSheet({ dealId, onClose, autopilotAllowed, previewDetail }: { dealId: string | null; onClose: () => void; autopilotAllowed: boolean; previewDetail?: Detail }) {
  const [detail, setDetail] = useState<Detail | null>(previewDetail ?? null);
  const [error, setError] = useState<string | null>(null);
  const [handOff, setHandOff] = useState(false);
  const [pending, startTransition] = useTransition();

  const load = useCallback(() => {
    if (!dealId || previewDetail) return;
    startTransition(async () => {
      const result = await getAutoSaleDealAction(dealId);
      if (!result.ok) { setError(result.error); return; }
      setError(null);
      setDetail(result.data);
    });
  }, [dealId, previewDetail]);

  // O pai remonta o painel por negociação (key), então o estado começa limpo.
  useEffect(() => {
    if (!dealId) return;
    load();
    const timer = window.setInterval(load, 15_000);
    return () => window.clearInterval(timer);
  }, [dealId, load]);

  const run = (input: Parameters<typeof updateAutoSaleDealAction>[0], message: string) => startTransition(async () => {
    const result = await updateAutoSaleDealAction(input);
    if (!result.ok) { toast.error(result.error); return; }
    toast.success(message);
    load();
  });

  const deal = detail?.deal;
  const open = deal ? ["active", "paused", "waiting_manager"].includes(deal.status) : false;
  const pendingItems = detail?.outbox.filter((item) => item.status === "draft" || item.status === "held") ?? [];
  const otherModes = (["simulation", "copilot", "autopilot"] as AutoSaleMode[]).filter((mode) => mode !== deal?.mode && (mode !== "autopilot" || autopilotAllowed));

  return (
    <Sheet open={Boolean(dealId)} onOpenChange={(value) => { if (!value) onClose(); }}>
      <SheetContent className="data-[side=right]:w-[min(100vw-1rem,42rem)]">
        <SheetHeader>
          <SheetTitle>{detail?.lead.name ?? "Negociação"}</SheetTitle>
          <SheetDescription>
            {deal ? `${STAGE_LABEL[deal.stage]} · ${MODE_LABEL[deal.mode]} · ${CHANNEL_LABEL[deal.channel]}` : error ?? "Carregando…"}
          </SheetDescription>
        </SheetHeader>
        <SheetBody aria-busy={pending}>
          {deal && detail ? (
            <>
              <Section
                title="Situação"
                description={deal.managerCallReason ? `A assistente chamou você: ${deal.managerCallReason}.` : deal.handedTo ? `Entregue a ${deal.handedTo}.` : undefined}
                action={open ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button size="icon-sm" variant="outline" aria-label="Mais ações" />}>
                      <MoreHorizontalIcon className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setHandOff(true)}>Entregar a um corretor</DropdownMenuItem>
                      {otherModes.map((mode) => <DropdownMenuItem key={mode} onClick={() => run({ op: "mode", dealId: deal.id, mode }, `Modo: ${MODE_LABEL[mode]}.`)}>Mudar para {MODE_LABEL[mode]}</DropdownMenuItem>)}
                      <DropdownMenuItem onClick={() => run({ op: "end", dealId: deal.id, outcome: "return_to_distribution" }, "Negociação encerrada. O lead voltou para a distribuição.")}>Encerrar e devolver à distribuição</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => run({ op: "end", dealId: deal.id, outcome: "lost" }, "Negociação encerrada como perdida.")}>Encerrar como perdida</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={STATUS_TONE[deal.status]}>{STATUS_LABEL[deal.status]}</Badge>
                  <span className="text-xs text-muted-foreground">Desde {formatWhen(deal.createdAt)}</span>
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
                  <div><dt className="text-muted-foreground">1ª cotação</dt><dd className="tabular-nums">{detail.metrics.minutesToFirstQuote != null ? `${detail.metrics.minutesToFirstQuote} min` : "Ainda não"}</dd></div>
                  <div><dt className="text-muted-foreground">Documentos</dt><dd>{detail.metrics.documentsRequested ? `Pedidos em ${detail.metrics.hoursToDocuments} h` : "Ainda não"}</dd></div>
                  <div><dt className="text-muted-foreground">PDFs enviados</dt><dd className="tabular-nums">{detail.metrics.pdfsSent}</dd></div>
                  <div><dt className="text-muted-foreground">Custo de IA</dt><dd className="tabular-nums">{formatUsd(detail.metrics.costUsd)}</dd></div>
                </dl>
              </Section>

              {handOff && open ? <HandOff dealId={deal.id} onDone={() => { setHandOff(false); load(); }} /> : null}

              {pendingItems.length ? (
                <Section title={`Para aprovar (${pendingItems.length})`} description={deal.mode === "simulation" ? "Em Simulação nada sai. Troque para Copiloto no menu para enviar." : "Edite se quiser e envie. Valores só da cotação; texto editado é conferido de novo."}>
                  {pendingItems.map((item) => <PendingMessage key={item.id} item={item} onDone={load} />)}
                </Section>
              ) : null}

              <Section title="Conversa">
                {detail.conversation.length ? (
                  <ol className="grid gap-2">
                    {detail.conversation.slice(-40).map((turn) => (
                      <li key={turn.id} className={turn.direction === "in" ? "mr-8 rounded-2xl rounded-bl-md bg-muted px-3 py-2 text-sm" : "ml-8 rounded-2xl rounded-br-md border border-border px-3 py-2 text-sm"}>
                        <p className="whitespace-pre-wrap">{turn.body || (turn.kind === "audio" ? "Áudio" : "Arquivo")}</p>
                        <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">{turn.direction === "in" ? "Cliente" : "Assistente"} · {formatWhen(turn.at)}</p>
                      </li>
                    ))}
                  </ol>
                ) : <p className="text-sm text-muted-foreground">Ainda sem mensagens.</p>}
                {detail.outbox.some((item) => item.status === "simulated") ? <p className="text-xs text-muted-foreground">Em Simulação, as mensagens da assistente aparecem em &ldquo;Enviadas e simuladas&rdquo; abaixo.</p> : null}
              </Section>

              <Section title="Ofertas" description="Cada oferta é um retrato da cotação: os valores saem dele e do PDF, nunca da IA.">
                {detail.offers.length ? detail.offers.map((offer) => (
                  <div key={offer.id} className="grid gap-1.5 rounded-[var(--radius-card)] border border-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">Oferta {offer.version}{offer.relaxed ? `, mais em conta (${offer.relaxed})` : ""}</span>
                      {offer.hasPdf ? <Button size="sm" variant="outline" render={<a href={`/api/auto-sale/offers/${offer.id}/pdf`} target="_blank" rel="noreferrer" />}><FileArrowDown className="size-3.5" /> PDF</Button> : null}
                    </div>
                    <ul className="grid gap-0.5 text-xs">
                      {offer.plans.map((plan) => (
                        <li key={plan.id} className="flex justify-between gap-2">
                          <span className="truncate">{plan.operator} {plan.name}{plan.id === offer.recommendedPlanId ? " (recomendado)" : ""}{plan.state !== "ready" ? ", em conferência" : ""}</span>
                          <span className="shrink-0 tabular-nums">{formatCents(plan.totalCents)}</span>
                        </li>
                      ))}
                    </ul>
                    {offer.reason ? <p className="text-xs text-muted-foreground">{offer.reason}</p> : null}
                    <p className="text-xs text-muted-foreground">{offer.linkViews ? `Cliente abriu o link ${offer.linkViews === 1 ? "1 vez" : `${offer.linkViews} vezes`}.` : "Cliente ainda não abriu o link."}</p>
                  </div>
                )) : <p className="text-sm text-muted-foreground">Ainda sem cotação.</p>}
              </Section>

              <Section title="Decisões da IA">
                {detail.decisions.length ? (
                  <ol className="grid gap-1.5 text-xs">
                    {detail.decisions.slice(-20).reverse().map((turn) => (
                      <li key={turn.id} className="grid gap-0.5 border-b border-border/60 pb-1.5">
                        <span className="font-medium">{turn.kind === "link_viewed" ? turn.body : turn.kind === "manager_called" ? `Chamou você: ${turn.body}` : `A assistente ${ACTION_LABEL[String(turn.decision?.action ?? "")] ?? "decidiu"}${turn.intent ? `; cliente ${INTENT_LABEL[turn.intent] ?? turn.intent}` : ""}${turn.objection ? `; objeção: ${OBJECTION_LABEL[turn.objection] ?? turn.objection}` : ""}`}</span>
                        {turn.guard?.length ? <span className="text-muted-foreground">Barrado pelas regras: {turn.guard.map((item) => (item as { rule?: string }).rule).join(", ")}</span> : null}
                        <span className="tabular-nums text-muted-foreground">{formatWhen(turn.at)}{turn.model ? ` · ${turn.model}` : ""}</span>
                      </li>
                    ))}
                  </ol>
                ) : <p className="text-sm text-muted-foreground">Nenhuma decisão ainda.</p>}
              </Section>

              <Section title="Enviadas e simuladas">
                <ul className="grid gap-1 text-xs">
                  {detail.outbox.filter((item) => !["draft", "held"].includes(item.status)).slice(-30).map((item) => (
                    <li key={item.id} className="flex justify-between gap-3">
                      <span className="min-w-0 truncate">{KIND_LABEL[item.kind]}: {item.body || item.mediaFilename}</span>
                      <span className="shrink-0 text-muted-foreground">{OUTBOX_LABEL[item.status]}</span>
                    </li>
                  ))}
                </ul>
              </Section>
            </>
          ) : <p className="p-4 text-sm text-muted-foreground">{error ?? "Carregando…"}</p>}
        </SheetBody>
        {deal && open ? (
          <SheetFooter>
            {deal.status === "paused" || deal.status === "waiting_manager" ? (
              <Button type="button" variant="outline" disabled={pending} onClick={() => run({ op: "resume", dealId: deal.id }, "A assistente voltou a conduzir.")}>{deal.status === "waiting_manager" ? "Devolver ao agente" : "Retomar"}</Button>
            ) : (
              <Button type="button" variant="outline" disabled={pending} onClick={() => run({ op: "pause", dealId: deal.id }, "Negociação pausada.")}>Pausar</Button>
            )}
            <Button type="button" disabled={pending} onClick={() => run({ op: "take_over", dealId: deal.id }, "Você assumiu. A assistente parou e o lead segue com você em Conversas.")}>Assumir</Button>
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
