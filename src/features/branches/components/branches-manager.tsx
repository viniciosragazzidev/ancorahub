"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowSquareOut, Buildings, PencilSimple, Plus, Power } from "@/components/huge-icons";
import { toast } from "@/components/ui/sonner";

import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/dashboard/metric-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { DataTable, DataTableColumnHeader } from "@/components/ui/data-table";
import { StatusBadge, EmptyState } from "@/components/foundations";
import { Card } from "@/components/ui/card";
import { SectionCardHeader } from "@/components/ui/section-card-header";
import { createBranchAction, toggleBranchAction, updateBranchAction, type BranchActionState } from "@/features/branches/actions";
import {
  BranchAcceptingToggle,
  BranchAutoDistributeToggle,
  BranchDistributionLegend,
  BranchHubToggle,
} from "@/features/branches/components/branch-distribution-controls";

type Branch = {
  id: string;
  name: string;
  externalId: string | null;
  status: "active" | "inactive";
  memberCount: number;
  acceptingLeads: boolean;
  autoDistribute: boolean;
  isDistributionHub: boolean;
  /** Corretores disponíveis, leads em andamento e leads novos (métricas de distribuição). */
  availableBrokers: number;
  activeLeads: number;
  newLeads: number;
};

function ActionFeedback({ state }: { state?: BranchActionState }) {
  const router = useRouter();

  useEffect(() => {
    const feedback = state?.error ?? state?.message;
    if (!feedback) return;
    if (state?.error) {
      toast.error(feedback);
    } else {
      toast.success(feedback);
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

function EditBranchSheet({ branch }: { branch: Branch }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<BranchActionState, FormData>(updateBranchAction, {});
  const router = useRouter();
  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.message && !state.error) {
      toast.success(state.message);
      router.refresh();
    }
  }, [state, router]);
  return <Sheet open={open} onOpenChange={setOpen}>
    <SheetTrigger render={<Button aria-label={`Editar ${branch.name}`} title={`Editar ${branch.name}`} size="icon-sm" variant="ghost" />}><PencilSimple size={15} /></SheetTrigger>
    <SheetContent>
      <SheetHeader><SheetTitle>Editar unidade</SheetTitle><SheetDescription>Atualize o nome e o identificador desta unidade.</SheetDescription></SheetHeader>
      <SheetBody className="pt-4">
        <form key={`${branch.name}-${branch.externalId ?? ""}`} action={action} className="space-y-4">
          <input type="hidden" name="branchId" value={branch.id} />
          <div className="space-y-2"><Label htmlFor={`branch-name-${branch.id}`}>Nome</Label><Input id={`branch-name-${branch.id}`} name="name" defaultValue={branch.name} required /></div>
          <div className="space-y-2"><Label htmlFor={`branch-external-${branch.id}`}>Identificador</Label><Input id={`branch-external-${branch.id}`} name="externalId" defaultValue={branch.externalId ?? ""} placeholder="Opcional" /></div>
          <Button type="submit" className="w-full" disabled={pending}>{pending ? "Salvando..." : "Salvar alterações"}</Button>
        </form>
      </SheetBody>
    </SheetContent>
  </Sheet>;
}

function BranchStatusAction({ branch }: { branch: Branch }) {
  const [state, action, pending] = useActionState<BranchActionState, FormData>(toggleBranchAction, {});
  return <form action={action} className="inline-flex items-center gap-2">
    <input type="hidden" name="branchId" value={branch.id} />
    <Button
      type="submit"
      size="icon-sm"
      variant="ghost"
      disabled={pending}
      aria-label={`${branch.status === "active" ? "Desativar" : "Ativar"} ${branch.name}`}
      title={`${branch.status === "active" ? "Desativar" : "Ativar"} ${branch.name}`}
    >
      <Power size={15} />
    </Button>
    <ActionFeedback state={state} />
  </form>;
}

export function BranchesManager({
  branches,
  canManage = true,
}: {
  branches: Branch[];
  canManage?: boolean;
}) {
  const activeCount = branches.filter((branch) => branch.status === "active").length;
  const acceptingCount = branches.filter((branch) => branch.acceptingLeads).length;
  const memberCount = branches.reduce((total, branch) => total + branch.memberCount, 0);
  const columns = useMemo<ColumnDef<Branch>[]>(() => [
    { accessorKey: "name", header: ({ column }) => <DataTableColumnHeader column={column} title="Unidade" />, cell: ({ row }) => <span className="font-medium text-foreground">{row.original.name}</span> },
    { accessorKey: "externalId", header: ({ column }) => <DataTableColumnHeader column={column} title="Identificador" />, cell: ({ row }) => <span className="font-mono text-muted-foreground">{row.original.externalId || "—"}</span> },
    { accessorKey: "memberCount", header: ({ column }) => <DataTableColumnHeader column={column} title="Equipe" />, cell: ({ row }) => <span className="tabular-nums">{row.original.memberCount}</span> },
    { accessorKey: "status", header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />, cell: ({ row }) => <StatusBadge label={row.original.status === "active" ? "Ativa" : "Inativa"} tone={row.original.status === "active" ? "success" : "neutral"} dot /> },
    { id: "accepting", header: "Recebe leads", cell: ({ row }) => canManage
      ? <BranchAcceptingToggle branchId={row.original.id} enabled={row.original.acceptingLeads} />
      : <span className="text-muted-foreground">{row.original.acceptingLeads ? "Sim" : "Pausado"}</span> },
    { id: "autoDistribute", header: "Distribuição automática", cell: ({ row }) => canManage
      ? <BranchAutoDistributeToggle branchId={row.original.id} enabled={row.original.autoDistribute} />
      : <span className="text-muted-foreground">{row.original.autoDistribute ? "Sim" : "Não"}</span> },
    { id: "hub", header: "Central", cell: ({ row }) => canManage
      ? <BranchHubToggle branchId={row.original.id} enabled={row.original.isDistributionHub} />
      : <span className="text-muted-foreground">{row.original.isDistributionHub ? "Sim" : "—"}</span> },
    { accessorKey: "activeLeads", header: ({ column }) => <DataTableColumnHeader column={column} title="Em atendimento" />, cell: ({ row }) => <span className="tabular-nums">{row.original.activeLeads}</span> },
    { id: "actions", header: () => <span className="sr-only">Ações</span>, enableHiding: false, cell: ({ row }) => <div className="flex items-center justify-end gap-2">
      {canManage ? <><EditBranchSheet branch={row.original} /><BranchStatusAction branch={row.original} /></> : null}
      <Button render={<Link href={`/unidades/${row.original.id}`} />} size="icon-sm" variant="ghost" aria-label={`Abrir ${row.original.name}`} title={`Abrir ${row.original.name}`}>
        <ArrowSquareOut size={15} />
      </Button>
    </div> },
  ], [canManage]);
  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <StatCard
          label="Total de filiais"
          value={branches.length}
          sublabel="no total"
          animated
        />
        <StatCard
          label="Filiais ativas"
          value={activeCount}
          sublabel="operacionais"
          animated
          animationDelay={0.06}
        />
        <StatCard
          label="Recebendo leads"
          value={acceptingCount}
          sublabel="com recebimento ativo"
          animated
          animationDelay={0.12}
        />
        <StatCard
          label="Equipe vinculada"
          value={memberCount}
          sublabel="membros nas unidades"
          animated
          animationDelay={0.18}
        />
      </div>

      <Card variant="overview">
        <SectionCardHeader
          icon={<Buildings />}
          title="Unidades"
          description="Consulte a equipe e a operação de cada unidade. Use a busca para localizar uma filial pelo nome ou identificador."
          actions={
            <>
              <Button render={<Link href="/distribuicao?view=plantao" />} size="sm" variant="outline">
                Plantões
              </Button>
              {canManage && branches.length === 0 ? <CreateBranchSheet /> : null}
            </>
          }
        />
        <div className="p-4">
        {branches.length === 0 ? (
          <EmptyState
            type="EMPTY_DATA"
            title="Nenhuma filial cadastrada"
            description="Crie a primeira unidade para começar a organizar sua equipe e recebimento de leads."
            className="border-none bg-transparent"
          />
        ) : (
          <DataTable columns={columns} data={branches} searchPlaceholder="Buscar unidade..." showColumnToggle={false} pageSize={10}
            headerSlot={canManage ? <CreateBranchSheet /> : null}
            emptyState={<EmptyState type="EMPTY_DATA" title="Nenhuma unidade encontrada" description="Ajuste a busca ou cadastre uma nova unidade." />} />
        )}
        </div>
        {branches.length > 0 ? <BranchDistributionLegend /> : null}
      </Card>
    </>
  );
}
