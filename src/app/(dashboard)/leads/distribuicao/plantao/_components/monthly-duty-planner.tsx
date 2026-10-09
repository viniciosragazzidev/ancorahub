"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

import { FileArrowDown, Loader2Icon, Plus, Sparkle, Trash, Warning, X } from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogPanel, DialogPopup, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchAddList } from "@/components/ui/search-add-list";
import { AppSelect } from "@/components/ui/select";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/sonner";
import {
  generateMonthlyDutyPlanAction,
  getMonthlyDutyPlanAction,
  publishMonthlyDutyPlanAction,
  updateMonthlyDutyDraftAction,
  type MonthlyDutyPlanView,
} from "@/features/lead-distribution/monthly-duty-actions";
import {
  addDays,
  buildRangeOccurrences,
  daysBetween,
  MAX_PLAN_RANGE_DAYS,
  NO_TYPE_KEY,
  type MonthlyPlanSchedule,
  type PlanBrokerModality,
} from "@/features/lead-distribution/monthly-duty-plan";
import { cn } from "@/lib/utils";
import { DutyTypeTag, MODALITY_LABEL, typeStripe, typeUnitsLabel, type DutyTypeOption } from "./duty-type-ui";

type Broker = { id: string; name: string; branchId: string | null; branchName?: string | null; internalCode?: string | null };
type Branch = { id: string; name: string };
/** A plantão as the planner needs it (the roster snapshot row). */
export type PlannerSchedule = MonthlyPlanSchedule & { status: string; typeName?: string | null; typeHue?: number | null };
type Step = "types" | "brokers" | "review";
type TypeInfo = { key: string; name: string | null; hue: number | null; modality: "online" | "presencial" | null; branchIds: string[] };

/** One qualified broker while the escala is being set up. */
type Entry = {
  brokerId: string;
  modality: PlanBrokerModality;
  /** Type keys the broker may take in this escala. */
  allowed: string[];
  seats: Record<string, number>;
  /** Allowed although the broker's unit is outside the type (confirmed). */
  forced: string[];
};

const MODALITY_CHOICES: Array<{ value: PlanBrokerModality; label: string }> = [
  { value: "any", label: "Qualquer" },
  { value: "presencial", label: "Presencial" },
  { value: "online", label: "Online" },
];

export function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  const label = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 15, 12)));
  return label.replace(/^\p{L}/u, (letter) => letter.toLocaleUpperCase("pt-BR"));
}

function dateLabel(key: string) {
  const label = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "short", timeZone: "UTC" }).format(new Date(`${key}T12:00:00Z`));
  return label.charAt(0).toLocaleUpperCase("pt-BR") + label.slice(1);
}

const shortDate = (key: string) => `${key.slice(8, 10)}/${key.slice(5, 7)}`;

function todayKey() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

function monthEnd(month: string) {
  const [year, value] = month.split("-").map(Number);
  return new Date(Date.UTC(year, value, 0)).toISOString().slice(0, 10);
}

const seatTotal = (entry: Pick<Entry, "allowed" | "seats">, keys?: ReadonlySet<string>) =>
  entry.allowed.filter((key) => !keys || keys.has(key)).reduce((sum, key) => sum + (entry.seats[key] ?? 0), 0);

/** Loads and caches monthly plans; shared by the plantões list and the planner. */
export function useMonthlyDutyPlans(enabled: boolean) {
  const [plans, setPlans] = useState<Record<string, MonthlyDutyPlanView | null>>({});
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const requested = useRef(new Set<string>());

  const load = useCallback(async (month: string, force = false) => {
    if (!enabled || (!force && requested.current.has(month))) return;
    requested.current.add(month);
    setLoading((previous) => new Set(previous).add(month));
    setFailed((previous) => { const next = new Set(previous); next.delete(month); return next; });
    try {
      const plan = await getMonthlyDutyPlanAction(month);
      setPlans((previous) => ({ ...previous, [month]: plan }));
    } catch {
      requested.current.delete(month);
      setFailed((previous) => new Set(previous).add(month));
    } finally {
      setLoading((previous) => { const next = new Set(previous); next.delete(month); return next; });
    }
  }, [enabled]);

  const setPlan = useCallback((view: MonthlyDutyPlanView) => setPlans((previous) => ({ ...previous, [view.monthKey]: view })), []);
  return { plans, loading, failed, load, setPlan };
}

type PlansState = ReturnType<typeof useMonthlyDutyPlans>;

function Stepper({ value, onChange, label, disabled, max = 62 }: { value: number; onChange: (value: number) => void; label: string; disabled?: boolean; max?: number }) {
  const clamp = (next: number) => Math.min(max, Math.max(0, Number.isFinite(next) ? Math.trunc(next) : 0));
  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button type="button" size="icon-sm" variant="ghost" aria-label={`Diminuir ${label}`} disabled={disabled || value === 0} onClick={() => onChange(clamp(value - 1))}>−</Button>
      <Input aria-label={label} type="number" min={0} max={max} value={value} onFocus={(event) => event.target.select()} onChange={(event) => onChange(clamp(Number(event.target.value)))} disabled={disabled} className="w-12 text-center tabular-nums" />
      <Button type="button" size="icon-sm" variant="ghost" aria-label={`Aumentar ${label}`} disabled={disabled || value >= max} onClick={() => onChange(clamp(value + 1))}><Plus aria-hidden="true" className="size-3.5" /></Button>
    </div>
  );
}

export function MonthlyDutyPlanner({
  brokers,
  branches = [],
  types = [],
  enabled,
  canEdit = false,
  month,
  open,
  onOpenChange,
  schedules,
  plansState,
  onCreateSchedule,
}: {
  brokers: Broker[];
  branches?: Branch[];
  types?: DutyTypeOption[];
  enabled: boolean;
  canEdit?: boolean;
  month: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Active plantões (any month): the planner finds which happen in the period. */
  schedules: PlannerSchedule[];
  plansState: PlansState;
  onCreateSchedule: () => void;
}) {
  const eligibleBrokers = useMemo(() => brokers.filter((broker) => broker.branchId), [brokers]);
  const brokerById = useMemo(() => new Map(eligibleBrokers.map((broker) => [broker.id, broker])), [eligibleBrokers]);
  const { plans, loading, failed, load, setPlan } = plansState;
  const plan = plans[month];
  const published = plan?.status === "published";

  // ---- type catalogue (plus "Sem tipo" for plantões saved before types)
  const typeInfo = useMemo(() => {
    const map = new Map<string, TypeInfo>(types.map((type) => [type.id, { key: type.id, name: type.name, hue: type.colorHue, modality: type.attendanceMode, branchIds: type.branchIds }]));
    map.set(NO_TYPE_KEY, { key: NO_TYPE_KEY, name: null, hue: null, modality: null, branchIds: [] });
    return map;
  }, [types]);
  const scheduleType = useMemo(() => new Map(schedules.map((schedule) => [schedule.id, schedule.typeId ?? null])), [schedules]);
  const typeKeyOfOccurrence = useCallback((occurrence: { scheduleId: string; typeId?: string | null }) =>
    (occurrence.typeId !== undefined ? occurrence.typeId : scheduleType.get(occurrence.scheduleId)) ?? NO_TYPE_KEY, [scheduleType]);
  const unitInType = useCallback((key: string, branchId: string | null | undefined) => {
    const info = typeInfo.get(key);
    return !info?.branchIds.length || (Boolean(branchId) && info.branchIds.includes(branchId!));
  }, [typeInfo]);

  // ---- per-month UI state
  const [stepByMonth, setStepByMonth] = useState<Record<string, Step>>({});
  const [redoByMonth, setRedoByMonth] = useState<Record<string, boolean>>({});
  const [rangeByMonth, setRangeByMonth] = useState<Record<string, { from: string; until: string }>>({});
  const [chosenByMonth, setChosenByMonth] = useState<Record<string, string[]>>({});
  const [entriesByMonth, setEntriesByMonth] = useState<Record<string, Entry[]>>({});
  const [editingBroker, setEditingBroker] = useState<string | null>(null);
  const [confirmForce, setConfirmForce] = useState<null | { title: string; message: string; onConfirm: () => void }>(null);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  // review filters
  const [filterBranch, setFilterBranch] = useState("");
  const [filterTypes, setFilterTypes] = useState<string[]>([]);
  const [filterModality, setFilterModality] = useState<"" | "online" | "presencial">("");
  const [filterSearch, setFilterSearch] = useState("");
  const [onlyShort, setOnlyShort] = useState(false);
  const [reviewView, setReviewView] = useState<"days" | "brokers">("days");
  // The escala step shows the types of the latest generation; the rest on demand.
  const [showAllTypes, setShowAllTypes] = useState(false);

  useEffect(() => {
    if (open) queueMicrotask(() => { void load(month); });
  }, [load, month, open]);

  const redo = published && Boolean(redoByMonth[month]);
  const editing = canEdit && (!published || redo);
  const step: Step = !editing ? "review" : stepByMonth[month] ?? (plan && !published ? "review" : "types");
  const setStep = (next: Step) => setStepByMonth((previous) => ({ ...previous, [month]: next }));

  const today = todayKey();
  const monthStart = `${month}-01`;
  const defaultFrom = monthStart > today ? monthStart : today.slice(0, 7) === month ? today : monthStart;
  const range = rangeByMonth[month] ?? { from: defaultFrom, until: monthEnd(month) };
  const rangeDays = daysBetween(range.from, range.until);
  const rangeError = range.until < range.from ? "O fim vem antes do início." : rangeDays > MAX_PLAN_RANGE_DAYS ? `O período pode ter no máximo ${MAX_PLAN_RANGE_DAYS} dias.` : range.from.slice(0, 7) !== month ? `O início precisa ser em ${monthLabel(month)}.` : null;
  const setRange = (patch: Partial<typeof range>) => setRangeByMonth((previous) => ({ ...previous, [month]: { ...range, ...patch } }));

  // Occurrences of each type in the period that have not ended yet.
  const periodByType = useMemo(() => {
    const result = new Map<string, { plantoes: Set<string>; dates: number }>();
    if (rangeError) return result;
    const active = schedules.filter((schedule) => schedule.status === "active");
    for (const occurrence of buildRangeOccurrences(range.from, range.until, active, [], { from: new Date() })) {
      const key = occurrence.typeId ?? NO_TYPE_KEY;
      const entry = result.get(key) ?? { plantoes: new Set<string>(), dates: 0 };
      entry.plantoes.add(occurrence.scheduleId);
      entry.dates += 1;
      result.set(key, entry);
    }
    return result;
  }, [range.from, range.until, rangeError, schedules]);
  const typeList = useMemo(() => [...typeInfo.values()]
    .filter((info) => periodByType.has(info.key) || (info.key !== NO_TYPE_KEY && types.find((type) => type.id === info.key)?.status === "active"))
    .sort((a, b) => (a.key === NO_TYPE_KEY ? 1 : b.key === NO_TYPE_KEY ? -1 : (a.name ?? "").localeCompare(b.name ?? "", "pt-BR"))), [periodByType, typeInfo, types]);

  const chosen = useMemo(() => new Set((chosenByMonth[month] ?? []).filter((key) => periodByType.has(key))), [chosenByMonth, month, periodByType]);
  const chosenList = typeList.filter((info) => chosen.has(info.key));
  const toggleType = (key: string, on: boolean) => setChosenByMonth((previous) => {
    const current = new Set(previous[month] ?? []);
    if (on) current.add(key); else current.delete(key);
    return { ...previous, [month]: [...current] };
  });

  // ---- qualified brokers (prefilled from the escala's saved settings)
  const savedEntries = useMemo<Entry[]>(() => (plan?.settings?.brokers ?? []).map((item) => ({
    brokerId: item.brokerId,
    modality: item.modality,
    allowed: Object.keys(item.seats),
    seats: item.seats,
    forced: item.forcedTypeKeys,
  })), [plan]);
  const entries = entriesByMonth[month] ?? savedEntries;
  const setEntries = (update: (current: Entry[]) => Entry[]) => setEntriesByMonth((previous) => ({ ...previous, [month]: update(previous[month] ?? savedEntries) }));
  const updateEntry = (brokerId: string, patch: (entry: Entry) => Entry) => setEntries((current) => current.map((entry) => (entry.brokerId === brokerId ? patch(entry) : entry)));
  // In this escala: brokers that take at least one of the chosen types.
  const qualified = entries.filter((entry) => entry.allowed.some((key) => chosen.has(key)) && brokerById.has(entry.brokerId));
  const isPending = (entry: Entry) => entry.allowed.some((key) => chosen.has(key) && !(entry.seats[key] > 0));
  const pendingCount = qualified.filter(isPending).length;
  const seatsRequested = qualified.reduce((sum, entry) => sum + seatTotal(entry, chosen), 0);
  const chosenDates = chosenList.reduce((sum, info) => sum + (periodByType.get(info.key)?.dates ?? 0), 0);

  function addBroker(broker: Broker) {
    const keys = chosenList.map((info) => info.key);
    const eligible = keys.filter((key) => unitInType(key, broker.branchId));
    const add = (forced: string[]) => setEntries((current) => {
      const existing = current.find((entry) => entry.brokerId === broker.id);
      const allowed = [...new Set([...(existing?.allowed ?? []), ...(forced.length ? keys : eligible)])];
      const next: Entry = { brokerId: broker.id, modality: existing?.modality ?? "any", allowed, seats: existing?.seats ?? {}, forced: [...new Set([...(existing?.forced ?? []), ...forced])] };
      return existing ? current.map((entry) => (entry.brokerId === broker.id ? next : entry)) : [next, ...current];
    });
    if (eligible.length) { add([]); return; }
    setConfirmForce({
      title: `Adicionar ${broker.name} mesmo assim?`,
      message: `A unidade dele (${broker.branchName ?? "sem unidade"}) não participa de ${keys.length === 1 ? "este tipo" : "nenhum dos tipos escolhidos"}. Ele só entra na escala porque você confirmou.`,
      onConfirm: () => add(keys),
    });
  }

  function setAllowed(entry: Entry, key: string, on: boolean) {
    const broker = brokerById.get(entry.brokerId);
    const apply = (force: boolean) => updateEntry(entry.brokerId, (current) => ({
      ...current,
      allowed: on ? [...new Set([...current.allowed, key])] : current.allowed.filter((item) => item !== key),
      seats: on ? current.seats : { ...current.seats, [key]: 0 },
      forced: on && force ? [...new Set([...current.forced, key])] : current.forced.filter((item) => on || item !== key),
    }));
    if (on && !unitInType(key, broker?.branchId)) {
      const info = typeInfo.get(key);
      setConfirmForce({
        title: `Liberar ${info?.name ?? "Sem tipo"} para ${broker?.name ?? "o corretor"}?`,
        message: `A unidade dele (${broker?.branchName ?? "sem unidade"}) não participa deste tipo de plantão. Confirme para escalar mesmo assim.`,
        onConfirm: () => apply(true),
      });
      return;
    }
    apply(false);
  }

  const setSeats = (brokerId: string, key: string, value: number) => updateEntry(brokerId, (entry) => ({ ...entry, seats: { ...entry.seats, [key]: value } }));
  const [bulkSeats, setBulkSeats] = useState("2");
  const [bulkType, setBulkType] = useState("");
  function applyBulk() {
    const key = bulkType && chosen.has(bulkType) ? bulkType : chosenList[0]?.key;
    if (!key) return;
    const value = Math.min(62, Math.max(0, Math.trunc(Number(bulkSeats) || 0)));
    setEntries((current) => current.map((entry) => (qualified.some((item) => item.brokerId === entry.brokerId) && entry.allowed.includes(key) ? { ...entry, seats: { ...entry.seats, [key]: value } } : entry)));
  }

  function run(key: string, task: () => Promise<MonthlyDutyPlanView>, success: string, after?: () => void) {
    setBusyKey(key);
    startTransition(async () => {
      try {
        setPlan(await task());
        after?.();
        toast.success(success);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Não foi possível concluir a ação.";
        // Another revision was created or published meanwhile (another tab, an import): show the current one.
        if (/não está mais em rascunho|proposta mais nova|publicada por outra pessoa/.test(message)) {
          toast.error(`${message} Carreguei a versão atual da escala.`);
          void load(month, true);
        } else toast.error(message);
      } finally {
        setBusyKey(null);
      }
    });
  }

  function generate() {
    const payload = qualified.map((entry) => ({
      brokerId: entry.brokerId,
      modality: entry.modality,
      seats: Object.fromEntries(entry.allowed.filter((key) => chosen.has(key) && entry.seats[key] > 0).map((key) => [key, entry.seats[key]])),
      forcedTypeKeys: entry.forced.filter((key) => chosen.has(key)),
    })).filter((item) => Object.keys(item.seats).length);
    run("generate", () => generateMonthlyDutyPlanAction({ monthKey: month, rangeFrom: range.from, rangeUntil: range.until, typeKeys: [...chosen], brokers: payload }), "Proposta gerada. Revise antes de publicar.", () => {
      setEntriesByMonth((previous) => { const next = { ...previous }; delete next[month]; return next; });
      setRedoByMonth((previous) => ({ ...previous, [month]: false }));
      setStep("review");
    });
  }

  function editDraft(occurrenceId: string, brokerId: string, operation: "add" | "remove", force = false) {
    if (!plan) return;
    run(`${operation}:${occurrenceId}:${brokerId}`, () => updateMonthlyDutyDraftAction({ planId: plan.id, occurrenceId, brokerId, operation, force }),
      operation === "add" ? "Corretor adicionado ao plantão." : "Corretor removido do plantão.",
      operation === "add" ? () => setAddingTo(null) : undefined);
  }

  function publish() {
    if (!plan) return;
    run("publish", () => publishMonthlyDutyPlanAction(plan.id), "Escala publicada. Os corretores foram notificados.", () => setConfirmPublish(false));
  }

  // ---- review data
  const generatedKeys = useMemo(() => new Set(plan?.settings?.generatedTypeKeys ?? []), [plan]);
  const limitToGenerated = generatedKeys.size > 0 && !showAllTypes;
  const reviewOccurrences = useMemo(() => {
    if (!plan) return [];
    const needle = filterSearch.trim().toLocaleLowerCase("pt-BR");
    return plan.occurrences.filter((occurrence) => {
      const key = typeKeyOfOccurrence(occurrence);
      if (limitToGenerated && !generatedKeys.has(key)) return false;
      if (filterTypes.length && !filterTypes.includes(key)) return false;
      if (filterModality && (occurrence.attendanceMode ?? schedules.find((schedule) => schedule.id === occurrence.scheduleId)?.attendanceMode ?? "online") !== filterModality) return false;
      if (onlyShort && (occurrence.ended || occurrence.assignedCount >= occurrence.minimumBrokers)) return false;
      if (needle && !occurrence.brokers.some((broker) => `${broker.name} ${broker.code ?? ""}`.toLocaleLowerCase("pt-BR").includes(needle))) return false;
      if (filterBranch && !occurrence.brokers.some((broker) => broker.branchId === filterBranch) && !onlyShort) return false;
      return true;
    });
  }, [filterBranch, filterModality, filterSearch, filterTypes, generatedKeys, limitToGenerated, onlyShort, plan, schedules, typeKeyOfOccurrence]);
  // Brokers already on the roster vs. new in this generation (shown in two colors).
  const originCounts = useMemo(() => {
    let kept = 0;
    let added = 0;
    for (const occurrence of reviewOccurrences) for (const broker of occurrence.brokers) {
      if (broker.origin === "existing" || broker.origin === "weekly") kept += 1;
      else added += 1;
    }
    return { kept, added };
  }, [reviewOccurrences]);
  const reviewDates = [...new Set(reviewOccurrences.map((occurrence) => occurrence.dutyDate))];
  const planTypeKeys = useMemo(() => [...new Set((plan?.occurrences ?? []).map(typeKeyOfOccurrence))].filter((key) => !limitToGenerated || generatedKeys.has(key)).sort((a, b) => (a === NO_TYPE_KEY ? 1 : b === NO_TYPE_KEY ? -1 : (typeInfo.get(a)?.name ?? "").localeCompare(typeInfo.get(b)?.name ?? "", "pt-BR"))), [generatedKeys, limitToGenerated, plan, typeInfo, typeKeyOfOccurrence]);
  const hiddenTypes = generatedKeys.size ? new Set((plan?.occurrences ?? []).map(typeKeyOfOccurrence).filter((key) => !generatedKeys.has(key))).size : 0;
  const brokerRows = useMemo(() => {
    if (!plan) return [];
    const rows = new Map<string, { broker: MonthlyDutyPlanView["brokers"][number]; byType: Map<string, number>; total: number }>();
    for (const broker of plan.brokers) rows.set(broker.id, { broker, byType: new Map(), total: 0 });
    for (const occurrence of plan.occurrences) {
      const key = typeKeyOfOccurrence(occurrence);
      for (const broker of occurrence.brokers) {
        const row = rows.get(broker.id) ?? { broker, byType: new Map(), total: 0 };
        row.byType.set(key, (row.byType.get(key) ?? 0) + 1);
        row.total += 1;
        rows.set(broker.id, row);
      }
    }
    const needle = filterSearch.trim().toLocaleLowerCase("pt-BR");
    return [...rows.values()]
      .filter((row) => (!filterBranch || row.broker.branchId === filterBranch) && (!needle || `${row.broker.name} ${row.broker.code ?? ""}`.toLocaleLowerCase("pt-BR").includes(needle)))
      .filter((row) => !filterTypes.length || filterTypes.some((key) => (row.byType.get(key) ?? 0) > 0 || (plan.settings?.brokers.find((item) => item.brokerId === row.broker.id)?.seats[key] ?? 0) > 0))
      .sort((a, b) => (a.broker.branchName ?? "~").localeCompare(b.broker.branchName ?? "~", "pt-BR") || a.broker.name.localeCompare(b.broker.name, "pt-BR"));
  }, [filterBranch, filterSearch, filterTypes, plan, typeKeyOfOccurrence]);

  const steps: Array<{ id: Step; label: string; disabled?: boolean }> = [
    { id: "types", label: "Tipos e período" },
    { id: "brokers", label: "Corretores", disabled: chosen.size === 0 || Boolean(rangeError) },
    { id: "review", label: "Escala", disabled: !plan },
  ];
  const editingEntry = qualified.find((entry) => entry.brokerId === editingBroker) ?? null;
  const branchOptions = [{ value: "", label: "Todas as unidades" }, ...branches.map((branch) => ({ value: branch.id, label: branch.name }))];

  return (
    <>
      <Sheet open={open} onOpenChange={(next) => { if (!next) setAddingTo(null); onOpenChange(next); }}>
        <SheetContent className="data-[side=right]:w-[min(100vw-1rem,46rem)]">
          <SheetHeader>
            <SheetTitle>Escala de {monthLabel(month)}</SheetTitle>
            <SheetDescription>
              {!canEdit ? "Escala dos corretores da sua unidade."
                : published && !redo ? `Publicada${plan?.publishedAt ? ` em ${new Date(plan.publishedAt).toLocaleDateString("pt-BR")}` : ""} · ${shortDate(plan!.rangeFrom)} a ${shortDate(plan!.rangeUntil)}. Para mudar, gere uma nova: ela vale nas datas que ainda não passaram.`
                  : redo ? "Nova escala: escolha os tipos que quer refazer. Os outros tipos continuam como estão."
                  : "Escolha os tipos de plantão e o período, defina as cadeiras de cada corretor e publique."}
            </SheetDescription>
          </SheetHeader>
          <SheetBody contentClassName="grid grid-cols-[minmax(0,1fr)] content-start gap-4">
            {!enabled ? (
              <div className="rounded-[var(--radius-card)] border border-border/70 bg-muted/30 p-4">
                <p className="text-sm font-medium">Escala mensal indisponível</p>
                <p className="mt-1 text-xs text-muted-foreground">Peça ao Super-admin para habilitar o planejamento mensal. Os plantões semanais continuam funcionando normalmente.</p>
              </div>
            ) : failed.has(month) ? (
              <div className="grid gap-2 rounded-[var(--radius-card)] border border-destructive/30 p-4">
                <p className="text-sm">Não foi possível carregar a escala deste mês.</p>
                <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={() => { void load(month, true); }}>Tentar novamente</Button>
              </div>
            ) : loading.has(month) || plan === undefined ? (
              <div className="grid gap-3" aria-label="Carregando escala"><Skeleton className="h-10 w-full" /><Skeleton className="h-20 w-full" /></div>
            ) : (
              <>
                {editing ? (
                  <ol aria-label="Etapas" className="grid grid-cols-3 gap-1 rounded-[var(--radius-card)] border border-border p-0.5">
                    {steps.map((item, index) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          aria-current={step === item.id ? "step" : undefined}
                          disabled={item.disabled}
                          onClick={() => setStep(item.id)}
                          className={cn("w-full rounded-full px-2 py-1 text-xs font-medium transition-colors disabled:opacity-40", step === item.id ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")}
                        >
                          {index + 1}. {item.label}
                        </button>
                      </li>
                    ))}
                  </ol>
                ) : null}

                {step === "types" ? (
                  <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
                    <section className="grid gap-2 rounded-[var(--radius-card)] border border-border p-3">
                      <p className="text-sm font-medium">Período da escala</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-1.5">
                          <Label htmlFor="plan-range-from">De</Label>
                          <Input id="plan-range-from" type="date" value={range.from} min={monthStart} max={monthEnd(month)} onChange={(event) => setRange({ from: event.target.value, until: event.target.value > range.until ? event.target.value : range.until })} />
                        </div>
                        <div className="grid gap-1.5">
                          <Label htmlFor="plan-range-until">Até</Label>
                          <Input id="plan-range-until" type="date" value={range.until} min={range.from} max={addDays(range.from, MAX_PLAN_RANGE_DAYS)} onChange={(event) => setRange({ until: event.target.value })} />
                        </div>
                      </div>
                      <p className={cn("text-xs", rangeError ? "text-destructive" : "text-muted-foreground")}>
                        {rangeError ?? `${rangeDays + 1} dias. Pode passar do fim do mês quando os plantões continuam no mês seguinte.`}
                      </p>
                    </section>
                    <section className="grid gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">Tipos de plantão que entram nesta escala</p>
                        <Button type="button" size="sm" variant="outline" onClick={onCreateSchedule}><Plus className="size-3.5" /> Novo plantão</Button>
                      </div>
                      {typeList.length ? (
                        <ul className="divide-y divide-border/60 rounded-[var(--radius-card)] border border-border bg-card">
                          {typeList.map((info) => {
                            const period = periodByType.get(info.key);
                            return (
                              <li key={info.key}>
                                <label className={cn("flex items-center gap-3 border-l-[3px] px-3 py-2.5", period ? "cursor-pointer" : "cursor-not-allowed opacity-50")} style={typeStripe(info.hue)}>
                                  <Checkbox checked={chosen.has(info.key)} disabled={!period} onCheckedChange={(checked) => toggleType(info.key, checked === true)} aria-label={`Incluir ${info.name ?? "Sem tipo"}`} />
                                  <span className="min-w-0 flex-1">
                                    <DutyTypeTag name={info.name} hue={info.hue} className="text-sm" />
                                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                                      {info.modality ? `${MODALITY_LABEL[info.modality]} · ` : ""}{info.key === NO_TYPE_KEY ? "Plantões criados antes dos tipos" : typeUnitsLabel(info, branches)}
                                    </span>
                                  </span>
                                  <span className="shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                                    {period ? <>{period.plantoes.size} {period.plantoes.size === 1 ? "plantão" : "plantões"}<span className="block">{period.dates} {period.dates === 1 ? "data" : "datas"}</span></> : "Nada no período"}
                                  </span>
                                </label>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="rounded-[var(--radius-card)] border border-dashed border-border p-4 text-xs text-muted-foreground">Nenhum plantão ainda vai acontecer neste período. Crie um novo.</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {chosen.size ? `${chosen.size} ${chosen.size === 1 ? "tipo" : "tipos"} · ${chosenDates} datas de plantão no período.` : "Escolha um ou mais tipos."}
                        {plan ? " Os tipos que você não escolher continuam como estão na escala." : ""}
                      </p>
                    </section>
                  </div>
                ) : step === "brokers" ? (
                  <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
                    <div className="flex flex-wrap gap-1.5">
                      {chosenList.map((info) => <Badge key={info.key} variant="outline"><DutyTypeTag name={info.name} hue={info.hue} /></Badge>)}
                      <Badge variant="outline">{shortDate(range.from)} a {shortDate(range.until)}</Badge>
                    </div>
                    <SearchAddList
                      items={eligibleBrokers.filter((broker) => !qualified.some((entry) => entry.brokerId === broker.id)).map((broker) => {
                        const fits = chosenList.some((info) => unitInType(info.key, broker.branchId));
                        return {
                          id: broker.id,
                          label: broker.name,
                          hint: <>{broker.internalCode ? `${broker.internalCode} · ` : ""}{broker.branchName ?? "Sem unidade"}{fits ? null : <span className="text-warning"> · fora das unidades dos tipos</span>}</>,
                          keywords: `${broker.internalCode ?? ""} ${broker.branchName ?? ""}`,
                        };
                      })}
                      placeholder="Buscar corretor por nome ou código"
                      emptyLabel="Nenhum corretor encontrado."
                      disabled={pending}
                      onAdd={(item) => { const broker = brokerById.get(item.id); if (broker) addBroker(broker); }}
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">
                        {qualified.length} {qualified.length === 1 ? "corretor qualificado" : "corretores qualificados"} · {seatsRequested} cadeiras para {chosenDates} datas
                      </p>
                      {qualified.length > 1 ? (
                        <div className="flex items-center gap-1.5">
                          <Label htmlFor="plan-bulk" className="text-xs text-muted-foreground">Mesmas cadeiras para todos</Label>
                          <Input id="plan-bulk" type="number" min={0} max={62} value={bulkSeats} onChange={(event) => setBulkSeats(event.target.value)} className="w-14 text-center" />
                          {chosenList.length > 1 ? (
                            <AppSelect aria-label="Tipo" className="w-32" value={bulkType || chosenList[0].key} onValueChange={setBulkType} options={chosenList.map((info) => ({ value: info.key, label: info.name ?? "Sem tipo" }))} />
                          ) : null}
                          <Button type="button" size="sm" variant="outline" onClick={applyBulk}>Aplicar</Button>
                        </div>
                      ) : null}
                    </div>
                    {qualified.length ? (
                      <ul className="divide-y divide-border/60 rounded-[var(--radius-card)] border border-border bg-card">
                        {qualified.map((entry) => {
                          const broker = brokerById.get(entry.brokerId)!;
                          const keys = entry.allowed.filter((key) => chosen.has(key));
                          const single = keys.length === 1 ? keys[0] : null;
                          return (
                            <li key={entry.brokerId} className="flex items-center gap-2 px-3 py-2">
                              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setEditingBroker(entry.brokerId)} aria-label={`Configurar ${broker.name}`}>
                                <span className="block truncate text-sm font-medium">{broker.name}</span>
                                <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
                                  <span>{broker.internalCode ? `${broker.internalCode} · ` : ""}{broker.branchName ?? "Sem unidade"}</span>
                                  {entry.modality !== "any" ? <span>· só {MODALITY_LABEL[entry.modality].toLocaleLowerCase("pt-BR")}</span> : null}
                                  {chosenList.length > 1 ? keys.map((key) => <DutyTypeTag key={key} name={typeInfo.get(key)?.name ?? null} hue={typeInfo.get(key)?.hue ?? null} className="text-muted-foreground" />) : null}
                                  {entry.forced.some((key) => chosen.has(key)) ? <span className="text-warning">· fora da unidade (confirmado)</span> : null}
                                </span>
                              </button>
                              {isPending(entry) ? <Badge variant="warning" className="shrink-0">Cadeiras pendentes</Badge> : null}
                              {single ? (
                                <Stepper value={entry.seats[single] ?? 0} onChange={(value) => setSeats(entry.brokerId, single, value)} label={`cadeiras de ${broker.name}`} disabled={pending} />
                              ) : (
                                <Button type="button" size="sm" variant="outline" className="shrink-0 tabular-nums" onClick={() => setEditingBroker(entry.brokerId)}>
                                  {seatTotal(entry, chosen)} cadeiras
                                </Button>
                              )}
                              <Button type="button" size="icon-sm" variant="ghost" className="shrink-0" aria-label={`Remover ${broker.name} da escala`} disabled={pending}
                                onClick={() => setEntries((current) => current.map((item) => (item.brokerId === entry.brokerId ? { ...item, allowed: item.allowed.filter((key) => !chosen.has(key)), seats: Object.fromEntries(Object.entries(item.seats).filter(([key]) => !chosen.has(key))) } : item)))}>
                                <Trash className="size-4" />
                              </Button>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="rounded-[var(--radius-card)] border border-dashed border-border p-4 text-xs text-muted-foreground">Busque pelo nome ou código e adicione os corretores qualificados para esta escala. Clique no corretor para definir modalidade, tipos e cadeiras.</p>
                    )}
                    {pendingCount ? (
                      <p className="flex items-center gap-1.5 text-xs text-warning"><Warning className="size-3.5" /> {pendingCount} {pendingCount === 1 ? "corretor está" : "corretores estão"} com cadeiras pendentes: sem cadeira, o tipo é ignorado para ele.</p>
                    ) : null}
                  </div>
                ) : plan ? (
                  <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
                    <dl className="grid grid-cols-4 divide-x divide-border/70 rounded-[var(--radius-card)] border border-border bg-card">
                      {[
                        { label: "Período", value: `${shortDate(plan.rangeFrom)}–${shortDate(plan.rangeUntil)}` },
                        { label: "Datas", value: plan.occurrences.length },
                        { label: "Alocações", value: plan.totalAssigned },
                        { label: "Abaixo do mínimo", value: plan.belowMinimum, warn: plan.belowMinimum > 0 },
                      ].map((metric) => (
                        <div key={metric.label} className="px-3 py-2.5">
                          <dt className="text-[11px] text-muted-foreground">{metric.label}</dt>
                          <dd className={cn("mt-0.5 text-base font-semibold tabular-nums", metric.warn && "text-warning")}>{metric.value}</dd>
                        </div>
                      ))}
                    </dl>
                    {plan.problems.length ? (
                      <div role="alert" className="flex gap-2 rounded-[var(--radius-card)] border border-destructive/30 bg-destructive/5 p-3 text-xs">
                        <Warning aria-hidden="true" className="size-4 shrink-0 text-destructive" />
                        <div>{plan.problems.map((problem) => <p key={problem}>{problem}</p>)}</div>
                      </div>
                    ) : null}
                    {plan.warnings.length ? (
                      <div className="flex gap-2 rounded-[var(--radius-card)] border border-warning/30 bg-warning/5 p-3 text-xs">
                        <Warning aria-hidden="true" className="size-4 shrink-0 text-warning" />
                        <div>{plan.warnings.map((warning) => <p key={warning}>{warning}</p>)}</div>
                      </div>
                    ) : null}
                    {plan.replacesPublished && !published ? (
                      <p className="rounded-[var(--radius-card)] border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                        Ao publicar, esta escala substitui a publicada nas datas que ainda não passaram. Quem continua no mesmo plantão mantém presença e pausa.
                      </p>
                    ) : null}

                    {/* Filters */}
                    <div className="grid gap-2 rounded-[var(--radius-card)] border border-border p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {canEdit ? <AppSelect aria-label="Unidade" className="w-48" value={filterBranch} onValueChange={setFilterBranch} options={branchOptions} /> : null}
                        <AppSelect aria-label="Modalidade" className="w-36" value={filterModality} onValueChange={(value) => setFilterModality(value as typeof filterModality)} options={[{ value: "", label: "Toda modalidade" }, { value: "presencial", label: "Presencial" }, { value: "online", label: "Online" }]} />
                        <Input value={filterSearch} onChange={(event) => setFilterSearch(event.target.value)} placeholder="Corretor ou código" aria-label="Buscar corretor ou código" className="w-44" />
                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Checkbox checked={onlyShort} onCheckedChange={(checked) => setOnlyShort(checked === true)} /> Só com falta
                        </label>
                        {hiddenTypes ? (
                          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Checkbox checked={showAllTypes} onCheckedChange={(checked) => setShowAllTypes(checked === true)} /> Ver os outros tipos da escala ({hiddenTypes})
                          </label>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground" aria-label="Legenda dos corretores">
                        <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="size-2.5 rounded-full border border-border bg-muted" /> Já escalados · {originCounts.kept}</span>
                        <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="size-2.5 rounded-full border border-success/50 bg-success/15" /> {published ? "Escalados nesta escala" : "Novos nesta geração"} · {originCounts.added}</span>
                      </div>
                      {planTypeKeys.length > 1 ? (
                        <div role="group" aria-label="Filtrar por tipo" className="flex flex-wrap items-center gap-1.5">
                          {planTypeKeys.map((key) => {
                            const active = filterTypes.includes(key);
                            return (
                              <button key={key} type="button" aria-pressed={active} onClick={() => setFilterTypes((current) => (active ? current.filter((item) => item !== key) : [...current, key]))}
                                className={cn("rounded-full border px-2.5 py-1", active ? "border-foreground/40 bg-muted" : "border-border bg-card hover:border-foreground/30")}>
                                <DutyTypeTag name={typeInfo.get(key)?.name ?? null} hue={typeInfo.get(key)?.hue ?? null} />
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                      <div className="flex items-center justify-between gap-2">
                        <div role="tablist" aria-label="Ver escala" className="grid grid-cols-2 rounded-[var(--radius-card)] border border-border bg-muted/40 p-0.5">
                          {([["days", "Por dia"], ["brokers", "Por corretor"]] as const).map(([value, label]) => (
                            <button key={value} type="button" role="tab" aria-selected={reviewView === value} onClick={() => setReviewView(value)} className={cn("rounded-full px-3 py-1 text-xs font-medium", reviewView === value ? "bg-background text-foreground" : "text-muted-foreground")}>{label}</button>
                          ))}
                        </div>
                        <Button type="button" size="sm" variant="outline" onClick={() => setPdfOpen(true)}><FileArrowDown className="size-3.5" /> Gerar PDF</Button>
                      </div>
                    </div>

                    {reviewView === "brokers" ? (
                      <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border bg-card">
                        <table className="w-full text-xs">
                          <thead className="bg-muted/40 text-muted-foreground">
                            <tr>
                              <th className="px-3 py-2 text-left font-medium">Corretor</th>
                              <th className="px-3 py-2 text-left font-medium">Unidade</th>
                              {planTypeKeys.map((key) => <th key={key} className="px-2 py-2 text-center font-medium"><DutyTypeTag name={typeInfo.get(key)?.name ?? null} hue={typeInfo.get(key)?.hue ?? null} className="justify-center" /></th>)}
                              <th className="px-3 py-2 text-right font-medium">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/60">
                            {brokerRows.map((row) => {
                              const seats = plan.settings?.brokers.find((item) => item.brokerId === row.broker.id)?.seats ?? {};
                              return (
                                <tr key={row.broker.id}>
                                  <td className="px-3 py-2"><span className="font-medium">{row.broker.name}</span>{row.broker.code ? <span className="text-muted-foreground"> · {row.broker.code}</span> : null}</td>
                                  <td className="px-3 py-2 text-muted-foreground">{row.broker.branchName ?? "Sem unidade"}</td>
                                  {planTypeKeys.map((key) => {
                                    const given = row.byType.get(key) ?? 0;
                                    const asked = seats[key] ?? 0;
                                    return <td key={key} className={cn("px-2 py-2 text-center tabular-nums", asked > given && "text-warning")}>{asked ? `${given}/${asked}` : given || "–"}</td>;
                                  })}
                                  <td className="px-3 py-2 text-right font-semibold tabular-nums">{row.total}</td>
                                </tr>
                              );
                            })}
                            {!brokerRows.length ? <tr><td colSpan={planTypeKeys.length + 3} className="px-3 py-4 text-center text-muted-foreground">Nenhum corretor neste filtro.</td></tr> : null}
                          </tbody>
                        </table>
                      </div>
                    ) : reviewDates.length ? reviewDates.map((date) => (
                      <section key={date} aria-label={dateLabel(date)} className="grid gap-2">
                        <h4 className="text-xs font-semibold text-muted-foreground">{dateLabel(date)}</h4>
                        {reviewOccurrences.filter((occurrence) => occurrence.dutyDate === date).map((occurrence) => {
                          const key = typeKeyOfOccurrence(occurrence);
                          const info = typeInfo.get(key);
                          const below = occurrence.assignedCount < occurrence.minimumBrokers;
                          const full = occurrence.maximumBrokers !== null && occurrence.assignedCount >= occurrence.maximumBrokers;
                          const editable = canEdit && !published && !occurrence.ended;
                          const shown = filterBranch ? occurrence.brokers.filter((broker) => broker.branchId === filterBranch) : occurrence.brokers;
                          const modality = occurrence.attendanceMode ?? (schedules.find((schedule) => schedule.id === occurrence.scheduleId)?.attendanceMode === "presencial" ? "presencial" : "online");
                          const candidates = eligibleBrokers
                            .filter((broker) => !occurrence.brokers.some((item) => item.id === broker.id))
                            .map((broker) => ({
                              id: broker.id,
                              label: broker.name,
                              hint: <>{broker.internalCode ? `${broker.internalCode} · ` : ""}{broker.branchName ?? ""}{occurrence.allowedBrokerIds.includes(broker.id) ? null : <span className="text-warning"> · fora da unidade do tipo</span>}</>,
                              keywords: `${broker.internalCode ?? ""} ${broker.branchName ?? ""}`,
                            }));
                          return (
                            <article key={occurrence.id} style={typeStripe(info?.hue)} className={cn("rounded-[var(--radius-card)] border bg-card p-3", occurrence.ended ? "border-dashed border-border opacity-60" : below ? "border-warning/40" : "border-border")}>
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="flex min-w-0 items-center gap-2 text-sm font-medium">
                                    <span className="truncate">{occurrence.scheduleName}</span>
                                  </p>
                                  <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                                    <DutyTypeTag name={info?.name ?? null} hue={info?.hue ?? null} />
                                    <span>· {occurrence.startsAt.slice(0, 5)}–{occurrence.endsAt.slice(0, 5)} · {MODALITY_LABEL[modality]}</span>
                                  </p>
                                </div>
                                {occurrence.ended ? (
                                  <Badge variant="outline" className="shrink-0">Já passou · não será publicado</Badge>
                                ) : (
                                  <Badge variant={below ? "warning" : "outline"} className="shrink-0 tabular-nums">
                                    {occurrence.assignedCount}/{occurrence.minimumBrokers} mín.{occurrence.maximumBrokers !== null ? ` · máx. ${occurrence.maximumBrokers}` : ""}
                                  </Badge>
                                )}
                              </div>
                              <ul className="mt-2 flex flex-wrap gap-1.5">
                                {shown.map((broker) => {
                                  const kept = broker.origin === "existing" || broker.origin === "weekly";
                                  return (
                                  <li
                                    key={broker.id}
                                    title={`${kept ? (broker.origin === "weekly" ? "Já escalado (escala semanal)" : "Já escalado") : "Novo nesta geração"}${broker.branchName ? ` · ${broker.branchName}` : ""}${broker.forced ? " · fora da unidade do tipo" : ""}`}
                                    data-origin={kept ? "kept" : "new"}
                                    className={cn(
                                      "inline-flex items-center gap-1 rounded-full border py-0.5 pl-2.5 pr-1 text-xs",
                                      kept ? "border-border bg-muted text-muted-foreground" : "border-success/50 bg-success/15 text-foreground",
                                      broker.forced && "ring-1 ring-warning/60",
                                    )}
                                  >
                                    {broker.code ? <span className="font-semibold tabular-nums">{broker.code}</span> : null}
                                    <span>{broker.name}</span>
                                    {!filterBranch && broker.branchName ? <span className="text-muted-foreground">· {broker.branchName}</span> : null}
                                    {editable && broker.origin !== "weekly" ? (
                                      <button type="button" aria-label={`Remover ${broker.name} de ${occurrence.scheduleName} em ${dateLabel(date)}`} disabled={pending} onClick={() => editDraft(occurrence.id, broker.id, "remove")} className="grid size-4 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50">
                                        {busyKey === `remove:${occurrence.id}:${broker.id}` ? <Loader2Icon className="size-3 animate-spin" /> : <X className="size-3" />}
                                      </button>
                                    ) : <span className="w-1" />}
                                  </li>
                                  );
                                })}
                                {!shown.length ? <li className="text-xs text-muted-foreground">{filterBranch && occurrence.brokers.length ? "Ninguém desta unidade" : "Ninguém escalado"}</li> : null}
                                {editable && !full ? (
                                  <li>
                                    <button type="button" onClick={() => setAddingTo(addingTo === occurrence.id ? null : occurrence.id)} className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-0.5 text-xs text-muted-foreground hover:text-foreground">
                                      <Plus className="size-3" /> Adicionar
                                    </button>
                                  </li>
                                ) : null}
                              </ul>
                              {editable && addingTo === occurrence.id ? (
                                <div className="mt-2">
                                  <SearchAddList
                                    items={candidates}
                                    placeholder="Buscar corretor por nome ou código"
                                    emptyLabel="Nenhum corretor encontrado."
                                    addingId={busyKey?.startsWith(`add:${occurrence.id}:`) ? busyKey.split(":").at(-1) : null}
                                    disabled={pending}
                                    onAdd={(item) => {
                                      if (occurrence.allowedBrokerIds.includes(item.id)) { editDraft(occurrence.id, item.id, "add"); return; }
                                      const broker = brokerById.get(item.id);
                                      setConfirmForce({
                                        title: `Escalar ${broker?.name ?? "o corretor"} mesmo assim?`,
                                        message: `A unidade dele (${broker?.branchName ?? "sem unidade"}) não participa do tipo ${info?.name ?? "deste plantão"}.`,
                                        onConfirm: () => editDraft(occurrence.id, item.id, "add", true),
                                      });
                                    }}
                                  />
                                </div>
                              ) : null}
                            </article>
                          );
                        })}
                      </section>
                    )) : (
                      <p className="rounded-[var(--radius-card)] border border-dashed border-border p-4 text-xs text-muted-foreground">Nenhum plantão neste filtro.</p>
                    )}
                  </div>
                ) : (
                  <p className="rounded-[var(--radius-card)] border border-dashed border-border p-4 text-sm text-muted-foreground">O Diretor ainda não montou a escala deste mês.</p>
                )}
              </>
            )}
          </SheetBody>
          {enabled && canEdit && published && !redo ? (
            <SheetFooter>
              <Button type="button" variant="outline" className="ml-auto" onClick={() => { setRedoByMonth((previous) => ({ ...previous, [month]: true })); setStep("types"); }}>
                <Sparkle aria-hidden="true" />
                Gerar nova escala
              </Button>
            </SheetFooter>
          ) : null}
          {enabled && editing && plan !== undefined ? (
            <SheetFooter>
              {step === "types" ? (
                <Button type="button" className="ml-auto" disabled={!chosen.size || Boolean(rangeError)} onClick={() => setStep("brokers")}>Continuar para corretores</Button>
              ) : step === "brokers" ? (
                <>
                  <Button type="button" variant="outline" onClick={() => setStep("types")} disabled={pending}>Voltar</Button>
                  <Button type="button" disabled={pending || seatsRequested === 0 || !chosen.size} onClick={generate}>
                    {busyKey === "generate" ? <Loader2Icon aria-hidden="true" className="animate-spin" /> : <Sparkle aria-hidden="true" />}
                    {plan ? "Gerar nova proposta" : "Gerar proposta"}
                  </Button>
                </>
              ) : plan ? (
                <>
                  <Button type="button" variant="outline" onClick={() => setStep("brokers")} disabled={pending || !chosen.size}>Voltar aos corretores</Button>
                  <Button type="button" disabled={pending || !plan.totalAssigned || plan.problems.length > 0} onClick={() => setConfirmPublish(true)}>Publicar escala</Button>
                </>
              ) : null}
            </SheetFooter>
          ) : null}
        </SheetContent>
      </Sheet>

      {/* Broker settings: modality, types and seats per type */}
      <Dialog open={Boolean(editingEntry)} onOpenChange={(next) => { if (!next) setEditingBroker(null); }}>
        {editingEntry ? (() => {
          const broker = brokerById.get(editingEntry.brokerId)!;
          return (
            <DialogPopup className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>{broker.name}</DialogTitle>
                <DialogDescription>{broker.internalCode ? `${broker.internalCode} · ` : ""}{broker.branchName ?? "Sem unidade"}. Defina como ele tira os plantões desta escala.</DialogDescription>
              </DialogHeader>
              <DialogPanel className="gap-4">
                <div className="grid gap-1.5">
                  <p className="text-sm font-medium">Modalidade</p>
                  <div role="radiogroup" aria-label="Modalidade do corretor" className="grid grid-cols-3 rounded-[var(--radius-card)] border border-border bg-muted/40 p-0.5">
                    {MODALITY_CHOICES.map((choice) => (
                      <button key={choice.value} type="button" role="radio" aria-checked={editingEntry.modality === choice.value}
                        onClick={() => updateEntry(editingEntry.brokerId, (entry) => ({ ...entry, modality: choice.value }))}
                        className={cn("rounded-full px-2 py-1.5 text-xs font-medium", editingEntry.modality === choice.value ? "bg-background text-foreground" : "text-muted-foreground hover:text-foreground")}>
                        {choice.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">{editingEntry.modality === "any" ? "Pode cair em plantão presencial ou online." : `Só entra em plantões ${MODALITY_LABEL[editingEntry.modality].toLocaleLowerCase("pt-BR")}.`}</p>
                </div>
                <div className="grid gap-1.5">
                  <p className="text-sm font-medium">Tipos e cadeiras</p>
                  <ul className="divide-y divide-border/60 rounded-[var(--radius-card)] border border-border">
                    {chosenList.map((info) => {
                      const allowed = editingEntry.allowed.includes(info.key);
                      const outside = !unitInType(info.key, broker.branchId);
                      const mismatch = allowed && editingEntry.modality !== "any" && info.modality !== null && info.modality !== editingEntry.modality;
                      return (
                        <li key={info.key} className="grid gap-1 px-3 py-2">
                          <div className="flex items-center gap-2">
                            <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                              <Checkbox checked={allowed} onCheckedChange={(checked) => setAllowed(editingEntry, info.key, checked === true)} aria-label={`Pode tirar ${info.name ?? "Sem tipo"}`} />
                              <DutyTypeTag name={info.name} hue={info.hue} className="text-sm" />
                              {info.modality ? <span className="text-xs text-muted-foreground">{MODALITY_LABEL[info.modality]}</span> : null}
                            </label>
                            {allowed ? <Stepper value={editingEntry.seats[info.key] ?? 0} onChange={(value) => setSeats(editingEntry.brokerId, info.key, value)} label={`cadeiras de ${info.name ?? "Sem tipo"}`} /> : <span className="text-xs text-muted-foreground">Não tira</span>}
                          </div>
                          {outside ? <p className="pl-6 text-xs text-warning">{allowed ? "Unidade fora deste tipo (você confirmou)." : "A unidade dele não participa deste tipo."}</p> : null}
                          {mismatch ? <p className="pl-6 text-xs text-warning">Os plantões deste tipo são {MODALITY_LABEL[info.modality!].toLocaleLowerCase("pt-BR")}; com a modalidade escolhida ele não entra neles.</p> : null}
                          {allowed && !(editingEntry.seats[info.key] > 0) ? <p className="pl-6 text-xs text-warning">Defina quantas cadeiras ele tem neste tipo.</p> : null}
                        </li>
                      );
                    })}
                  </ul>
                  <p className="text-xs text-muted-foreground">Cadeira = um plantão (uma data) daquele tipo no período.</p>
                </div>
              </DialogPanel>
              <DialogFooter>
                <Button type="button" onClick={() => setEditingBroker(null)}>Pronto</Button>
              </DialogFooter>
            </DialogPopup>
          );
        })() : null}
      </Dialog>

      <Dialog open={Boolean(confirmForce)} onOpenChange={(next) => { if (!next) setConfirmForce(null); }}>
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>{confirmForce?.title}</DialogTitle>
            <DialogDescription>{confirmForce?.message}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmForce(null)}>Cancelar</Button>
            <Button type="button" onClick={() => { confirmForce?.onConfirm(); setConfirmForce(null); }}>Confirmar mesmo assim</Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      {plan ? <EscalaPdfDialog open={pdfOpen} onOpenChange={setPdfOpen} planId={plan.id} canChooseUnit={canEdit} branches={branches} types={planTypeKeys.map((key) => ({ key, name: typeInfo.get(key)?.name ?? "Sem tipo" }))} /> : null}

      <Dialog open={confirmPublish} onOpenChange={setConfirmPublish}>
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>Publicar a escala de {monthLabel(month)}?</DialogTitle>
            <DialogDescription>
              {plan?.totalAssigned ?? 0} alocações passam a valer na distribuição nas datas publicadas e cada corretor recebe uma notificação.
              {plan?.belowMinimum ? ` ${plan.belowMinimum} datas ficam abaixo do mínimo.` : ""}{plan?.replacesPublished ? " Ela substitui a escala publicada nas datas que ainda não passaram; quem continua no mesmo plantão não perde presença nem pausa." : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => setConfirmPublish(false)}>Voltar</Button>
            <Button type="button" disabled={pending} onClick={publish}>{busyKey === "publish" ? "Publicando…" : "Publicar escala"}</Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </>
  );
}

/** Picks the cut of the escala PDF: everything, one unit or one plantão type. */
function EscalaPdfDialog({ open, onOpenChange, planId, canChooseUnit, branches, types }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planId: string;
  /** Managers only get their own unit (the server forces it). */
  canChooseUnit: boolean;
  branches: readonly Branch[];
  types: ReadonlyArray<{ key: string; name: string }>;
}) {
  const [scope, setScope] = useState<"geral" | "unidade" | "tipo">(canChooseUnit ? "geral" : "unidade");
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [typeKey, setTypeKey] = useState(types[0]?.key ?? "");
  const choices = canChooseUnit
    ? ([["geral", "Geral"], ["unidade", "Por unidade"], ["tipo", "Por tipo de plantão"]] as const)
    : ([["unidade", "Minha unidade"]] as const);
  const href = () => {
    const params = new URLSearchParams({ scope });
    if (scope === "unidade" && canChooseUnit) params.set("branchId", branchId);
    if (scope === "tipo") params.set("typeId", typeKey);
    return `/api/reports/duty-escala/${planId}?${params}`;
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>Gerar PDF da escala</DialogTitle>
          <DialogDescription>Um quadro de escala por dia, com as cores de cada tipo, o código, o nome e a unidade de cada corretor.</DialogDescription>
        </DialogHeader>
        <DialogPanel className="gap-3">
          <div role="radiogroup" aria-label="Recorte do PDF" className="grid gap-1.5">
            {choices.map(([value, label]) => (
              <label key={value} className="flex cursor-pointer items-center gap-2 rounded-[var(--radius-card)] border border-border px-3 py-2 text-sm has-[:checked]:border-foreground/40">
                <input type="radio" name="escala-pdf-scope" value={value} checked={scope === value} onChange={() => setScope(value)} className="accent-current" />
                {label}
              </label>
            ))}
          </div>
          {scope === "unidade" && canChooseUnit ? <AppSelect aria-label="Unidade do PDF" value={branchId} onValueChange={setBranchId} options={branches.map((branch) => ({ value: branch.id, label: branch.name }))} /> : null}
          {scope === "tipo" ? <AppSelect aria-label="Tipo do PDF" value={typeKey} onValueChange={setTypeKey} options={types.map((type) => ({ value: type.key, label: type.name }))} /> : null}
        </DialogPanel>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" disabled={(scope === "unidade" && canChooseUnit && !branchId) || (scope === "tipo" && !typeKey)} onClick={() => { window.open(href(), "_blank", "noopener"); onOpenChange(false); }}>
            <FileArrowDown className="size-3.5" /> Baixar PDF
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}

