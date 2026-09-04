"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import Link from "next/link";
import { ArrowSquareOut, PencilSimple, Plus, Power, WifiHigh, XCircle } from "@/components/huge-icons";
import { toast } from "@/components/ui/sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/dashboard/metric-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Table, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Section, StatusBadge, EmptyState } from "@/components/foundations";
import { createBranchAction, toggleBranchAction, toggleAcceptingLeadsAction, toggleDistributionHubAction, updateBranchAction, type BranchActionState } from "@/features/branches/actions";

type Branch = { id: string; name: string; externalId: string | null; status: "active" | "inactive"; memberCount: number; acceptingLeads: boolean; isDistributionHub: boolean };

function ActionFeedback({ state }: { state?: BranchActionState }) {
  const router = useRouter();

  useEffect(() => {
    if (!state?.message) return;
    if (state.error) {
      toast.error(state.message);
    } else {
      toast.success(state.message);
      router.refresh();
    }
  }, [state, router]);

  return null;
}

function CreateBranchForm({ onSuccess }: { onSuccess?: () => void }) {
  const [state, action, pending] = useActionState<BranchActionState, FormData>(createBranchAction, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.message && !state.error) {
      formRef.current?.reset();
      onSuccess?.();
    }
  }, [state, onSuccess]);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="branch-name">Nome da filial</Label>
        <Input id="branch-name" name="name" placeholder="Ex: Filial Centro" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="branch-external-id">Identificador externo</Label>
        <Input id="branch-external-id" name="externalId" placeholder="Ex: FIL-01" />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Criando filial..." : "Salvar filial"}
      </Button>
      <ActionFeedback state={state} />
    </form>
  );
}

function CreateBranchSheet() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button size="sm" className="gap-2" />}>
        <Plus size={16} />
        Nova filial
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Cadastrar filial</SheetTitle>
          <SheetDescription>Adicione uma nova unidade da corretora para organizar sua equipe.</SheetDescription>
        </SheetHeader>
        <SheetBody className="pt-4">
          <CreateBranchForm onSuccess={() => setOpen(false)} />
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}

function AcceptingLeadsToggle({ branch }: { branch: Branch }) {
  const [state, action, pending] = useActionState<BranchActionState, FormData>(toggleAcceptingLeadsAction, {});
  const accepting = branch.acceptingLeads;

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="branchId" value={branch.id} />
      <button
        type="submit"
        disabled={pending}
        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all duration-200 ${
          accepting
            ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400"
            : "bg-muted text-muted-foreground hover:bg-muted/80"
        } disabled:opacity-50`}
        title={accepting ? "Clique para pausar recebimento de leads" : "Clique para ativar recebimento de leads"}
      >
        {accepting ? <WifiHigh className="size-3.5" /> : <XCircle className="size-3.5" />}
        {accepting ? "Recebendo" : "Pausado"}
      </button>
      <ActionFeedback state={state} />
    </form>
  );
}

function BranchRow({ branch, index }: { branch: Branch; index?: number }) {
  const [updateState, updateAction, updatePending] = useActionState<BranchActionState, FormData>(updateBranchAction, {});
  const [toggleState, toggleAction, togglePending] = useActionState<BranchActionState, FormData>(toggleBranchAction, {});
  const [hubState, hubAction, hubPending] = useActionState<BranchActionState, FormData>(toggleDistributionHubAction, {});
  const updateFormId = `branch-update-${branch.id}`;
  const cells = (
    <>
      <TableCell className="min-w-56 pl-5"><form id={updateFormId} action={updateAction} className="flex items-center gap-2"><input type="hidden" name="branchId" value={branch.id} /><Input aria-label={`Nome da filial ${branch.name}`} name="name" defaultValue={branch.name} required /><Button aria-label={`Salvar ${branch.name}`} type="submit" variant="ghost" size="icon-sm" disabled={updatePending}><PencilSimple size={15} /></Button></form><ActionFeedback state={updateState} /></TableCell>
      <TableCell className="min-w-40"><Input form={updateFormId} aria-label={`Identificador de ${branch.name}`} name="externalId" defaultValue={branch.externalId ?? ""} placeholder="Sem ID" /></TableCell>
      <TableCell><span className="text-sm">{branch.memberCount}</span><span className="ml-1 text-xs text-muted-foreground">membro(s)</span></TableCell>
      <TableCell>
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge
            label={branch.status === "active" ? "Ativa" : "Inativa"}
            tone={branch.status === "active" ? "success" : "neutral"}
            dot
          />
          {branch.isDistributionHub ? <Badge variant="secondary">Central</Badge> : null}
        </div>
      </TableCell>
      <TableCell><AcceptingLeadsToggle branch={branch} /></TableCell>
      <TableCell className="pr-5 text-right">
        <div className="flex items-center justify-end gap-1">
          <Button render={<Link href={`/unidades/${branch.id}`} />} size="sm" variant="ghost" className="gap-1.5 text-xs">
            <ArrowSquareOut size={14} aria-hidden="true" />
            Ver perfil
          </Button>
          <form action={toggleAction}><input type="hidden" name="branchId" value={branch.id} /><Button type="submit" size="sm" variant="ghost" className="text-xs" disabled={togglePending}><Power size={14} />{branch.status === "active" ? "Desativar" : "Ativar"}</Button></form>
          <form action={hubAction}><input type="hidden" name="branchId" value={branch.id} /><Button type="submit" size="sm" variant="ghost" className="text-xs" disabled={hubPending}>{branch.isDistributionHub ? "Remover central" : "Definir central"}</Button></form>
          <ActionFeedback state={toggleState} />
          <ActionFeedback state={hubState} />
        </div>
      </TableCell>
    </>
  );

  if (index !== undefined) {
    return (
      <motion.tr
        custom={index}
        variants={{
          hidden: { opacity: 0, x: -8 },
          visible: (i: number) => ({
            opacity: 1,
            x: 0,
            transition: { duration: 0.15, ease: [0, 0, 0.2, 1], delay: Math.min(i * 0.03, 0.25) },
          }),
        }}
      >
        {cells}
      </motion.tr>
    );
  }

  return <TableRow>{cells}</TableRow>;
}

export function BranchesManager({
  branches,
  branchesTrend,
  membersTrend,
}: {
  branches: Branch[];
  branchesTrend?: number[];
  membersTrend?: number[];
}) {
  const activeCount = branches.filter((branch) => branch.status === "active").length;
  const acceptingCount = branches.filter((branch) => branch.acceptingLeads).length;
  const memberCount = branches.reduce((total, branch) => total + branch.memberCount, 0);
  const trend = branchesTrend ?? branches.map((_, index) => index + 1);
  const memberSeries = membersTrend ?? branchesTrend ?? [];
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard
          label="Total de filiais"
          value={branches.length}
          sublabel="últimos 6 meses"
          sparklineData={trend}
          sparklineColor="var(--chart-1)"
          animated
        />
        <StatCard
          label="Filiais ativas"
          value={activeCount}
          sublabel="operacionais"
          sparklineData={trend.map((value) => Math.round((value / Math.max(1, branches.length)) * activeCount))}
          sparklineColor="var(--chart-3)"
          animated
          animationDelay={0.06}
        />
        <StatCard
          label="Recebendo leads"
          value={acceptingCount}
          sublabel="com recebimento ativo"
          sparklineData={trend.map((value) => Math.round((value / Math.max(1, branches.length)) * acceptingCount))}
          sparklineColor="var(--chart-4)"
          animated
          animationDelay={0.12}
        />
        <StatCard
          label="Equipe vinculada"
          value={memberCount}
          sublabel="membros nas unidades"
          sparklineData={memberSeries}
          sparklineColor="var(--chart-2)"
          animated
          animationDelay={0.18}
        />
      </div>

      <Section
        title="Filiais da corretora"
        description="Edite dados, acompanhe a equipe vinculada e controle quais filiais recebem leads."
        actions={<CreateBranchSheet />}
        variant="card"
        className="p-0 overflow-hidden"
      >
        {branches.length === 0 ? (
          <EmptyState
            type="EMPTY_DATA"
            title="Nenhuma filial cadastrada"
            description="Crie a primeira unidade para começar a organizar sua equipe e recebimento de leads."
            className="border-none bg-transparent"
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Filial</TableHead>
                  <TableHead>Identificador</TableHead>
                  <TableHead>Equipe</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Receber leads</TableHead>
                  <TableHead className="pr-5 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <motion.tbody
                initial="hidden"
                animate="visible"
              >
                {branches.map((branch, i) => (
                  <BranchRow key={branch.id} branch={branch} index={i} />
                ))}
              </motion.tbody>
            </Table>
          </div>
        )}
      </Section>
    </>
  );
}
