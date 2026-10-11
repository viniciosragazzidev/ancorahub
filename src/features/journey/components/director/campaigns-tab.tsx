"use client";

import { useMemo, useState, useTransition } from "react";
import { Flag, Plus } from "lucide-react";

import { DsEmptyState } from "@/components/ui/ds-empty-state";
import { DsFilledDarkCta } from "@/components/ui/ds-filled-dark-cta";
import { DsInputField } from "@/components/ui/ds-input-field";
import { DsOutlinedActionButton } from "@/components/ui/ds-outlined-action-button";
import { DsSectionHeader } from "@/components/ui/ds-section-header";
import { DsSegmentedControl } from "@/components/ui/ds-segmented-control";
import { DsSheet, DsSheetBody, DsSheetContent, DsSheetDescription, DsSheetFooter, DsSheetHeader, DsSheetTitle } from "@/components/ui/ds-sheet";
import { DsStatusBadge } from "@/components/ui/ds-status-badge";
import type { MissionMetric } from "@/features/engagement/journey-types";
import type { CreateJourneyCampaignInput, JourneyActionResponse, JourneyCampaignAudienceOptions, JourneyCampaignRow } from "@/features/journey/director-types";

export const METRIC_LABEL: Partial<Record<MissionMetric | "steps.coverage", string>> = {
  "contacts.evidenced": "Primeiros contatos com evidência",
  "contacts.on_time": "Primeiros contatos no prazo",
  "contacts.fast_coverage": "Leads com 1º contato em até 5 min (%)",
  "contacts.days_on_time": "Dias com todo contato no prazo",
  "offers.fast_coverage": "Ofertas aceitas em até 1 min (%)",
  "returns.cleared": "Retornos vencidos zerados",
  "notes.coverage": "Atendimentos registrados (%)",
  "sla.no_breach": "Dias sem prazo estourado",
  "steps.coverage": "Leads com etapa registrada (%)",
};
const CAMPAIGN_METRICS = ["contacts.evidenced", "contacts.on_time", "contacts.days_on_time", "returns.cleared", "notes.coverage", "sla.no_breach"] as const;
type AudienceKind = "all" | "branches" | "teams" | "duties" | "brokers";

const date = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
const todayKey = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const plusDays = (days: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(Date.now() + days * 86_400_000));
const fieldClass = "h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground";

/** Campaigns: a goal from the catalog, a bonus and an audience, for a period. */
export function CampaignsTab({ campaigns, audience, onCreate, onPause }: {
  campaigns: JourneyCampaignRow[] | null;
  audience: JourneyCampaignAudienceOptions | null;
  onCreate?: (input: CreateJourneyCampaignInput) => Promise<JourneyActionResponse<JourneyCampaignRow>>;
  onPause?: (campaignId: string) => Promise<JourneyActionResponse>;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState(campaigns ?? []);
  const [pausing, startPause] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const available = Boolean(audience?.available && onCreate);

  function pause(id: string) {
    if (!onPause) return;
    startPause(async () => {
      const result = await onPause(id);
      if (!result.ok) { setNotice(result.message); return; }
      setRows((current) => current.map((row) => (row.id === id ? { ...row, status: "inactive" } : row)));
      setNotice("Campanha pausada.");
    });
  }

  return (
    <div className="mt-ds-24 space-y-ds-16 ds-fade">
      <DsSectionHeader
        title="Campanhas"
        description="Uma meta com bônus para um público, por um período. Aparece na jornada de quem participa, com o progresso ao vivo."
        actions={available ? <DsFilledDarkCta onClick={() => setOpen(true)}><span className="inline-flex items-center gap-1.5"><Plus size={14} aria-hidden="true" />Nova campanha</span></DsFilledDarkCta> : null}
      />
      {notice ? <p role="status" className="text-sm text-muted-foreground">{notice}</p> : null}
      {!audience?.available ? (
        <DsEmptyState bordered icon={<Flag size={18} />} title="Campanhas desligadas" description="Ligue as campanhas no Super admin para criar a primeira." />
      ) : rows.length ? (
        <ul className="grid gap-3 md:grid-cols-2">
          {rows.map((campaign) => {
            const active = campaign.status === "active";
            return (
              <li key={campaign.id} className="space-y-3 rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{campaign.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{METRIC_LABEL[campaign.metric] ?? campaign.metric} · meta {campaign.target}</p>
                  </div>
                  <DsStatusBadge status={active ? "success" : "secondary"} label={active ? "Ativa" : "Pausada"} />
                </div>
                {campaign.description ? <p className="text-sm text-muted-foreground">{campaign.description}</p> : null}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>+{campaign.bonusPoints} pts · {campaign.startsAt ? date.format(new Date(campaign.startsAt)) : "agora"} até {campaign.endsAt ? date.format(new Date(campaign.endsAt)) : "sem fim"}</span>
                  {active && onPause ? <DsOutlinedActionButton loading={pausing} onClick={() => pause(campaign.id)}>Pausar</DsOutlinedActionButton> : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <DsEmptyState bordered icon={<Flag size={18} />} title="Nenhuma campanha ainda" description="Ex.: Semana PME, 3 cotações PME, +100 pts para a unidade Centro." action={available ? <DsFilledDarkCta onClick={() => setOpen(true)}>Criar a primeira</DsFilledDarkCta> : undefined} />
      )}
      {audience && onCreate ? <CampaignSheet open={open} onOpenChange={setOpen} audience={audience} onCreate={async (input) => { const result = await onCreate(input); if (result.ok) { setRows((current) => [result.data, ...current]); setNotice("Campanha criada. Ela já aparece na jornada de quem participa."); } return result; }} /> : null}
    </div>
  );
}

function CampaignSheet({ open, onOpenChange, audience, onCreate }: { open: boolean; onOpenChange: (open: boolean) => void; audience: JourneyCampaignAudienceOptions; onCreate: (input: CreateJourneyCampaignInput) => Promise<JourneyActionResponse<JourneyCampaignRow>> }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [metric, setMetric] = useState<MissionMetric>("contacts.evidenced");
  const [target, setTarget] = useState(10);
  const [bonus, setBonus] = useState(50);
  const [startsAt, setStartsAt] = useState(todayKey());
  const [endsAt, setEndsAt] = useState(plusDays(6));
  const [kind, setKind] = useState<AudienceKind>("all");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const options = useMemo(() => {
    const list: { value: AudienceKind; label: string; count?: number }[] = [{ value: "all", label: "Todo o meu escopo" }];
    if (audience.branches.length > 1) list.push({ value: "branches", label: "Unidades", count: audience.branches.length });
    if (audience.teams.length) list.push({ value: "teams", label: "Equipes", count: audience.teams.length });
    if (audience.duties.length) list.push({ value: "duties", label: "Plantões", count: audience.duties.length });
    list.push({ value: "brokers", label: "Pessoas", count: audience.brokers.length });
    return list;
  }, [audience]);
  const items = kind === "branches" ? audience.branches : kind === "teams" ? audience.teams : kind === "duties" ? audience.duties : kind === "brokers" ? audience.brokers : [];
  const invalid = title.trim().length < 3 ? "Dê um nome para a campanha." : target < 1 ? "A meta precisa ser maior que zero." : bonus < 1 || bonus > 500 ? "O bônus vai de 1 a 500 pontos." : endsAt < startsAt ? "O fim precisa ser depois do começo." : kind !== "all" && !picked.size ? "Escolha quem participa." : null;

  function submit() {
    if (invalid) { setError(invalid); return; }
    setError(null);
    const ids = [...picked];
    const input: CreateJourneyCampaignInput = {
      title: title.trim(), description: description.trim() || undefined, metric, target, bonusPoints: bonus,
      startsAt: `${startsAt}T00:00:00-03:00`, endsAt: `${endsAt}T23:59:59-03:00`,
      audience: kind === "branches" ? { branchIds: ids } : kind === "teams" ? { supervisorIds: ids } : kind === "duties" ? { dutyScheduleIds: ids } : kind === "brokers" ? { userIds: ids } : {},
    };
    start(async () => {
      const result = await onCreate(input);
      if (!result.ok) { setError(result.message); return; }
      onOpenChange(false);
      setTitle(""); setDescription(""); setPicked(new Set());
    });
  }

  return (
    <DsSheet open={open} onOpenChange={onOpenChange}>
      <DsSheetContent>
        <DsSheetHeader>
          <DsSheetTitle>Nova campanha</DsSheetTitle>
          <DsSheetDescription>Os pontos só contam com evidência, como no resto da jornada.</DsSheetDescription>
        </DsSheetHeader>
        <DsSheetBody className="space-y-5">
          <label className="block space-y-1.5"><span className="text-sm font-medium">Nome</span><DsInputField value={title} maxLength={80} onChange={(event) => setTitle(event.target.value)} placeholder="Semana PME" /></label>
          <label className="block space-y-1.5"><span className="text-sm font-medium">Descrição <span className="font-normal text-muted-foreground">(opcional)</span></span><DsInputField value={description} maxLength={200} onChange={(event) => setDescription(event.target.value)} placeholder="O que vale e por quê" /></label>
          <label className="block space-y-1.5"><span className="text-sm font-medium">O que conta</span>
            <select className={fieldClass} value={metric} onChange={(event) => setMetric(event.target.value as MissionMetric)}>
              {CAMPAIGN_METRICS.map((item) => <option key={item} value={item}>{METRIC_LABEL[item]}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1.5"><span className="text-sm font-medium">Meta</span><DsInputField type="number" min={1} max={1000} value={target} onChange={(event) => setTarget(Number(event.target.value) || 0)} /></label>
            <label className="block space-y-1.5"><span className="text-sm font-medium">Bônus (pts)</span><DsInputField type="number" min={1} max={500} value={bonus} onChange={(event) => setBonus(Number(event.target.value) || 0)} /></label>
            <label className="block space-y-1.5"><span className="text-sm font-medium">Começa</span><DsInputField type="date" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></label>
            <label className="block space-y-1.5"><span className="text-sm font-medium">Termina</span><DsInputField type="date" value={endsAt} min={startsAt} onChange={(event) => setEndsAt(event.target.value)} /></label>
          </div>
          <div className="space-y-2">
            <span className="text-sm font-medium" aria-hidden="true">Quem participa</span>
            <DsSegmentedControl aria-label="Quem participa" options={options} value={kind} onValueChange={(value) => { setKind(value as AudienceKind); setPicked(new Set()); }} />
            {kind === "all" ? <p className="text-xs text-muted-foreground">Todos os corretores que você enxerga hoje.</p> : (
              <ul className="max-h-56 divide-y divide-border overflow-y-auto rounded-lg border border-border">
                {items.map((item) => (
                  <li key={item.id}>
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted/60">
                      <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={picked.has(item.id)} onChange={() => setPicked((current) => { const next = new Set(current); if (next.has(item.id)) next.delete(item.id); else next.add(item.id); return next; })} />
                      <span className="min-w-0 flex-1 truncate">{item.name}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        </DsSheetBody>
        <DsSheetFooter>
          <DsOutlinedActionButton onClick={() => onOpenChange(false)}>Cancelar</DsOutlinedActionButton>
          <DsFilledDarkCta loading={pending} onClick={submit}>Criar campanha</DsFilledDarkCta>
        </DsSheetFooter>
      </DsSheetContent>
    </DsSheet>
  );
}
