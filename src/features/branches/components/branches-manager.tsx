"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import Link from "next/link";
import { ArrowSquareOut, PencilSimple, Plus, Power, WifiHigh, XCircle } from "@/components/huge-icons";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Table, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createBranchAction, toggleBranchAction, toggleAcceptingLeadsAction, updateBranchAction, type BranchActionState } from "@/features/branches/actions";

type Branch = { id: string; name: string; externalId: string | null; status: "active" | "inactive"; memberCount: number; acceptingLeads: boolean };

function ActionFeedback({ state }: { state: BranchActionState }) {
  useEffect(() => {
    if (state.success) toast.success("Filial atualizada com sucesso.");
    if (state.error) toast.error(state.error);
  }, [state.success, state.error]);
  return null;
}

function CreateBranchForm({ onSuccess }: { onSuccess: () => void }) {
  const [state, action, pending] = useActionState<BranchActionState, FormData>(createBranchAction, {});
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      onSuccess();
    }
  }, [state.success, onSuccess]);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <div className="space-y-2"><Label htmlFor="branch-name">Nome da filial</Label><Input id="branch-name" name="name" placeholder="Ex.: Unidade Centro" required /></div>
      <div className="space-y-2"><Label htmlFor="branch-external-id">Identificador externo <span className="text-muted-foreground">(opcional)</span></Label><Input id="branch-external-id" name="externalId" placeholder="Ex.: centro-01" /></div>
      <Button className="w-full" type="submit" disabled={pending}>{pending ? "Criando..." : "Criar filial"}</Button>
      <ActionFeedback state={state} />
    </form>
  );
}

function CreateBranchSheet() {
  const [open, setOpen] = useState(false);
  return <Sheet open={open} onOpenChange={setOpen}><SheetTrigger render={<Button><Plus weight="bold" /> Nova filial</Button>} /><SheetContent><SheetHeader><SheetTitle>Nova filial</SheetTitle><SheetDescription>Crie uma unidade para organizar equipe e leads.</SheetDescription></SheetHeader><SheetBody><CreateBranchForm onSuccess={() => setOpen(false)} /></SheetBody></SheetContent></Sheet>;
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
  const updateFormId = `branch-update-${branch.id}`;
  const cells = (
    <>
      <TableCell className="min-w-56 pl-5"><form id={updateFormId} action={updateAction} className="flex items-center gap-2"><input type="hidden" name="branchId" value={branch.id} /><Input aria-label={`Nome da filial ${branch.name}`} name="name" defaultValue={branch.name} required /><Button aria-label={`Salvar ${branch.name}`} type="submit" variant="ghost" size="icon-sm" disabled={updatePending}><PencilSimple size={15} /></Button></form><ActionFeedback state={updateState} /></TableCell>
      <TableCell className="min-w-40"><Input form={updateFormId} aria-label={`Identificador de ${branch.name}`} name="externalId" defaultValue={branch.externalId ?? ""} placeholder="Sem ID" /></TableCell>
      <TableCell><span className="text-sm">{branch.memberCount}</span><span className="ml-1 text-xs text-muted-foreground">membro(s)</span></TableCell>
      <TableCell><Badge variant="outline" className={branch.status === "active" ? "border-emerald-500/40 text-emerald-500" : "text-muted-foreground"}>{branch.status === "active" ? "Ativa" : "Inativa"}</Badge></TableCell>
      <TableCell><AcceptingLeadsToggle branch={branch} /></TableCell>
      <TableCell className="pr-5 text-right">
        <div className="flex items-center justify-end gap-1">
          <Button render={<Link href={`/unidades/${branch.id}`} />} size="sm" variant="ghost" className="gap-1.5">
            <ArrowSquareOut size={14} aria-hidden="true" />
            Ver perfil
          </Button>
          <form action={toggleAction}><input type="hidden" name="branchId" value={branch.id} /><Button type="submit" size="sm" variant="ghost" disabled={togglePending}><Power size={15} />{branch.status === "active" ? "Desativar" : "Ativar"}</Button></form>
          <ActionFeedback state={toggleState} />
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

export function BranchesManager({ branches }: { branches: Branch[] }) {
  const activeCount = branches.filter((branch) => branch.status === "active").length;
  const acceptingCount = branches.filter((branch) => branch.acceptingLeads).length;
  const memberCount = branches.reduce((total, branch) => total + branch.memberCount, 0);
  return (
    <>
      <motion.div
        className="grid gap-3 sm:grid-cols-4"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
        }}
      >
        {[
          { label: "Total de filiais", value: branches.length } as const,
          { label: "Filiais ativas", value: activeCount } as const,
          { label: "Recebendo leads", value: acceptingCount } as const,
          { label: "Equipe vinculada", value: memberCount } as const,
        ].map((item) => (
          <motion.div
            key={item.label}
            variants={{
              hidden: { opacity: 0, y: 8 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.18, ease: [0, 0, 0.2, 1] } },
            }}
            whileHover={{ y: -2, transition: { duration: 0.2, ease: [0, 0, 0.2, 1] } }}
            whileTap={{ scale: 0.995, transition: { duration: 0.1 } }}
          >
            <Card size="sm" className="group/card border-border bg-card shadow-none transition-all duration-200 hover:border-primary/25 hover:shadow-sm hover:shadow-primary/5">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground transition-colors duration-200 group-hover/card:text-foreground">{item.label}</p>
                <p className="mt-2 font-mono text-2xl font-semibold transition-colors duration-200 group-hover/card:text-primary">{item.value}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>
      <Card className="border-border bg-card shadow-none">
        <CardHeader className="flex flex-col gap-3 border-b border-border sm:flex-row sm:items-end sm:justify-between"><div><CardTitle>Filiais da corretora</CardTitle><CardDescription>Edite dados, acompanhe a equipe vinculada e controle quais filiais recebem leads.</CardDescription></div><CreateBranchSheet /></CardHeader>
        <CardContent className="p-0">
          {branches.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, ease: [0, 0, 0.2, 1] }}
              className="flex flex-col items-center gap-2 p-12 text-center"
            >
              <p className="text-sm font-medium">Nenhuma filial por enquanto</p>
              <p className="text-xs text-muted-foreground">Crie a primeira unidade para começar a organizar sua operação.</p>
            </motion.div>
          ) : (
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
          )}
        </CardContent>
      </Card>
    </>
  );
}
