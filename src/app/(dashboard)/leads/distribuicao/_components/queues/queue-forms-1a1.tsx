"use client";

/**
 * Formulários da aba Filas no Lite (27/11/2026): criar ou editar fila numa gaveta de 560px por seções, excluir fila na
 * confirmação do Lite (com as pendências) e o simulador numa gaveta. Mesmos campos, regras e envios de antes; o estado
 * continua no QueueControlCenter.
 */
import { useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";

import { LiteSelect } from "@/components/lite/controls";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { QueueDependencyInfo } from "@/features/lead-distribution/actions";
import { circularHueDistance, pickDistinctHue, QUEUE_COLOR_SWATCHES } from "@/features/lead-distribution/queue-color";
import { QueueColorDot } from "@/features/lead-distribution/queue-color-tag";
import { QUEUE_SOURCE_OPTIONS } from "@/features/lead-distribution/routing-catalog";
import { cn } from "@/lib/utils";
import { PlConfirm, PlField, PlSection, PlSegmented, PlSheet, SearchIcon, pl } from "../../plantao/_components/plantoes-1a1-kit";
import { Note1a1, ToggleRow1a1, pn } from "../panels-1a1";
import type { DutySchedule, Queue } from "./types";

export type QueueFormState = {
  branchId: string;
  exclusiveDutyScheduleId: string;
  exclusiveDutyScheduleIds: string[];
  dutyFallbackPolicy: "unit_roster" | "wait_next_duty" | "fallback_queue";
  dutyFallbackQueueId: string;
  allowedBranchIds: string[];
  brokerScopeMode: "all" | "selected";
  allowedBrokerIds: string[];
  allowedSourceIds: string[];
  name: string;
  assignmentMode: string;
  assignmentStrategy: string;
  capacityEnabled: boolean;
  capacityPerBroker: string;
  offerIntervalMinutes: string;
  maxPendingOffersPerBroker: string;
  aiQualificationEnabled: boolean;
  holdColdLeads: boolean;
  coldLeadRequalification: { enabled: boolean; intervalMinutes: string; maxAttempts: string };
  attendanceFlowId: string | null;
  status: string;
  colorHue: number | null;
};

const DUTY_DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;

type Branch = { id: string; name: string };
type Broker = { id: string; name: string; branchId?: string | null; branchName?: string | null };

function CheckLine({ checked, onChange, disabled, title, meta, aside }: { checked: boolean; onChange: () => void; disabled?: boolean; title: ReactNode; meta?: ReactNode; aside?: ReactNode }) {
  return (
    <label className={cn(pl.checkRow, disabled && pl.checkRowOff)}>
      <input type="checkbox" className={pl.checkBox} checked={checked} disabled={disabled} onChange={onChange} />
      <span className={pn.rowBody}><span className={pn.rowTitle}>{title}</span>{meta ? <span className={pn.rowMeta}>{meta}</span> : null}</span>
      {aside}
    </label>
  );
}

export function QueueEditor1a1({
  open, onOpenChange, editingId, form, setForm, branches, dutySchedules, queues, availableBrokers, effectiveAllowedBranchIds,
  otherColors, attendanceFlows, saving, onSave, onConfigureEntries,
  onBranchChange, onToggleBranch, onToggleBroker, onToggleDuty, onFallbackPolicy, onToggleSource,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingId: string | null;
  form: QueueFormState;
  setForm: Dispatch<SetStateAction<QueueFormState>>;
  branches: Branch[];
  dutySchedules: DutySchedule[];
  queues: Queue[];
  availableBrokers: Broker[];
  effectiveAllowedBranchIds: string[];
  otherColors: Array<{ name: string; hue: number | null }>;
  attendanceFlows: Array<{ id: string; name: string; description: string | null }> | null;
  saving: boolean;
  onSave: () => void;
  onConfigureEntries: () => void;
  onBranchChange: (branchId: string) => void;
  onToggleBranch: (branchId: string) => void;
  onToggleBroker: (brokerId: string) => void;
  onToggleDuty: (scheduleId: string) => void;
  onFallbackPolicy: (policy: "unit_roster" | "wait_next_duty" | "fallback_queue") => void;
  onToggleSource: (sourceId: string) => void;
}) {
  const [brokerQuery, setBrokerQuery] = useState("");
  const nearest = useMemo(() => {
    if (typeof form.colorHue !== "number") return null;
    const hue = form.colorHue;
    const found = otherColors
      .map((entry) => ({ ...entry, distance: typeof entry.hue === "number" ? circularHueDistance(hue, entry.hue) : Infinity }))
      .sort((a, b) => a.distance - b.distance)[0];
    return found && found.distance < 18 ? found : null;
  }, [form.colorHue, otherColors]);
  const brokers = useMemo(() => {
    const needle = brokerQuery.trim().toLocaleLowerCase("pt-BR");
    return needle ? availableBrokers.filter((broker) => `${broker.name} ${broker.branchName ?? ""}`.toLocaleLowerCase("pt-BR").includes(needle)) : availableBrokers;
  }, [availableBrokers, brokerQuery]);
  const hasDuty = form.exclusiveDutyScheduleIds.length > 0;
  const fallbackQueues = queues.filter((queue) => queue.id !== editingId && queue.status === "active");

  return (
    <PlSheet
      open={open}
      onOpenChange={onOpenChange}
      width={560}
      title={editingId ? "Editar fila" : "Nova fila"}
      description="As mudanças valem para os próximos leads distribuídos. Leads já atribuídos mantêm o histórico."
      footer={(
        <>
          <button type="button" className={cn(pl.pill, pl.pillGhost)} disabled={saving} onClick={() => onOpenChange(false)}>Cancelar</button>
          <button type="button" className={cn(pl.pill, pl.pillPrimary, pl.pillWide)} disabled={saving || !form.name.trim()} onClick={onSave}>{saving ? "Salvando…" : editingId ? "Salvar fila" : "Criar fila"}</button>
        </>
      )}
    >
      <PlSection title="Fila">
        <PlField label="Nome da fila" htmlFor="queue-name">
          <input id="queue-name" className={pl.input} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Ex.: Leads quentes, Plantão Central" />
        </PlField>
        <PlField as="p" label={<span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>Cor da fila<button type="button" className={cn(pl.pill, pl.pillGhost, pl.pillSm)} onClick={() => setForm({ ...form, colorHue: pickDistinctHue(otherColors.map((entry) => entry.hue), { jitter: true }) })}>Aleatória</button></span>}>
          <div className={pn.chips} role="radiogroup" aria-label="Cor da fila">
            {QUEUE_COLOR_SWATCHES.map((hue) => (
              <button key={hue} type="button" role="radio" aria-checked={form.colorHue === hue} aria-label={`Cor ${hue}`} className={pn.chip} style={{ padding: 0, width: 40, justifyContent: "center" }} onClick={() => setForm({ ...form, colorHue: hue })}>
                <QueueColorDot hue={hue} className="size-4" />
              </button>
            ))}
          </div>
          {nearest ? <Note1a1 tone="warning">Cor parecida com a fila “{nearest.name}”. Pode continuar, mas fica mais fácil confundir na tabela.</Note1a1> : null}
        </PlField>
        <LiteSelect label="Unidade principal (opcional)" value={form.branchId} onChange={onBranchChange} searchPlaceholder="Buscar unidade"
          options={[{ value: "", label: "Todas as unidades" }, ...branches.map((branch) => ({ value: branch.id, label: branch.name }))]} />
        <PlField as="p" label="Estado">
          <PlSegmented label="Estado da fila" value={form.status} onChange={(status) => setForm({ ...form, status })} options={[{ value: "active", label: "Ativa" }, { value: "inactive", label: "Pausada" }]} />
        </PlField>
      </PlSection>

      <PlSection title={<>Plantões{hasDuty ? <span className={cn(pl.badge, pl.num)} style={{ marginLeft: 8 }}>{form.exclusiveDutyScheduleIds.length}</span> : null}</>}
        hint="Escolha um ou mais plantões. A fila só usa corretores escalados nos plantões ativos escolhidos; sem seleção, segue a disponibilidade normal da unidade.">
        {dutySchedules.length ? (
          <ScrollArea className={pn.scrollList}>
            <ul className={pn.list}>
              {dutySchedules.map((duty) => (
                <li key={duty.id}>
                  <CheckLine checked={form.exclusiveDutyScheduleIds.includes(duty.id)} onChange={() => onToggleDuty(duty.id)} title={duty.name}
                    meta={`${duty.startsAt} às ${duty.endsAt}${duty.branchName ? ` · ${duty.branchName}` : ""}`}
                    aside={typeof duty.dayOfWeek === "number" && duty.dayOfWeek >= 0 && duty.dayOfWeek <= 6 ? <span className={pl.badge}>{DUTY_DAY_LABELS[duty.dayOfWeek]}</span> : null} />
                </li>
              ))}
            </ul>
          </ScrollArea>
        ) : <p className={pl.emptyBox}>Nenhum plantão ativo disponível.</p>}
        {hasDuty ? (
          <>
            <PlField as="p" label="Quando nenhum plantão escolhido estiver ativo" hint="Fora do horário dessas escalas, nenhum corretor recebe lead desta fila.">
              <PlSegmented label="Quando nenhum plantão estiver ativo" value={form.dutyFallbackPolicy === "fallback_queue" ? "fallback_queue" : "wait_next_duty"} onChange={onFallbackPolicy}
                options={[
                  { value: "wait_next_duty", label: "Aguardar o próximo plantão", sub: "o lead fica na fila" },
                  { value: "fallback_queue", label: "Enviar para outra fila", sub: "fila de contingência" },
                ]} />
            </PlField>
            {form.dutyFallbackPolicy === "fallback_queue" ? (
              <div className={pl.field}>
                <LiteSelect label="Fila de contingência" value={form.dutyFallbackQueueId} onChange={(value) => setForm((prev) => ({ ...prev, dutyFallbackQueueId: value }))} searchPlaceholder="Buscar fila" placeholder="Selecione uma fila ativa"
                  options={fallbackQueues.map((queue) => ({ value: queue.id, label: `${queue.name}${queue.branchName ? ` · ${queue.branchName}` : ""}` }))} />
                <p className={pl.small}>A fila não pode apontar para ela mesma nem formar um ciclo de contingência.</p>
              </div>
            ) : (
              <Note1a1 tone="warning">Sem plantão ativo agora, os leads ficam aguardando nesta fila e são reavaliados automaticamente no próximo ciclo.</Note1a1>
            )}
          </>
        ) : null}
      </PlSection>

      {branches.length > 1 ? (
        <PlSection title="Unidades adicionais" hint={form.branchId ? "Marque outras unidades que também poderão enviar ou compartilhar corretores para esta fila." : "A unidade principal é “Todas as unidades”: esta fila já atende todas, nada para marcar aqui."}>
          <ScrollArea className={pn.scrollList}>
            <ul className={pn.list}>
              {branches.filter((branch) => branch.id !== form.branchId).map((branch) => (
                <li key={branch.id}><CheckLine checked={effectiveAllowedBranchIds.includes(branch.id)} disabled={!form.branchId} onChange={() => onToggleBranch(branch.id)} title={branch.name} /></li>
              ))}
            </ul>
          </ScrollArea>
        </PlSection>
      ) : null}

      <PlSection title="Fontes aceitas" hint="Restrinja a fila a canais específicos. Sem seleção, aceita qualquer origem. Manual e Webhook são fontes exclusivas e não podem estar em outra fila ativa.">
        <ul className={pn.list}>
          {QUEUE_SOURCE_OPTIONS.map((source) => (
            <li key={source.id}>
              <CheckLine checked={form.allowedSourceIds.includes(source.id)} onChange={() => onToggleSource(source.id)} title={source.label} aside={source.singleton ? <span className={pl.badge}>exclusiva</span> : null} />
            </li>
          ))}
        </ul>
        <p className={pl.small}>{form.allowedSourceIds.length ? `${form.allowedSourceIds.length} ${form.allowedSourceIds.length === 1 ? "fonte selecionada" : "fontes selecionadas"}` : "Todas as fontes válidas"}</p>
      </PlSection>

      <PlSection title="Corretores participantes">
        <PlSegmented label="Corretores participantes" value={form.brokerScopeMode} onChange={(value) => setForm({ ...form, brokerScopeMode: value })}
          options={[{ value: "all", label: "Todos os elegíveis" }, { value: "selected", label: "Escolher corretores" }]} />
        {form.brokerScopeMode === "selected" ? (
          <>
            <label className={pl.searchField}>
              <SearchIcon />
              <span className={pl.srOnly}>Buscar corretor</span>
              <input type="search" value={brokerQuery} onChange={(event) => setBrokerQuery(event.target.value)} placeholder="Buscar corretor ou unidade" />
            </label>
            {brokers.length ? (
              <ScrollArea className={pn.scrollList}>
                <ul className={pn.list}>
                  {brokers.map((broker) => (
                    <li key={broker.id}><CheckLine checked={form.allowedBrokerIds.includes(broker.id)} onChange={() => onToggleBroker(broker.id)} title={broker.name} meta={broker.branchName ?? undefined} /></li>
                  ))}
                </ul>
              </ScrollArea>
            ) : <p className={pl.emptyBox}>Nenhum corretor encontrado nas unidades escolhidas.</p>}
            <p className={pl.small}>{form.allowedBrokerIds.length} {form.allowedBrokerIds.length === 1 ? "corretor escolhido" : "corretores escolhidos"}</p>
          </>
        ) : <p className={pl.small}>Todos os corretores ativos e disponíveis nas unidades escolhidas participam da rodada.</p>}
      </PlSection>

      <PlSection title="Distribuição">
        <PlField as="p" label="Destino dos leads">
          <PlSegmented label="Destino dos leads" value={form.assignmentMode} onChange={(assignmentMode) => setForm({ ...form, assignmentMode })}
            options={[{ value: "automatic", label: "Distribuir aos corretores" }, { value: "manual", label: "Ficam na fila" }]} />
        </PlField>
        {form.assignmentMode === "automatic" && hasDuty && form.dutyFallbackPolicy !== "unit_roster" ? (
          <Note1a1>Nos plantões, cada corretor tem sua vez, na ordem em que confirmou presença. Lead expirado ou recusado gasta a vez.</Note1a1>
        ) : form.assignmentMode === "automatic" ? (
          <PlField as="p" label={hasDuty ? "Estratégia fora do plantão" : "Estratégia"}>
            <PlSegmented label="Estratégia de atribuição" value={form.assignmentStrategy} onChange={(assignmentStrategy) => setForm({ ...form, assignmentStrategy })}
              options={[{ value: "capacity", label: "Menor carga" }, { value: "round_robin", label: "Round robin" }]} />
          </PlField>
        ) : (
          <Note1a1>Os leads entram nesta fila e aguardam, sem corretor. Quando você mudar o destino para distribuir, os que estiverem aguardando são distribuídos na hora.</Note1a1>
        )}
        <PlField label="Ofertas pendentes por corretor" htmlFor="queue-pending-offers" hint="Quantas ofertas sem resposta o corretor pode ter ao mesmo tempo. Com 1, o próximo lead só é oferecido depois que o anterior for aceito ou expirar. Use 0 para desativar.">
          <input id="queue-pending-offers" className={pl.input} type="number" min={0} max={20} value={form.maxPendingOffersPerBroker} onChange={(event) => setForm({ ...form, maxPendingOffersPerBroker: event.target.value })} style={{ maxWidth: 160 }} />
        </PlField>
      </PlSection>

      <PlSection title="Automação">
        <ToggleRow1a1 title="Qualificação por IA" hint="O assistente do WhatsApp qualifica automaticamente os leads que chegam a esta fila." checked={form.aiQualificationEnabled} onChange={(checked) => setForm({ ...form, aiQualificationEnabled: checked })} ariaLabel="Ativar qualificação por IA" />
        <ToggleRow1a1 title="Não distribuir leads frios no plantão" hint="Ligado: o plantão desta fila só recebe leads quentes e mornos. Os frios ficam na fila, sem corretor, para você distribuir à mão." checked={form.holdColdLeads} onChange={(checked) => setForm({ ...form, holdColdLeads: checked })} ariaLabel="Não distribuir leads frios no plantão" />
        <ToggleRow1a1 title="Follow-up automático de leads frios" hint="Desligado por padrão. Ligado, envia só se o lead não respondeu ao último convite, entre 8h e 20h no horário de São Paulo." checked={form.coldLeadRequalification.enabled} onChange={(checked) => setForm({ ...form, coldLeadRequalification: { ...form.coldLeadRequalification, enabled: checked } })} ariaLabel="Follow-up automático de leads frios" />
        <div className={pn.grid2}>
          <PlField label="Intervalo (minutos)" htmlFor="queue-cold-interval">
            <input id="queue-cold-interval" className={pl.input} type="number" min={15} max={1440} step={15} value={form.coldLeadRequalification.intervalMinutes} onChange={(event) => setForm({ ...form, coldLeadRequalification: { ...form.coldLeadRequalification, intervalMinutes: event.target.value } })} />
          </PlField>
          <PlField label="Tentativas máximas" htmlFor="queue-cold-attempts">
            <input id="queue-cold-attempts" className={pl.input} type="number" min={1} max={10} value={form.coldLeadRequalification.maxAttempts} onChange={(event) => setForm({ ...form, coldLeadRequalification: { ...form.coldLeadRequalification, maxAttempts: event.target.value } })} />
          </PlField>
        </div>
        {attendanceFlows ? (
          <div className={pl.field}>
            <LiteSelect label="Fluxo de atendimento" value={form.attendanceFlowId ?? ""} onChange={(value) => setForm({ ...form, attendanceFlowId: value || null })} searchPlaceholder="Buscar fluxo"
              options={[{ value: "", label: "Sem fluxo (atendimento atual)" }, ...attendanceFlows.map((flow) => ({ value: flow.id, label: flow.name }))]} />
            <p className={pl.small}>{attendanceFlows.find((flow) => flow.id === form.attendanceFlowId)?.description ?? "Os leads desta fila seguem o atendimento de hoje."}</p>
          </div>
        ) : null}
      </PlSection>

      <PlSection title="Entradas da fila" hint="Campanhas e exceções por anúncio são configuradas no detalhe de cada campanha. Assim, cada entrada tem um único lugar para ser revisada.">
        <button type="button" className={cn(pl.pill, pl.pillQuiet)} style={{ alignSelf: "flex-start" }} onClick={onConfigureEntries}>Configurar entradas</button>
      </PlSection>
    </PlSheet>
  );
}

export function QueueDelete1a1({ open, onOpenChange, target, loading, dependencies, forceDeleting, onDelete, onForceDelete }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: Queue | null;
  loading: boolean;
  dependencies: QueueDependencyInfo | null;
  forceDeleting: boolean;
  onDelete: () => void;
  onForceDelete: () => void;
}) {
  const hasDeps = Boolean(dependencies && (dependencies.campaignRoutes.length || dependencies.adRoutes.length || dependencies.queuedLeads));
  const description = (
    <span style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <span>{target ? `Excluir a fila “${target.name}”?` : "Verificando pendências…"}</span>
      {loading ? <span>Verificando pendências…</span> : dependencies ? (
        hasDeps ? (
          <>
            <span>Pendências encontradas:</span>
            {dependencies.campaignRoutes.length ? <span className={pn.note} style={{ display: "block" }}><strong style={{ fontWeight: 500 }}>{dependencies.campaignRoutes.length} {dependencies.campaignRoutes.length === 1 ? "campanha vinculada" : "campanhas vinculadas"}</strong><br />{dependencies.campaignRoutes.map((route) => route.campaignName ?? route.campaignId).join(", ")}</span> : null}
            {dependencies.adRoutes.length ? <span className={pn.note} style={{ display: "block" }}><strong style={{ fontWeight: 500 }}>{dependencies.adRoutes.length} {dependencies.adRoutes.length === 1 ? "anúncio vinculado" : "anúncios vinculados"}</strong><br />{dependencies.adRoutes.map((route) => route.adName ?? route.adId).join(", ")}</span> : null}
            {dependencies.queuedLeads ? <span className={pn.note} style={{ display: "block" }}><strong style={{ fontWeight: 500 }}>{dependencies.queuedLeads} {dependencies.queuedLeads === 1 ? "lead na fila" : "leads na fila"}</strong><br />Leads sem unidade ficam na inbox geral.</span> : null}
          </>
        ) : <span>Nenhuma pendência encontrada. A fila pode ser excluída normalmente.</span>
      ) : null}
    </span>
  );
  return (
    <PlConfirm
      open={open}
      onOpenChange={onOpenChange}
      title="Excluir fila"
      description={description}
      danger
      pending={forceDeleting || loading}
      confirmLabel={hasDeps ? (forceDeleting ? "Desvinculando…" : "Desvincular e excluir fila") : "Excluir fila"}
      onConfirm={() => { if (!dependencies) return; if (hasDeps) onForceDelete(); else onDelete(); }}
    />
  );
}

export type Simulation1a1 = {
  success: boolean;
  error?: string;
  queue?: { id: string; name: string } | null;
  reason?: string;
  selected?: { id: string; name: string; activeLeads: number; capacity: number | null } | null;
  eligible?: Array<{ id: string; name: string; activeLeads: number; capacity: number | null; score: number }>;
};

export function Simulator1a1({ open, onOpenChange, branches, branchQueues, form, setForm, simulating, simulation, onRun }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branches: Branch[];
  branchQueues: Queue[];
  form: { branchId: string; queueId: string; temperature: string; score: string };
  setForm: (form: { branchId: string; queueId: string; temperature: string; score: string }) => void;
  simulating: boolean;
  simulation: Simulation1a1 | null;
  onRun: () => void;
}) {
  return (
    <PlSheet
      open={open}
      onOpenChange={onOpenChange}
      width={560}
      title="Simular distribuição"
      description="Veja a decisão provável antes de alterar uma regra. A simulação não cria eventos nem altera a fila."
      footer={<button type="button" className={cn(pl.pill, pl.pillPrimary, pl.pillWide)} disabled={simulating || !form.branchId} onClick={onRun}>{simulating ? "Calculando…" : "Executar simulação"}</button>}
    >
      <PlSection title="Lead simulado">
        <div className={pn.grid2}>
          <LiteSelect label="Unidade" value={form.branchId} onChange={(branchId) => setForm({ ...form, branchId, queueId: "" })} searchPlaceholder="Buscar unidade" options={branches.map((branch) => ({ value: branch.id, label: branch.name }))} />
          <LiteSelect label="Fila" value={form.queueId} onChange={(queueId) => setForm({ ...form, queueId })} searchPlaceholder="Buscar fila" options={[{ value: "", label: "Fila padrão da unidade" }, ...branchQueues.map((queue) => ({ value: queue.id, label: queue.name }))]} />
        </div>
        <PlField as="p" label="Temperatura">
          <PlSegmented label="Temperatura do lead simulado" value={form.temperature} onChange={(temperature) => setForm({ ...form, temperature })} options={[{ value: "hot", label: "Quente" }, { value: "warm", label: "Morno" }, { value: "cold", label: "Frio" }]} />
        </PlField>
        <PlField label="Score" htmlFor="sim-score">
          <input id="sim-score" className={pl.input} type="number" min={0} max={100} value={form.score} onChange={(event) => setForm({ ...form, score: event.target.value })} style={{ maxWidth: 160 }} />
        </PlField>
      </PlSection>

      {simulation?.success ? (
        <PlSection title="Resultado">
          <div className={pn.toggle} style={{ flexDirection: "column", gap: 8 }}>
            <p className={pn.toggleTitle}>{simulation.queue?.name ?? "Sem fila resolvida"}</p>
            {simulation.reason ? <p className={pl.small}>{simulation.reason}</p> : null}
            {simulation.selected ? (
              <p className={pl.small} style={{ color: "var(--foreground)" }}>
                Destino provável: <strong style={{ fontWeight: 500 }}>{simulation.selected.name}</strong> · {simulation.selected.activeLeads} {simulation.selected.activeLeads === 1 ? "lead ativo" : "leads ativos"}{simulation.selected.capacity ? ` de ${simulation.selected.capacity}` : ""}
              </p>
            ) : null}
          </div>
          {simulation.eligible?.length ? (
            <ScrollArea className={pn.scrollList}>
              <ul className={pn.list}>
                {simulation.eligible.map((broker) => (
                  <li key={broker.id} className={pn.row}>
                    <span className={pn.rowBody}><span className={pn.rowTitle}>{broker.name}</span></span>
                    <span className={pn.rowMeta}>{broker.activeLeads}{broker.capacity ? `/${broker.capacity}` : ""} · score {broker.score}</span>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          ) : null}
        </PlSection>
      ) : null}
    </PlSheet>
  );
}
