"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Buildings,
  FileText,
  MagnifyingGlass,
  PencilSimple,
  Phone,
  Plus,
  Power,
  Trash,
} from "@/components/huge-icons";
import { EmptyState } from "@/components/empty-state";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  createPlanAction,
  deletePlanAction,
  getCarrierPlans,
  togglePlanAction,
  updateCarrierAction,
  updatePlanAction,
  getPlanPrices,
  upsertPlanPricesAction,
} from "@/features/catalog/actions";
import { normalize } from "@/features/quotes/utils";
import type {
  CatalogActionState,
  CarrierPlanRecord,
  CarrierRecord,
} from "@/features/catalog/types";

function ActionFeedback({ state }: { state: CatalogActionState }) {
  useEffect(() => {
    if (state.success) toast.success("Alterações salvas.");
    if (state.error) toast.error(state.error);
  }, [state.error, state.success]);

  return null;
}

function getPlanTypeLabel(plan: CarrierPlanRecord) {
  return {
    individual: "Individual",
    empresarial: "Empresarial",
    familiar: "Familiar",
    pme: "PME",
  }[plan.type];
}

function CarrierStatus({ status }: { status: CarrierRecord["status"] }) {
  const active = status === "active";

  return (
    <Badge
      variant="outline"
      className={
        active
          ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
          : "border-border bg-muted/40 text-muted-foreground"
      }
    >
      {active ? "Ativa" : "Inativa"}
    </Badge>
  );
}

const DEFAULT_AGE_BANDS = [
  "0 a 18",
  "19 a 23",
  "24 a 28",
  "29 a 33",
  "34 a 38",
  "39 a 43",
  "44 a 48",
  "49 a 53",
  "54 a 58",
  "59+",
];

function PlanForm({
  carrierId,
  plan,
  onDone,
}: {
  carrierId: string;
  plan?: CarrierPlanRecord;
  onDone: () => void;
}) {
  const action = plan ? updatePlanAction : createPlanAction;
  const [state, formAction, pending] = useActionState<CatalogActionState, FormData>(action, {});
  const formRef = useRef<HTMLFormElement>(null);
  const prefix = plan ? `edit-${plan.id}` : `new-${carrierId}`;

  // Preço por faixa etária state
  const [prices, setPrices] = useState<{ ageBand: string; monthlyPrice: number }[]>(() =>
    DEFAULT_AGE_BANDS.map((band) => ({ ageBand: band, monthlyPrice: 0 })),
  );
  useEffect(() => {
    if (!plan) return;
    getPlanPrices(plan.id).then((existingPrices) => {
      if (existingPrices.length > 0) {
        const map = new Map(existingPrices.map((p) => [p.ageBand, Number(p.monthlyPrice)]));
        setPrices(
          DEFAULT_AGE_BANDS.map((band) => ({
            ageBand: band,
            monthlyPrice: map.get(band) ?? 0,
          })),
        );
      }
    });
  }, [plan]);

  useEffect(() => {
    if (!state.success) return;
    if (plan) {
      // Se for edição, salvar os preços em paralelo
      upsertPlanPricesAction(plan.id, prices).then((res) => {
        if (res.error) toast.error(`Erro ao salvar preços: ${res.error}`);
        else onDone();
      });
    } else {
      formRef.current?.reset();
      onDone();
    }
  }, [onDone, state.success, plan, prices]);

  const handlePriceChange = (band: string, val: string) => {
    const num = parseFloat(val) || 0;
    setPrices((prev) => prev.map((p) => (p.ageBand === band ? { ...p, monthlyPrice: num } : p)));
  };

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <input type="hidden" name="carrierId" value={carrierId} />
      {plan && <input type="hidden" name="planId" value={plan.id} />}

      <div className="space-y-2">
        <Label htmlFor={`${prefix}-name`}>Nome do plano</Label>
        <Input
          id={`${prefix}-name`}
          name="name"
          defaultValue={plan?.name}
          placeholder="Ex.: Plano Essencial 300"
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${prefix}-type`}>Tipo</Label>
          <select
            id={`${prefix}-type`}
            name="type"
            defaultValue={plan?.type ?? "individual"}
            className="flex h-9 w-full rounded-lg border border-input bg-input/30 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <option value="individual">Individual</option>
            <option value="empresarial">Empresarial</option>
            <option value="familiar">Familiar</option>
            <option value="pme">PME</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${prefix}-coverage`}>Abrangência</Label>
          <select
            id={`${prefix}-coverage`}
            name="coverage"
            defaultValue={plan?.coverage ?? ""}
            className="flex h-9 w-full rounded-lg border border-input bg-input/30 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <option value="">Não informada</option>
            <option value="Nacional">Nacional</option>
            <option value="Estadual">Estadual</option>
            <option value="Municipal">Municipal</option>
            <option value="Regional">Regional</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${prefix}-description`}>Descrição</Label>
        <Textarea
          id={`${prefix}-description`}
          name="description"
          defaultValue={plan?.description ?? ""}
          placeholder="Coberturas, diferenciais ou observações comerciais."
          rows={3}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${prefix}-ans`}>Registro ANS</Label>
          <Input
            id={`${prefix}-ans`}
            name="ansRegistration"
            defaultValue={plan?.ansRegistration ?? ""}
            placeholder="Ex.: 12345"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${prefix}-age`}>Idade máxima de entrada</Label>
          <Input
            id={`${prefix}-age`}
            name="maxEntryAge"
            type="number"
            min={0}
            max={120}
            defaultValue={plan?.maxEntryAge ?? ""}
            placeholder="Ex.: 59"
          />
        </div>
      </div>

      {plan && (
        <div className="space-y-3 rounded-lg border p-4 bg-muted/10">
          <div>
            <Label className="text-sm font-semibold">Tabela de Preços (Faixa Etária)</Label>
            <p className="text-xs text-muted-foreground">
              Informe o preço mensal para cada faixa etária da ANS.
            </p>
          </div>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-5">
            {prices.map((p) => (
              <div key={p.ageBand} className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-muted-foreground">
                  {p.ageBand} anos
                </span>
                <CurrencyInput
                  className="h-8 text-xs"
                  value={String(p.monthlyPrice || "")}
                  onChange={(val) => handlePriceChange(p.ageBand, val)}
                  placeholder="0,00"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <Button className="w-full" type="submit" disabled={pending}>
        {pending ? "Salvando..." : plan ? "Salvar plano e preços" : "Criar plano"}
      </Button>
      <ActionFeedback state={state} />
    </form>
  );
}

function PlanRow({ plan, onEdit }: { plan: CarrierPlanRecord; onEdit: () => void }) {
  const [toggleState, toggleAction, togglePending] = useActionState<CatalogActionState, FormData>(
    togglePlanAction,
    {},
  );
  const [deleteState, deleteAction, deletePending] = useActionState<CatalogActionState, FormData>(
    deletePlanAction,
    {},
  );

  return (
    <TableRow>
      <TableCell className="min-w-52 whitespace-normal py-3">
        <p className="font-medium">{plan.name}</p>
        {plan.description && (
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{plan.description}</p>
        )}
      </TableCell>
      <TableCell>
        <Badge variant="outline">{getPlanTypeLabel(plan)}</Badge>
      </TableCell>
      <TableCell className="text-muted-foreground">{plan.coverage ?? "Não informada"}</TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className={
            plan.active
              ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
              : "text-muted-foreground"
          }
        >
          {plan.active ? "Ativo" : "Inativo"}
        </Badge>
      </TableCell>
      <TableCell className="w-32 text-right">
        <div className="flex justify-end gap-1">
          <form action={toggleAction}>
            <input type="hidden" name="planId" value={plan.id} />
            <Button
              type="submit"
              size="icon-sm"
              variant="ghost"
              disabled={togglePending}
              aria-label={plan.active ? "Desativar plano" : "Ativar plano"}
            >
              <Power className="size-4" />
            </Button>
          </form>
          <Button size="icon-sm" variant="ghost" onClick={onEdit} aria-label="Editar plano">
            <PencilSimple className="size-4" />
          </Button>
          <form action={deleteAction}>
            <input type="hidden" name="planId" value={plan.id} />
            <Button
              type="submit"
              size="icon-sm"
              variant="ghost"
              disabled={deletePending}
              className="text-destructive hover:text-destructive"
              aria-label="Excluir plano"
            >
              <Trash className="size-4" />
            </Button>
          </form>
        </div>
        <ActionFeedback state={toggleState} />
        <ActionFeedback state={deleteState} />
      </TableCell>
    </TableRow>
  );
}

export function CarrierSheet({ carrier: initialCarrier }: { carrier: CarrierRecord }) {
  const [open, setOpen] = useState(false);
  const [plans, setPlans] = useState<CarrierPlanRecord[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [editingPlan, setEditingPlan] = useState<CarrierPlanRecord | null>(null);
  const [showCreatePlan, setShowCreatePlan] = useState(false);
  const [updateState, updateAction, updatePending] = useActionState<CatalogActionState, FormData>(
    updateCarrierAction,
    {},
  );

  async function refreshPlans() {
    setPlansLoading(true);
    try {
      setPlans(await getCarrierPlans(initialCarrier.id));
    } catch {
      toast.error("Não foi possível carregar os planos desta operadora.");
    } finally {
      setPlansLoading(false);
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          setEditingPlan(null);
          setShowCreatePlan(false);
          void refreshPlans();
        }
      }}
    >
      <SheetTrigger
        render={
          <button
            type="button"
            className="group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-4 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:grid-cols-[2.2rem_minmax(0,1.3fr)_minmax(0,1fr)_8rem_7rem_2.25rem] sm:px-5"
          >
            <span className="hidden size-9 items-center justify-center rounded-lg bg-primary/10 sm:flex">
              <Buildings className="size-4 text-primary" weight="fill" />
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-2">
                <span className="truncate font-medium">{initialCarrier.name}</span>
                <span className="sm:hidden">
                  <CarrierStatus status={initialCarrier.status} />
                </span>
              </span>
              <span className="mt-1 block truncate text-xs text-muted-foreground">
                {initialCarrier.ansCode
                  ? `ANS ${initialCarrier.ansCode}`
                  : "Código ANS não informado"}
              </span>
            </span>
            <span className="hidden min-w-0 sm:block">
              <span className="block truncate text-sm text-foreground">
                {initialCarrier.contact ?? "Contato não informado"}
              </span>
              <span className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground">
                <Phone className="size-3" />
                {initialCarrier.phone ?? initialCarrier.email ?? "Sem canal cadastrado"}
              </span>
            </span>
            <span className="hidden sm:block">
              <CarrierStatus status={initialCarrier.status} />
            </span>
            <span className="hidden text-sm text-muted-foreground sm:block">
              {initialCarrier.planCount} {initialCarrier.planCount === 1 ? "plano" : "planos"}
            </span>
            <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </button>
        }
      />

      <SheetContent className="w-full gap-0 overflow-hidden p-0 sm:w-[min(100vw-2rem,50rem)]">
        <SheetHeader className="border-b px-6 py-5 pr-14 sm:px-8">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Buildings className="size-5 text-primary" weight="fill" />
            </div>
            <div className="min-w-0 space-y-1">
              <SheetTitle className="truncate text-lg">{initialCarrier.name}</SheetTitle>
              <SheetDescription>
                Gerencie os dados comerciais e os planos disponíveis nesta operadora.
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <SheetBody contentClassName="px-6 py-6 sm:px-8">
          <div className="space-y-7">
            <section className="grid gap-3 sm:grid-cols-3" aria-label="Resumo da operadora">
              <div className="rounded-xl border bg-muted/20 p-4">
                <p className="text-xs font-medium text-muted-foreground">Status</p>
                <div className="mt-2">
                  <CarrierStatus status={initialCarrier.status} />
                </div>
              </div>
              <div className="rounded-xl border bg-muted/20 p-4">
                <p className="text-xs font-medium text-muted-foreground">Planos ativos</p>
                <p className="mt-1 text-2xl font-semibold tracking-tight">
                  {initialCarrier.planCount}
                </p>
              </div>
              <div className="rounded-xl border bg-muted/20 p-4">
                <p className="text-xs font-medium text-muted-foreground">Código ANS</p>
                <p className="mt-1 truncate text-sm font-medium">
                  {initialCarrier.ansCode ?? "Não informado"}
                </p>
              </div>
            </section>

            <section className="space-y-4">
              <div>
                <h3 className="font-heading text-base font-medium">Dados da operadora</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Estas informações apoiam o trabalho comercial interno.
                </p>
              </div>
              <form
                action={updateAction}
                className="space-y-4 rounded-xl border bg-card p-4 sm:p-5"
              >
                <input type="hidden" name="carrierId" value={initialCarrier.id} />
                <div className="rounded-lg bg-muted/50 px-3 py-2.5">
                  <p className="text-xs text-muted-foreground">Operadora</p>
                  <p className="mt-0.5 font-medium">{initialCarrier.name}</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`carrier-ans-${initialCarrier.id}`}>Código ANS</Label>
                    <Input
                      id={`carrier-ans-${initialCarrier.id}`}
                      name="ansCode"
                      defaultValue={initialCarrier.ansCode ?? ""}
                      placeholder="Ex.: 12345"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`carrier-status-${initialCarrier.id}`}>Status</Label>
                    <select
                      id={`carrier-status-${initialCarrier.id}`}
                      name="status"
                      defaultValue={initialCarrier.status}
                      className="flex h-9 w-full rounded-lg border border-input bg-input/30 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                      <option value="active">Ativa</option>
                      <option value="inactive">Inativa</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`carrier-contact-${initialCarrier.id}`}>Contato</Label>
                  <Input
                    id={`carrier-contact-${initialCarrier.id}`}
                    name="contact"
                    defaultValue={initialCarrier.contact ?? ""}
                    placeholder="Nome do contato na operadora"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`carrier-phone-${initialCarrier.id}`}>Telefone</Label>
                    <Input
                      id={`carrier-phone-${initialCarrier.id}`}
                      name="phone"
                      defaultValue={initialCarrier.phone ?? ""}
                      placeholder="(11) 99999-9999"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`carrier-email-${initialCarrier.id}`}>E-mail</Label>
                    <Input
                      id={`carrier-email-${initialCarrier.id}`}
                      name="email"
                      type="email"
                      defaultValue={initialCarrier.email ?? ""}
                      placeholder="contato@operadora.com"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`carrier-notes-${initialCarrier.id}`}>Observações</Label>
                  <Textarea
                    id={`carrier-notes-${initialCarrier.id}`}
                    name="notes"
                    defaultValue={initialCarrier.notes ?? ""}
                    rows={3}
                    placeholder="Informações internas sobre a operadora."
                  />
                </div>
                <div className="flex justify-end">
                  <Button type="submit" disabled={updatePending}>
                    {updatePending ? "Salvando..." : "Salvar dados"}
                  </Button>
                </div>
                <ActionFeedback state={updateState} />
              </form>
            </section>

            <Separator />

            <section className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h3 className="font-heading text-base font-medium">Planos</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Cadastre e mantenha os planos disponíveis para cotação.
                  </p>
                </div>
                {!showCreatePlan && !editingPlan && (
                  <Button onClick={() => setShowCreatePlan(true)}>
                    <Plus className="size-4" />
                    Novo plano
                  </Button>
                )}
              </div>

              {(showCreatePlan || editingPlan) && (
                <Card className="border-primary/20 bg-primary/[0.03] shadow-none">
                  <CardContent className="space-y-4 p-4 sm:p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h4 className="font-medium">
                          {editingPlan ? "Editar plano" : "Novo plano"}
                        </h4>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Preencha os dados que serão usados pelo catálogo e pelas cotações.
                        </p>
                      </div>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingPlan(null);
                          setShowCreatePlan(false);
                        }}
                        aria-label="Cancelar edição"
                      >
                        <ArrowRight className="size-4 rotate-180" />
                      </Button>
                    </div>
                    <PlanForm
                      carrierId={initialCarrier.id}
                      plan={editingPlan ?? undefined}
                      onDone={() => {
                        void refreshPlans();
                        setEditingPlan(null);
                        setShowCreatePlan(false);
                      }}
                    />
                  </CardContent>
                </Card>
              )}

              {plansLoading ? (
                <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                  Carregando planos...
                </div>
              ) : plans.length === 0 && !showCreatePlan ? (
                <EmptyState
                  icon={FileText}
                  title="Nenhum plano cadastrado"
                  description="Adicione o primeiro plano para disponibilizá-lo ao time comercial."
                  action={
                    <Button variant="outline" onClick={() => setShowCreatePlan(true)}>
                      <Plus className="size-4" />
                      Adicionar plano
                    </Button>
                  }
                />
              ) : plans.length > 0 ? (
                <div className="overflow-hidden rounded-xl border">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead>Plano</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Abrangência</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {plans.map((plan) => (
                        <PlanRow
                          key={plan.id}
                          plan={plan}
                          onEdit={() => {
                            setEditingPlan(plan);
                            setShowCreatePlan(false);
                          }}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : null}
            </section>
          </div>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}

export function CarriersGrid({ carriers }: { carriers: CarrierRecord[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | CarrierRecord["status"]>("all");
  const normalizedQuery = normalize(query.trim());
  const visibleCarriers = carriers.filter((carrier) => {
    const matchesStatus = status === "all" || carrier.status === status;
    const searchable = [
      carrier.name,
      carrier.ansCode,
      carrier.contact,
      carrier.phone,
      carrier.email,
    ]
      .filter((value): value is string => Boolean(value))
      .join(" ");
    return matchesStatus && (!normalizedQuery || normalize(searchable).includes(normalizedQuery));
  });

  if (carriers.length === 0) {
    return (
      <EmptyState
        icon={Buildings}
        variant="card"
        title="Nenhuma operadora cadastrada"
        description="As operadoras disponíveis aparecerão aqui quando forem cadastradas."
      />
    );
  }

  return (
    <section
      className="overflow-hidden rounded-xl border bg-card"
      aria-label="Operadoras cadastradas"
    >
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <h2 className="font-heading text-base font-medium">Operadoras</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Selecione uma operadora para ver seus dados e planos.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <div className="relative sm:w-72">
            <MagnifyingGlass className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="pl-9"
              placeholder="Buscar operadora, ANS ou contato"
              aria-label="Buscar operadora, ANS ou contato"
            />
          </div>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as "all" | CarrierRecord["status"])}
            className="h-9 rounded-lg border border-input bg-input/30 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            aria-label="Filtrar por status"
          >
            <option value="all">Todas</option>
            <option value="active">Ativas</option>
            <option value="inactive">Inativas</option>
          </select>
        </div>
      </div>

      <div className="hidden grid-cols-[2.2rem_minmax(0,1.3fr)_minmax(0,1fr)_8rem_7rem_2.25rem] items-center gap-4 border-b bg-muted/30 px-5 py-2 text-xs font-medium text-muted-foreground sm:grid">
        <span />
        <span>Operadora</span>
        <span>Contato</span>
        <span>Status</span>
        <span>Planos ativos</span>
        <span className="sr-only">Abrir</span>
      </div>

      <div className="divide-y">
        {visibleCarriers.map((carrier) => (
          <CarrierSheet key={carrier.id} carrier={carrier} />
        ))}
      </div>

      {visibleCarriers.length === 0 && (
        <div className="px-6 py-12">
          <EmptyState
            icon={MagnifyingGlass}
            title="Nenhuma operadora encontrada"
            description="Ajuste a busca ou o filtro de status para ver outros resultados."
            action={
              <Button variant="outline" onClick={() => { setQuery(""); setStatus("all"); }}>
                Limpar filtros
              </Button>
            }
          />
        </div>
      )}
    </section>
  );
}
