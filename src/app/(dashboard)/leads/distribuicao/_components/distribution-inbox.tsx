"use client";

import { useActionState, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, CheckCircle, MagicWand, UserList } from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AppSelect } from "@/components/ui/select";
import {
  assignLeadToBrokerAction,
  distributeLeadBatchAction,
  distributeLeadAutomaticallyAction,
  routeAndAssignLeadAction,
  routeLeadToBranchAction,
  type DistributionActionState,
} from "@/features/lead-distribution/actions";

type Lead = {
  id: string;
  name: string;
  phone: string;
  branchId: string | null;
  distributionStatus: string;
  createdAt: string;
};
type Branch = { id: string; name: string };
type Broker = {
  id: string;
  name: string;
  branchId: string | null;
  activeLeads: number;
  availabilityStatus: "available" | "paused" | "offline";
};

const PAGE_SIZE = 10;
const MAX_BATCH = 10;

function Feedback({ state }: { state: DistributionActionState }) {
  if (state.success && state.message) toast.success(state.message);
  if (state.error) toast.error(state.error);
  return null;
}

function ActionForm({
  action,
  children,
  fields,
}: {
  action: (
    previous: DistributionActionState,
    formData: FormData,
  ) => Promise<DistributionActionState>;
  children: React.ReactNode;
  fields: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} name={name} type="hidden" value={value} />
      ))}
      <Button disabled={pending} size="sm" type="submit" variant="outline">
        {children}
      </Button>
      <Feedback state={state} />
    </form>
  );
}

export function DistributionInbox({
  role,
  leads,
  branches,
  brokers,
}: {
  role: string;
  leads: Lead[];
  branches: Branch[];
  brokers: Broker[];
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const managerBranchId = role === "manager" ? (branches[0]?.id ?? "") : "";
  const [brokerByLead, setBrokerByLead] = useState<Record<string, string>>({});
  const [unitFilter, setUnitFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const selectable = leads.filter(
    (lead) =>
      lead.distributionStatus === "unassigned" ||
      lead.distributionStatus === "queued" ||
      lead.distributionStatus === "returned_to_queue",
  );
  const filtered = useMemo(
    () =>
      selectable.filter((lead) => {
        const matchesUnit = unitFilter === "all" || lead.branchId === unitFilter;
        const matchesStatus = statusFilter === "all" || lead.distributionStatus === statusFilter;
        return matchesUnit && matchesStatus;
      }),
    [selectable, statusFilter, unitFilter],
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function toggle(id: string) {
    setSelected((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= MAX_BATCH) {
        toast.error(`Máximo de ${MAX_BATCH} leads por envio.`);
        return current;
      }
      return [...current, id];
    });
  }

  function toggleVisible() {
    setSelected((current) => {
      const visibleIds = visible.map((lead) => lead.id);
      if (visibleIds.every((id) => current.includes(id))) {
        return current.filter((id) => !visibleIds.includes(id));
      }
      const missing = visibleIds.filter((id) => !current.includes(id));
      if (current.length + missing.length > MAX_BATCH) {
        toast.error(`Máximo de ${MAX_BATCH} leads por envio.`);
        return current;
      }
      return [...current, ...missing];
    });
  }

  function changeUnitFilter(value: string) {
    setUnitFilter(value);
    setPage(1);
    setSelected([]);
    if (value !== "all") setBranchId(value);
  }

  function changeStatusFilter(value: string) {
    setStatusFilter(value);
    setPage(1);
    setSelected([]);
  }

  const stateAction = useActionState(distributeLeadBatchAction, {});
  const [batchState, batchAction, batchPending] = stateAction;

  return (
    <Card variant="overview" data-onboarding="manager-team-performance">
      <CardHeader className="border-b border-border px-5 pb-4 pt-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <UserList className="size-4 text-primary" /> Inbox geral e fila de distribuição
            </CardTitle>
            <CardDescription className="mt-1">
              Leads sem corretor ficam aqui até serem enviados para uma unidade e uma fila.
            </CardDescription>
          </div>
          {selected.length ? (
            <form action={batchAction} className="flex flex-wrap items-center gap-2">
              <input name="leadIds" type="hidden" value={selected.join(",")} />
              {role === "director" ? (
                <AppSelect
                  aria-label="Unidade de destino"
                  name="branchId"
                  value={branchId}
                  onValueChange={setBranchId}
                  size="sm"
                  className="w-40"
                  options={branches.map((b) => ({ value: b.id, label: b.name }))}
                />
              ) : (
                <input name="branchId" type="hidden" value={managerBranchId} />
              )}
              <Button disabled={batchPending} size="sm" type="submit">
                <ArrowRight /> Enviar selecionados ({selected.length}/{MAX_BATCH})
              </Button>
              <Feedback state={batchState} />
            </form>
          ) : null}
        </div>
        <div className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <AppSelect
              aria-label="Filtrar por unidade"
              className="w-full sm:w-52"
              value={unitFilter}
              onValueChange={changeUnitFilter}
              options={[
                { value: "all", label: "Todas as unidades" },
                ...branches.map((b) => ({ value: b.id, label: b.name })),
              ]}
            />
            <AppSelect
              aria-label="Filtrar por status"
              className="w-full sm:w-52"
              value={statusFilter}
              onValueChange={changeStatusFilter}
              options={[
                { value: "all", label: "Todos os status" },
                { value: "unassigned", label: "Aguardando unidade" },
                { value: "queued", label: "Aguardando corretor" },
                { value: "returned_to_queue", label: "Devolvido à fila" },
              ]}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Até {PAGE_SIZE} por página · máx. {MAX_BATCH} por envio
          </p>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {!selectable.length ? (
          <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
            <span className="grid size-9 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle aria-hidden="true" className="size-5" />
            </span>
            <p className="text-sm font-medium">Inbox em dia</p>
            <p className="text-xs text-muted-foreground">
              Não há leads aguardando unidade ou corretor neste escopo.
            </p>
          </div>
        ) : !filtered.length ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border px-4 py-12 text-center">
            <span className="grid size-9 place-items-center rounded-lg bg-muted/60 text-muted-foreground">
              <UserList aria-hidden="true" className="size-5" />
            </span>
            <p className="text-sm font-medium">Nenhum lead com os filtros atuais</p>
            <p className="text-xs text-muted-foreground">
              Ajuste a unidade ou o status para ver os leads da fila.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-border bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground">
              <span>
                <strong className="font-semibold text-foreground">{filtered.length}</strong> lead
                {filtered.length === 1 ? "" : "s"} na fila
              </span>
              <span>{totalPages > 1 ? `Página ${currentPage} de ${totalPages}` : null}</span>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 pl-5">
                      <input
                        aria-label="Selecionar todos da página"
                        checked={
                          visible.length > 0 && visible.every((lead) => selected.includes(lead.id))
                        }
                        onChange={toggleVisible}
                        type="checkbox"
                      />
                    </TableHead>
                    <TableHead>Lead</TableHead>
                    <TableHead>Destino atual</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="pr-5 text-right">Próxima ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((lead) => {
                    const leadBrokers = brokers.filter(
                      (broker) =>
                        broker.branchId === lead.branchId &&
                        broker.availabilityStatus === "available",
                    );
                    return (
                      <TableRow key={lead.id}>
                        <TableCell className="pl-5">
                          <input
                            aria-label={`Selecionar ${lead.name}`}
                            checked={selected.includes(lead.id)}
                            onChange={() => toggle(lead.id)}
                            type="checkbox"
                          />
                        </TableCell>
                        <TableCell>
                          <p className="font-medium">{lead.name}</p>
                          <p className="text-xs text-muted-foreground">{lead.phone}</p>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {branches.find((branch) => branch.id === lead.branchId)?.name ??
                              "Inbox geral"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              lead.distributionStatus === "queued" ||
                              lead.distributionStatus === "returned_to_queue"
                                ? "warning"
                                : "outline"
                            }
                          >
                            {lead.distributionStatus === "queued"
                              ? "Aguardando corretor"
                              : lead.distributionStatus === "returned_to_queue"
                                ? "Devolvido à fila"
                                : "Aguardando unidade"}
                          </Badge>
                        </TableCell>
                        <TableCell className="pr-5" data-onboarding="manager-redistribute-lead">
                          <div className="flex flex-wrap justify-end gap-2">
                            <ActionForm
                              action={routeLeadToBranchAction}
                              fields={{ leadId: lead.id, branchId }}
                            >
                              <ArrowRight /> Enviar
                            </ActionForm>
                            {lead.branchId ? (
                              <>
                                <AppSelect
                                  aria-label={`Corretor para ${lead.name}`}
                                  size="sm"
                                  className="w-36"
                                  value={brokerByLead[lead.id] ?? ""}
                                  onValueChange={(val) =>
                                    setBrokerByLead((current) => ({ ...current, [lead.id]: val }))
                                  }
                                  placeholder="Corretor..."
                                  options={[
                                    { value: "", label: "Corretor" },
                                    ...leadBrokers.map((b) => ({ value: b.id, label: b.name })),
                                  ]}
                                />
                                {brokerByLead[lead.id] ? (
                                  <ActionForm
                                    action={assignLeadToBrokerAction}
                                    fields={{ leadId: lead.id, brokerId: brokerByLead[lead.id] }}
                                  >
                                    <UserList /> Atribuir
                                  </ActionForm>
                                ) : null}
                                <ActionForm
                                  action={distributeLeadAutomaticallyAction}
                                  fields={{ leadId: lead.id }}
                                >
                                  <MagicWand /> Auto
                                </ActionForm>
                              </>
                            ) : role === "director" ? (
                              <>
                                <AppSelect
                                  aria-label={`Corretor para ${lead.name}`}
                                  size="sm"
                                  className="w-36"
                                  value={brokerByLead[lead.id] ?? ""}
                                  onValueChange={(val) =>
                                    setBrokerByLead((current) => ({ ...current, [lead.id]: val }))
                                  }
                                  placeholder="Corretor..."
                                  options={[
                                    { value: "", label: "Corretor" },
                                    ...brokers
                                      .filter(
                                        (b) =>
                                          b.branchId === branchId &&
                                          b.availabilityStatus === "available",
                                      )
                                      .map((b) => ({ value: b.id, label: b.name })),
                                  ]}
                                />
                                {brokerByLead[lead.id] ? (
                                  <ActionForm
                                    action={routeAndAssignLeadAction}
                                    fields={{
                                      leadId: lead.id,
                                      branchId,
                                      brokerId: brokerByLead[lead.id],
                                    }}
                                  >
                                    <UserList /> Rotear + Atribuir
                                  </ActionForm>
                                ) : null}
                              </>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {totalPages > 1 ? (
              <div className="flex items-center justify-between border-t border-border px-4 py-3">
                <p className="text-xs text-muted-foreground">
                  {filtered.length} lead{filtered.length === 1 ? "" : "s"} · {PAGE_SIZE} por página
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    aria-label="Página anterior"
                    disabled={currentPage === 1}
                    onClick={() => setPage((value) => Math.max(1, value - 1))}
                    size="xs"
                    type="button"
                    variant="outline"
                  >
                    <ArrowRight className="rotate-180" /> Anterior
                  </Button>
                  <Button
                    aria-label="Próxima página"
                    disabled={currentPage === totalPages}
                    onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                    size="xs"
                    type="button"
                    variant="outline"
                  >
                    Próxima <ArrowRight />
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
