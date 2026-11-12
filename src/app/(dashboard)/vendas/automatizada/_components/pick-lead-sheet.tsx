"use client";

import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { DsSegmentedControl } from "@/components/ui/ds-segmented-control";
import { Input } from "@/components/ui/input";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetSection, SheetSectionHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "@/components/ui/sonner";
import { Switch } from "@/components/ui/switch";
import { getAutoSaleChannelsAction, searchAutoSaleLeadsAction, startAutoSaleDealAction } from "@/features/auto-sale/actions";
import type { AutoSaleChannel, AutoSaleMode } from "@/features/auto-sale/contracts";
import { INELIGIBLE_LABEL } from "@/features/auto-sale/eligibility";
import type { EligibleLead } from "@/features/auto-sale/service";

const TEMPERATURE: Record<string, string> = { hot: "Quente", warm: "Morno", cold: "Frio" };

/** Escolher lead quente: busca, "Só quentes" ligado, motivo de quem não pode, canal e modo explícitos. */
export function PickLeadSheet({ open, onOpenChange, autopilotAllowed, onStarted, previewLeads }: { open: boolean; onOpenChange: (open: boolean) => void; autopilotAllowed: boolean; onStarted: (dealId: string) => void; previewLeads?: EligibleLead[] }) {
  const [query, setQuery] = useState("");
  const [onlyHot, setOnlyHot] = useState(true);
  const [leads, setLeads] = useState<EligibleLead[] | null>(previewLeads ?? null);
  const [selected, setSelected] = useState<EligibleLead | null>(null);
  const [channel, setChannel] = useState<AutoSaleChannel>("meta");
  const [wahaNumbers, setWahaNumbers] = useState<{ id: string; label: string }[]>([]);
  const [wahaNumberId, setWahaNumberId] = useState<string | null>(null);
  const [mode, setMode] = useState<AutoSaleMode>("copilot");
  const [loading, startLoading] = useTransition();
  const [starting, startStarting] = useTransition();

  const search = (nextQuery = query, nextOnlyHot = onlyHot) => startLoading(async () => {
    const result = await searchAutoSaleLeadsAction({ query: nextQuery, onlyHot: nextOnlyHot });
    if (!result.ok) { toast.error(result.error); return; }
    setLeads(result.data);
  });

  // O pai remonta o painel a cada abertura (key), então o estado começa limpo.
  useEffect(() => {
    if (open && leads === null) search("", true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const choose = (lead: EligibleLead) => {
    setSelected(lead);
    setChannel("meta");
    setWahaNumberId(null);
    startLoading(async () => {
      const result = await getAutoSaleChannelsAction(lead.id);
      setWahaNumbers(result.ok ? result.data : []);
    });
  };

  const start = () => {
    if (!selected) return;
    startStarting(async () => {
      const result = await startAutoSaleDealAction({ leadId: selected.id, channel, wahaNumberId: channel === "waha" ? wahaNumberId : null, mode });
      if (!result.ok) { toast.error(result.error); return; }
      toast.success(mode === "simulation" ? "Negociação em Simulação: nada é enviado." : "Negociação criada. Aprove a primeira mensagem.");
      setLeads(null);
      onStarted(result.data.dealId);
    });
  };

  const modeOptions = [
    { value: "simulation" as const, label: "Simulação" },
    { value: "copilot" as const, label: "Copiloto" },
    ...(autopilotAllowed ? [{ value: "autopilot" as const, label: "Autopiloto" }] : []),
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="data-[side=right]:w-[min(100vw-1rem,38rem)]">
        <SheetHeader>
          <SheetTitle>Escolher lead quente</SheetTitle>
          <SheetDescription>Só entra lead sem corretor, com telefone e base legal. Enquanto a negociação estiver aberta, ele sai da distribuição e a IA de qualificação para.</SheetDescription>
        </SheetHeader>
        <SheetBody>
          {!selected ? (
            <SheetSection>
              <SheetSectionHeader>
                <div className="flex w-full flex-wrap items-center gap-3">
                  <Input className="min-w-0 flex-1 basis-full sm:basis-0" value={query} placeholder="Nome ou telefone" aria-label="Buscar lead" onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); search(); } }} />
                  <label className="flex items-center gap-2 text-sm">
                    <Switch checked={onlyHot} onCheckedChange={(checked) => { setOnlyHot(checked); search(query, checked); }} aria-label="Só quentes" />
                    Só quentes
                  </label>
                  <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => search()}>{loading ? "Buscando…" : "Buscar"}</Button>
                </div>
              </SheetSectionHeader>
              <ul className="grid gap-2 p-4" aria-live="polite" aria-busy={loading}>
                {leads === null ? <li className="text-sm text-muted-foreground">Carregando…</li> : null}
                {leads?.length === 0 ? <li className="text-sm text-muted-foreground">Nenhum lead encontrado. Tire o filtro &ldquo;Só quentes&rdquo; ou busque pelo nome.</li> : null}
                {leads?.map((lead) => {
                  const blocked = lead.reasons.length > 0;
                  return (
                    <li key={lead.id}>
                      <button type="button" disabled={blocked} onClick={() => choose(lead)} className="grid min-h-11 w-full gap-0.5 rounded-[var(--radius-card)] border border-border px-3 py-2 text-left transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-60">
                        <span className="flex items-center justify-between gap-2 text-sm font-medium">
                          <span className="truncate">{lead.nome}</span>
                          <span className="shrink-0 text-xs font-normal text-muted-foreground">{TEMPERATURE[lead.qualificationStatus] ?? "Sem temperatura"}</span>
                        </span>
                        <span className="text-xs text-muted-foreground">{blocked ? lead.reasons.map((reason) => INELIGIBLE_LABEL[reason]).join(", ") : "Pode entrar no piloto"}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </SheetSection>
          ) : (
            <>
              <SheetSection>
                <SheetSectionHeader>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{selected.nome}</p>
                    <p className="text-xs text-muted-foreground">A assistente se apresenta como assistente virtual da corretora e confirma o que a qualificação já coletou.</p>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(null)}>Trocar</Button>
                </SheetSectionHeader>
              </SheetSection>
              <SheetSection>
                <SheetSectionHeader><p className="text-sm font-medium">Canal</p></SheetSectionHeader>
                <div className="grid gap-2 p-4">
                  <DsSegmentedControl aria-label="Canal" value={channel} onValueChange={(value) => setChannel(value as AutoSaleChannel)} options={[{ value: "meta", label: "Meta oficial" }, { value: "waha", label: "WAHA", disabled: !wahaNumbers.length }]} />
                  {channel === "waha" ? (
                    <div className="grid gap-1.5">
                      {wahaNumbers.map((number) => (
                        <label key={number.id} className="flex min-h-11 items-center gap-2 text-sm">
                          <input type="radio" name="waha-number" checked={wahaNumberId === number.id} onChange={() => setWahaNumberId(number.id)} />
                          {number.label}
                        </label>
                      ))}
                    </div>
                  ) : null}
                  <p className="text-xs leading-5 text-muted-foreground">
                    {channel === "meta"
                      ? "Meta: texto, PDF e imagens dentro da janela de 24 h. Fora dela, só template aprovado; sem template, a mensagem fica retida e você vê o motivo."
                      : wahaNumbers.length ? "WAHA: só texto, pelo número em que o cliente já escreveu, com os limites anti-ban. PDF e imagens vão pela Meta se a janela estiver aberta; senão ficam retidos para você baixar." : "Nenhum número WAHA recebeu mensagem deste cliente. Use a Meta oficial."}
                  </p>
                </div>
              </SheetSection>
              <SheetSection>
                <SheetSectionHeader><p className="text-sm font-medium">Modo</p></SheetSectionHeader>
                <div className="grid gap-2 p-4">
                  <DsSegmentedControl aria-label="Modo" value={mode} onValueChange={(value) => setMode(value as AutoSaleMode)} options={modeOptions} />
                  <p className="text-xs leading-5 text-muted-foreground">
                    {mode === "simulation" ? "A assistente escreve e nada sai. Bom para testar." : mode === "copilot" ? "Cada mensagem espera você aprovar, editar e enviar." : "A assistente envia sozinha, só planos revisados, com limites por hora e por dia."}
                  </p>
                </div>
              </SheetSection>
            </>
          )}
        </SheetBody>
        <SheetFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" disabled={!selected || starting || (channel === "waha" && !wahaNumberId)} onClick={start}>{starting ? "Começando…" : "Começar negociação"}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
