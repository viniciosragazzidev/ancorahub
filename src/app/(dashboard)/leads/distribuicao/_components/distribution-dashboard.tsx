"use client";

import { useActionState, useEffect, useMemo, useState, useId } from "react";
import { motion } from "motion/react";
import {
  Buildings,
  CheckCircle,
  Users,
  WifiHigh,
  XCircle,
  TrendUp,
  Power,
  Pause,
  MagnifyingGlass,
  ArrowRight,
} from "@/components/huge-icons";
import { toast } from "sonner";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AppSelect } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  setBrokersAvailabilityAction,
  toggleAcceptingLeadsAction,
  toggleAutoDistributeAction,
  toggleBrokerAvailabilityAction,
  type BranchActionState,
} from "@/features/branches/actions";

type BranchItem = {
  id: string;
  name: string;
  status: "active" | "inactive";
  acceptingLeads: boolean;
  autoDistribute: boolean;
  memberCount: number;
  availableBrokers: number;
  activeLeads: number;
  newLeads: number;
};

type Metrics = {
  totalBranches: number;
  acceptingBranches: number;
  autoDistributeBranches: number;
  totalBrokers: number;
  totalAvailable: number;
  totalNewLeads: number;
};

type BrokerItem = {
  id: string;
  name: string;
  email: string;
  branchId: string | null;
  branchName: string | null;
  availabilityStatus: "available" | "paused" | "offline";
  activeLeads: number;
};

function ActionFeedback({ state }: { state: BranchActionState }) {
  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.message) toast.success(state.message);
    else if (state.success) toast.success("Configuração atualizada.");
  }, [state.error, state.message, state.success]);
  return null;
}

function ToggleCell({
  branchId,
  label,
  enabled,
  action,
}: {
  branchId: string;
  label: string;
  enabled: boolean;
  action: (prev: BranchActionState, formData: FormData) => Promise<BranchActionState>;
}) {
  const formKey = useId();
  const [state, formAction, pending] = useActionState<BranchActionState, FormData>(action, {});
  const [formVersion, setFormVersion] = useState(0);
  const prevSuccess = useState(state.success);
  if (state.success !== prevSuccess[0]) {
    prevSuccess[0] = state.success;
    if (state.success) setFormVersion((v) => v + 1);
  }
  const prevError = useState(state.error);
  if (state.error !== prevError[0]) {
    prevError[0] = state.error;
    if (state.error) setFormVersion((v) => v + 1);
  }
  return (
    <form key={`${formKey}-${formVersion}`} action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="branchId" value={branchId} />
      <Button
        type="submit"
        disabled={pending}
        size="xs"
        variant={enabled ? "outline" : "secondary"}
        className={cn(
          enabled &&
            "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 hover:border-emerald-500/40 hover:bg-emerald-500/20 dark:border-emerald-500/35 dark:text-emerald-400",
        )}
        title={`Clique para ${enabled ? "desativar" : "ativar"} ${label}`}
      >
        {enabled ? <CheckCircle /> : <XCircle />}
        {enabled ? "Ativo" : "Inativo"}
      </Button>
      <ActionFeedback state={state} />
    </form>
  );
}

function BrokerAvailabilityToggle({ broker }: { broker: BrokerItem }) {
  const formKey = useId();
  const [state, formAction, pending] = useActionState<BranchActionState, FormData>(
    toggleBrokerAvailabilityAction,
    {},
  );
  const [formVersion, setFormVersion] = useState(0);
  const available = broker.availabilityStatus === "available";
  const prevSuccess = useState(state.success);
  if (state.success !== prevSuccess[0]) {
    prevSuccess[0] = state.success;
    if (state.success) setFormVersion((v) => v + 1);
  }
  const prevError = useState(state.error);
  if (state.error !== prevError[0]) {
    prevError[0] = state.error;
    if (state.error) setFormVersion((v) => v + 1);
  }
  return (
    <form key={`${formKey}-${formVersion}`} action={formAction}>
      <input name="brokerId" type="hidden" value={broker.id} />
      <Button
        aria-label={
          available
            ? `Pausar recebimento de ${broker.name}`
            : `Retomar recebimento de ${broker.name}`
        }
        disabled={pending}
        size="xs"
        type="submit"
        variant={available ? "outline" : "secondary"}
      >
        {available ? <Pause /> : <CheckCircle />}
        {available ? "Pausar" : "Retomar"}
      </Button>
      <ActionFeedback state={state} />
    </form>
  );
}

function BrokerDirectory({ brokers }: { brokers: BrokerItem[] }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "available" | "paused" | "offline">("all");
  const [branch, setBranch] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedBrokers, setSelectedBrokers] = useState<string[]>([]);
  const pageSize = 25;
  const branches = useMemo(
    () =>
      [...new Set(brokers.map((broker) => broker.branchName))]
        .filter((item): item is string => Boolean(item))
        .sort() as string[],
    [brokers],
  );
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return brokers.filter((broker) => {
      const matchesSearch =
        !query ||
        [broker.id, broker.name, broker.email].some((value) =>
          value.toLocaleLowerCase().includes(query),
        );
      const matchesStatus = status === "all" || broker.availabilityStatus === status;
      const matchesBranch = branch === "all" || broker.branchName === branch;
      return matchesSearch && matchesStatus && matchesBranch;
    });
  }, [branch, brokers, search, status]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const [bulkState, bulkAction, bulkPending] = useActionState(setBrokersAvailabilityAction, {});

  function toggleBrokerSelection(id: string) {
    setSelectedBrokers((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  function toggleVisibleBrokers() {
    const visibleIds = visible.map((broker) => broker.id);
    setSelectedBrokers((current) => {
      if (visibleIds.every((id) => current.includes(id))) {
        return current.filter((id) => !visibleIds.includes(id));
      }
      return [...current, ...visibleIds.filter((id) => !current.includes(id))];
    });
  }

  return (
    <Card variant="overview" data-onboarding="manager-sla-monitoring">
      <CardHeader className="gap-4 border-b border-border px-5 pb-4 pt-5">
        <div>
          <CardTitle>Corretores da unidade</CardTitle>
          <CardDescription>
            Pause o recebimento de novos leads sem remover o corretor da equipe. Leads já atribuídos
            continuam na carteira dele.
          </CardDescription>
        </div>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1 lg:max-w-md">
            <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              aria-label="Buscar corretor"
              className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15"
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
                setSelectedBrokers([]);
              }}
              placeholder="Buscar por nome, ID ou e-mail..."
              value={search}
            />
          </div>
          <AppSelect
            aria-label="Filtrar por filial"
            className="w-full sm:w-44"
            value={branch}
            onValueChange={(val) => {
              setBranch(val);
              setPage(1);
              setSelectedBrokers([]);
            }}
            options={[
              { value: "all", label: "Todas as filiais" },
              ...branches.map((item) => ({ value: item, label: item })),
            ]}
          />
          <AppSelect
            aria-label="Filtrar por status"
            className="w-full sm:w-44"
            value={status}
            onValueChange={(val) => {
              setStatus(val as typeof status);
              setPage(1);
              setSelectedBrokers([]);
            }}
            options={[
              { value: "all", label: "Todos os status" },
              { value: "available", label: "Recebendo leads" },
              { value: "paused", label: "Pausados" },
              { value: "offline", label: "Offline" },
            ]}
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="flex items-center justify-between border-b border-border bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground">
          <span>
            <strong className="font-semibold text-foreground">{filtered.length}</strong> corretor
            {filtered.length === 1 ? "" : "es"} encontrado{filtered.length === 1 ? "" : "s"}
          </span>
          <span>Até 25 por página</span>
        </div>
        {selectedBrokers.length ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/20 px-4 py-2.5">
            <p className="text-xs text-muted-foreground">
              <strong className="font-semibold text-foreground">{selectedBrokers.length}</strong>{" "}
              corretor{selectedBrokers.length === 1 ? "" : "es"} selecionado
              {selectedBrokers.length === 1 ? "" : "s"}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <form action={bulkAction} onSubmit={() => setSelectedBrokers([])}>
                <input type="hidden" name="brokerIds" value={selectedBrokers.join(",")} />
                <input type="hidden" name="target" value="paused" />
                <Button disabled={bulkPending} size="xs" type="submit" variant="outline">
                  <Pause /> Pausar selecionados
                </Button>
              </form>
              <form action={bulkAction} onSubmit={() => setSelectedBrokers([])}>
                <input type="hidden" name="brokerIds" value={selectedBrokers.join(",")} />
                <input type="hidden" name="target" value="available" />
                <Button disabled={bulkPending} size="xs" type="submit" variant="outline">
                  <CheckCircle /> Retomar selecionados
                </Button>
              </form>
              <Button
                size="xs"
                type="button"
                variant="ghost"
                onClick={() => setSelectedBrokers([])}
              >
                Limpar
              </Button>
              <ActionFeedback state={bulkState} />
            </div>
          </div>
        ) : null}
        {visible.length ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 pl-4">
                    <input
                      aria-label="Selecionar corretores da página"
                      checked={
                        visible.length > 0 &&
                        visible.every((broker) => selectedBrokers.includes(broker.id))
                      }
                      onChange={toggleVisibleBrokers}
                      type="checkbox"
                    />
                  </TableHead>
                  <TableHead className="pl-4">Corretor</TableHead>
                  <TableHead>Filial</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Leads ativos</TableHead>
                  <TableHead className="pr-4 text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((broker) => (
                  <TableRow key={broker.id}>
                    <TableCell className="pl-4">
                      <input
                        aria-label={`Selecionar ${broker.name}`}
                        checked={selectedBrokers.includes(broker.id)}
                        onChange={() => toggleBrokerSelection(broker.id)}
                        type="checkbox"
                      />
                    </TableCell>
                    <TableCell className="max-w-[280px] pl-4">
                      <p className="truncate text-sm font-medium">{broker.name}</p>
                      <p className="truncate font-mono text-[11px] text-muted-foreground">
                        {broker.email}
                      </p>
                      <p
                        className="truncate font-mono text-[10px] text-muted-foreground/70"
                        title={broker.id}
                      >
                        ID {broker.id.slice(0, 12)}…
                      </p>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {broker.branchName ?? "Sem filial"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          broker.availabilityStatus === "available" ? "outline" : "secondary"
                        }
                        className={
                          broker.availabilityStatus === "available"
                            ? "border-emerald-500/35 text-emerald-600 dark:text-emerald-400"
                            : broker.availabilityStatus === "offline"
                              ? "border-rose-500/35 text-rose-600 dark:text-rose-400"
                              : ""
                        }
                      >
                        {broker.availabilityStatus === "available"
                          ? "Recebendo"
                          : broker.availabilityStatus === "offline"
                            ? "Offline"
                            : "Pausado"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums">
                      {broker.activeLeads}
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      <BrokerAvailabilityToggle broker={broker} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border px-4 py-12 text-center">
            <span className="grid size-9 place-items-center rounded-lg bg-muted/60 text-muted-foreground">
              <Users aria-hidden="true" className="size-5" />
            </span>
            <p className="text-sm font-medium">Nenhum corretor encontrado</p>
            <p className="text-xs text-muted-foreground">Ajuste a busca ou remova os filtros.</p>
          </div>
        )}
        {filtered.length > pageSize ? (
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <p className="text-xs text-muted-foreground">
              Página {currentPage} de {totalPages}
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
      </CardContent>
    </Card>
  );
}

export function DistributionMetrics({ metrics }: { metrics: Metrics }) {
  const acceptingRate =
    metrics.totalBranches > 0
      ? Math.round((metrics.acceptingBranches / metrics.totalBranches) * 100)
      : 0;
  const autoRate =
    metrics.totalBranches > 0
      ? Math.round((metrics.autoDistributeBranches / metrics.totalBranches) * 100)
      : 0;

  return (
    <motion.div
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.02 } },
      }}
    >
      {[
        {
          label: "Filiais",
          value: metrics.totalBranches,
          sub: `${metrics.acceptingBranches} aceitando leads`,
          icon: Buildings,
          tone: "bg-primary/10 text-primary",
        },
        {
          label: "Recebendo leads",
          value: `${metrics.acceptingBranches}/${metrics.totalBranches}`,
          sub: `${acceptingRate}% das filiais`,
          icon: WifiHigh,
          tone:
            acceptingRate > 50
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "bg-amber-500/10 text-amber-600 dark:text-amber-400",
        },
        {
          label: "Distribuição automática",
          value: `${metrics.autoDistributeBranches}/${metrics.totalBranches}`,
          sub: `${autoRate}% das filiais`,
          icon: TrendUp,
          tone:
            autoRate > 50
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "bg-amber-500/10 text-amber-600 dark:text-amber-400",
        },
        {
          label: "Corretores disponíveis",
          value: metrics.totalAvailable,
          sub: `${metrics.totalBrokers} corretores vinculados`,
          icon: Users,
          tone: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
        },
        {
          label: "Leads novos",
          value: metrics.totalNewLeads,
          sub: "Aguardando primeiro contato",
          icon: Power,
          tone:
            metrics.totalNewLeads > 0
              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
              : "bg-muted text-muted-foreground",
        },
      ].map((metric) => {
        const Icon = metric.icon;
        return (
          <motion.div
            key={metric.label}
            variants={{
              hidden: { opacity: 0, y: 8 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.18, ease: [0, 0, 0.2, 1] } },
            }}
            whileHover={{ y: -2, transition: { duration: 0.2, ease: [0, 0, 0.2, 1] } }}
            whileTap={{ scale: 0.995, transition: { duration: 0.1 } }}
          >
            <Card
              variant="compact"
              className="group/card transition-[border-color,box-shadow] duration-200 hover:border-primary/30"
            >
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-muted-foreground transition-colors duration-200 group-hover/card:text-foreground">
                    {metric.label}
                  </p>
                  <span
                    className={cn(
                      "grid size-7 shrink-0 place-items-center rounded-md",
                      metric.tone,
                    )}
                  >
                    <Icon aria-hidden="true" className="size-4" />
                  </span>
                </div>
                <p className="font-mono text-2xl font-semibold tabular-nums transition-colors duration-200 group-hover/card:text-primary">
                  {metric.value}
                </p>
                <p className="text-xs text-muted-foreground">{metric.sub}</p>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </motion.div>
  );
}

export function DistributionPanel({
  branches,
  brokers,
  canManageAcceptingLeads,
}: {
  branches: BranchItem[];
  brokers: BrokerItem[];
  canManageAcceptingLeads: boolean;
}) {
  return (
    <>
      {/* Branch Table */}
      <Card variant="overview">
        <CardHeader className="flex flex-col gap-3 border-b border-border px-5 pb-4 pt-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>Filiais</CardTitle>
            <CardDescription>
              Controle individual de recebimento e distribuição automática por unidade.
            </CardDescription>
          </div>
          <Button render={<Link href="/filiais" />} size="sm" variant="outline">
            <Buildings />
            Gerenciar filiais
          </Button>
          <Button render={<Link href="/leads/distribuicao/plantao" />} size="sm" variant="outline">
            Plantões
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {branches.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border px-4 py-10 text-center">
              <span className="grid size-9 place-items-center rounded-lg bg-muted/60 text-muted-foreground">
                <Buildings aria-hidden="true" className="size-5" />
              </span>
              <p className="text-sm font-medium">Nenhuma filial cadastrada</p>
              <p className="text-xs text-muted-foreground">
                Crie a primeira unidade para configurar a distribuição.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-5 min-w-[180px]">Filial</TableHead>
                    <TableHead className="min-w-[100px]">Status</TableHead>
                    <TableHead className="min-w-[120px]">Receber leads</TableHead>
                    <TableHead className="min-w-[140px]">Distrib. automática</TableHead>
                    <TableHead className="min-w-[100px]">Corretores</TableHead>
                    <TableHead className="min-w-[80px]">Disponíveis</TableHead>
                    <TableHead className="min-w-[80px]">Leads ativos</TableHead>
                    <TableHead className="pr-5 min-w-[80px]">Novos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {branches.map((branch, i) => (
                    <motion.tr
                      key={branch.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        duration: 0.15,
                        ease: [0, 0, 0.2, 1],
                        delay: Math.min(i * 0.03, 0.25),
                      }}
                    >
                      <TableCell className="pl-5">
                        <p className="font-medium">{branch.name}</p>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            branch.status === "active"
                              ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                              : "text-muted-foreground"
                          }
                        >
                          {branch.status === "active" ? "Ativa" : "Inativa"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {canManageAcceptingLeads ? (
                          <ToggleCell
                            branchId={branch.id}
                            label="recebimento de leads"
                            enabled={branch.acceptingLeads}
                            action={toggleAcceptingLeadsAction}
                          />
                        ) : (
                          <Badge variant="outline">
                            {branch.acceptingLeads ? "Ativa" : "Inativa"}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <ToggleCell
                          branchId={branch.id}
                          label="distribuição automática"
                          enabled={branch.autoDistribute}
                          action={toggleAutoDistributeAction}
                        />
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm tabular-nums">{branch.memberCount}</span>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`font-mono text-sm tabular-nums ${branch.availableBrokers > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}
                        >
                          {branch.availableBrokers}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm tabular-nums">{branch.activeLeads}</span>
                      </TableCell>
                      <TableCell className="pr-5">
                        <span
                          className={`font-mono text-sm tabular-nums ${branch.newLeads > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}
                        >
                          {branch.newLeads}
                        </span>
                      </TableCell>
                    </motion.tr>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <BrokerDirectory brokers={brokers} />

      {/* Summary / Legend */}
      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border/60 bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <CheckCircle className="size-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>
            Recebendo leads ativo — leads de webhooks/manuais são roteados para esta filial
          </span>
        </span>
        <span className="flex items-center gap-1.5">
          <CheckCircle className="size-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>
            Distrib. automática — leads são atribuídos automaticamente a corretores disponíveis
          </span>
        </span>
        <span className="flex items-center gap-1.5">
          <XCircle className="size-3.5 text-muted-foreground" />
          <span>Inativo — a filial não participa desta funcionalidade</span>
        </span>
      </div>
    </>
  );
}
