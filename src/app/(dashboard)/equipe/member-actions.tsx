"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { CheckCircle, DotsThreeVertical, LockKey, PencilSimple, Power, Trash, UserSwitch } from "@/components/huge-icons";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogDescription, DialogPopup, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { deleteTeamMemberAction, toggleTeamMemberStatusAction, updateTeamMemberAction, transferLeadsAction, resendInviteAction, revokeInviteAction, generateResetPasswordLinkAction, type TeamActionState } from "./actions";

import type { TenantRole } from "@/shared/db/schema";

type BranchOption = { id: string; name: string };
type TeamMember = {
  id: string;
  userId: string | null;
  name: string | null;
  email: string;
  role: TenantRole;
  jobTitle: string;
  status: "pending" | "active" | "disabled";
  branchId: string | null;
  branchName: string | null;
  customRoleScope?: "none" | "own" | "branch" | "tenant" | null;
};

type Props = {
  member: TeamMember;
  branches: BranchOption[];
  currentRole: TenantRole;
  currentBranchId: string | null;
  currentUserId: string;
  allMembers?: TeamMember[];
  onStatusChange?: (memberId: string, status: TeamMember["status"] | null) => void;
};

const roleLabel: Record<TeamMember["role"], string> = {
  director: "Diretor",
  manager: "Gestor",
  supervisor: "Supervisor",
  broker: "Corretor",
};

const statusLabel: Record<TeamMember["status"], string> = {
  active: "Ativo",
  pending: "Pendente",
  disabled: "Desativado",
};

const jobTitleLabel: Record<string, string> = {
  director: "Diretor",
  manager: "Gestor",
  broker: "Corretor",
  marketing: "Marketing",
  finance: "Financeiro",
  operations: "Operações",
  support: "Suporte",
};

const jobTitles = ["director", "manager", "supervisor", "broker", "marketing", "finance", "operations", "support"] as const;

function EditMemberDialog({
  member,
  open,
  onOpenChange,
  branches,
  currentRole,
  currentBranchId,
}: Props & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, action, pending] = useActionState<TeamActionState, FormData>(
    updateTeamMemberAction,
    {},
  );
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const allowedBranches =
    currentRole === "manager" && currentBranchId
      ? branches.filter((branch) => branch.id === currentBranchId)
      : branches;

  const [jobTitle, setJobTitle] = useState<string>(member.jobTitle);
  const [role, setRole] = useState<string>(member.role);
  const requiresBranch = jobTitle === "manager" || jobTitle === "broker" || member.customRoleScope === "branch";

  useEffect(() => {
    if (state.success) {
      toast.success("Membro atualizado com sucesso.");
      onOpenChange(false);
      formRef.current?.reset();
    }
    if (state.error) toast.error(state.error);
  }, [onOpenChange, state.error, state.success]);
  useEffect(() => {
    if (state.success) router.refresh();
  }, [router, state.success]);

  useEffect(() => {
    if (!open) {
      formRef.current?.reset();
      setJobTitle(member.jobTitle);
      setRole(member.role);
    }
  }, [open, member.jobTitle, member.role]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup key={open ? "open" : "closed"} className="sm:max-w-lg">
        <DialogTitle>Editar membro</DialogTitle>
        <DialogDescription>
          Atualize os dados, a filial e o papel operacional desse acesso.
        </DialogDescription>
        <form ref={formRef} action={action} className="grid gap-4">
          <input name="memberId" type="hidden" value={member.id} />
          <Field>
            <FieldLabel htmlFor={`member-name-${member.id}`}>Nome</FieldLabel>
            <Input
              id={`member-name-${member.id}`}
              name="name"
              defaultValue={member.name ?? ""}
              disabled={pending}
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`member-email-${member.id}`}>E-mail</FieldLabel>
            <Input
              id={`member-email-${member.id}`}
              name="email"
              defaultValue={member.email}
              disabled={pending}
              required
              type="email"
            />
          </Field>
          <Field>
            <FieldLabel>Cargo</FieldLabel>
            <Select value={jobTitle} onValueChange={(val) => {
              if (!val) return;
              setJobTitle(val);
              if (val === "director") setRole("director");
              else if (val === "manager") setRole("manager");
              else if (val === "supervisor") setRole("supervisor");
              else if (val === "broker") setRole("broker");
            }} disabled={pending} name="jobTitle">
              <SelectTrigger className="w-full"><SelectValue placeholder="Selecione o cargo">{(value: string | null) => jobTitleLabel[value ?? ""] ?? "Selecione o cargo"}</SelectValue></SelectTrigger>
              <SelectContent>
                {jobTitles
                  .filter((r) => currentRole === "director" || (r !== "manager" && r !== "director"))
                  .map((r) => <SelectItem key={r} value={r}>{jobTitleLabel[r]}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>Perfil de acesso</FieldLabel>
            <Select
              value={role}
              onValueChange={(val) => {
                if (!val) return;
                setRole(val);
                if (val === "director") setJobTitle("director");
                else if (val === "manager") setJobTitle("manager");
              }}
              disabled={pending || currentRole !== "director"}
              name="role"
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione o papel">{(value: string | null) => roleLabel[value as TeamMember["role"]] ?? value ?? "Selecione o papel"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {currentRole === "director" ? (
                  <>
                    <SelectItem value="director">Diretor (Acesso Global)</SelectItem>
                    <SelectItem value="manager">Gestor (Gestão da Unidade)</SelectItem>
                    <SelectItem value="supervisor">Supervisor (Operação da Unidade)</SelectItem>
                    <SelectItem value="broker">Corretor (Operação Individual)</SelectItem>
                  </>
                ) : (
                  <SelectItem value="broker">Corretor (Operação Individual)</SelectItem>
                )}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>{requiresBranch ? "Unidade" : "Unidade (opcional)"}</FieldLabel>
            <Select
              defaultValue={member.branchId ?? "__tenant__"}
              disabled={pending || allowedBranches.length === 1}
              name="branchId"
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={requiresBranch ? "Selecione a unidade" : "Geral da empresa"}>{(value: string | null) => value === "__tenant__" ? "Geral da empresa" : allowedBranches.find((branch) => branch.id === value)?.name ?? "Selecione a unidade"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {!requiresBranch ? <SelectItem value="__tenant__">Geral da empresa</SelectItem> : null}
                {allowedBranches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{requiresBranch ? "Este acesso precisa permanecer em uma única unidade." : "Sem unidade, este cargo atua em toda a empresa dentro das permissões liberadas."}</p>
          </Field>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button className="flex-1" disabled={pending} type="submit">
              {pending ? "Salvando..." : "Salvar alterações"}
            </Button>
            <DialogClose
              render={
                <Button
                  className="flex-1"
                  disabled={pending}
                  type="button"
                  variant="ghost"
                >
                  Cancelar
                </Button>
              }
            />
          </div>
        </form>
      </DialogPopup>
    </Dialog>
  );
}

function DeleteMemberDialog({
  member,
  open,
  onOpenChange,
}: {
  member: TeamMember;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, action, pending] = useActionState<TeamActionState, FormData>(
    deleteTeamMemberAction,
    {},
  );
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      toast.success("Membro removido com sucesso.");
      onOpenChange(false);
      formRef.current?.reset();
    }
    if (state.error) toast.error(state.error);
  }, [onOpenChange, state.error, state.success]);
  useEffect(() => {
    if (state.success) router.refresh();
  }, [router, state.success]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup key={open ? "open" : "closed"} className="sm:max-w-md">
        <DialogTitle>Excluir membro</DialogTitle>
        <DialogDescription>
          Essa ação remove o acesso desta empresa, a associação de equipe e as sessões ativas. O histórico operacional é preservado.
        </DialogDescription>
        <form ref={formRef} action={action} className="space-y-4">
          <input name="memberId" type="hidden" value={member.id} />
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-sm font-medium">{member.name ?? "Sem nome"}</p>
            <p className="text-sm text-muted-foreground">{member.email}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="outline">{roleLabel[member.role]}</Badge>
              <Badge
                variant={
                  member.status === "active"
                    ? "default"
                    : member.status === "pending"
                      ? "secondary"
                      : "outline"
                }
              >
                {statusLabel[member.status]}
              </Badge>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Confirme para remover esse membro definitivamente.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              className="flex-1"
              disabled={pending}
              type="submit"
              variant="destructive"
            >
              {pending ? "Excluindo..." : "Excluir membro"}
            </Button>
            <DialogClose
              render={
                <Button
                  className="flex-1"
                  disabled={pending}
                  type="button"
                  variant="ghost"
                >
                  Cancelar
                </Button>
              }
            />
          </div>
        </form>
      </DialogPopup>
    </Dialog>
  );
}

export function TeamMemberActions({
  member,
  branches,
  currentRole,
  currentBranchId,
  currentUserId,
  allMembers = [],
  onStatusChange,
}: Props) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const [toggleState, toggleAction, togglePending] = useActionState<
    TeamActionState,
    FormData
  >(toggleTeamMemberStatusAction, {});
  const [displayStatus, setDisplayStatus] = useState(member.status);
  const previousStatusRef = useRef(member.status);
  const [resendState, resendAction, resendPending] = useActionState<TeamActionState, FormData>(resendInviteAction, {});
  const router = useRouter();

  useEffect(() => {
    if (toggleState.success) {
      if (toggleState.status) onStatusChange?.(member.id, toggleState.status);
      toast.success(
        toggleState.status === "disabled"
          ? "Membro desativado."
          : "Membro reativado.",
      );
      router.refresh();
    }
    if (toggleState.error) {
      onStatusChange?.(member.id, null);
      setDisplayStatus(previousStatusRef.current);
      toast.error(toggleState.error);
    }
  }, [member.id, onStatusChange, router, toggleState.error, toggleState.status, toggleState.success]);

  useEffect(() => {
    // Keep the optimistic badge while the server refresh catches up. This
    // prevents the old prop value from flashing between action completion and
    // the revalidated team query.
    if (member.status === displayStatus) {
      previousStatusRef.current = member.status;
      return;
    }
    if (!toggleState.success && !togglePending) {
      // Reconcile the local optimistic badge with the server-rendered row.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDisplayStatus(member.status);
    }
  }, [displayStatus, member.status, togglePending, toggleState.success]);

  useEffect(() => {
    if (resendState.success) {
      const message = resendState.whatsappStatus === "sent"
        ? "A mensagem foi enviada pelo WhatsApp corporativo."
        : resendState.whatsappStatus === "failed"
          ? "O convite foi recriado, mas a Meta recusou o envio. Use o link gerado no perfil do membro."
          : resendState.whatsappStatus === "queued"
            ? "O convite foi colocado na fila de envio do WhatsApp."
            : "O convite foi recriado. Envie o link manualmente se necessário.";
      toast.success("Convite processado.", { description: message });
      router.refresh();
    }
    if (resendState.error) toast.error(resendState.error);
  }, [resendState, router]);

  const canEdit = currentUserId !== member.userId && member.role !== "director";
  const canDelete = canEdit;
  const canToggle = canEdit && member.userId !== null;
  const toggleLabel = displayStatus === "active" ? "Desativar" : "Ativar";
  const canManageInvite = canEdit && (member.role === "broker" || member.role === "manager");
  const canResetPassword = member.userId !== null && (currentRole === "director" || currentRole === "manager");

  return (
    <>
      <div className="flex items-center justify-end gap-2">
        {canEdit ? (
          <Button
            aria-label={`Editar ${member.name ?? member.email}`}
            onClick={() => setEditOpen(true)}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <PencilSimple size={15} />
          </Button>
        ) : null}
        {canToggle ? (
          <form action={toggleAction} onSubmit={() => {
            previousStatusRef.current = displayStatus;
            setDisplayStatus(displayStatus === "active" ? "disabled" : "active");
          }}>
            <input name="memberId" type="hidden" value={member.id} />
            <Button
              aria-label={`${toggleLabel} ${member.name ?? member.email}`}
              disabled={togglePending}
              size="icon-sm"
              type="submit"
              variant="ghost"
            >
              <Power size={15} />
            </Button>
          </form>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                aria-label={`Acoes de ${member.name ?? member.email}`}
                size="icon-sm"
                variant="ghost"
              >
                <DotsThreeVertical size={15} />
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-48">
            {member.status === "pending" && canManageInvite ? (
              <>
                <DropdownMenuItem onClick={() => {
                  const fd = new FormData();
                  fd.set("invitationId", member.id);
                  resendAction(fd);
                }} disabled={resendPending}>
                  <UserSwitch size={15} />
                  Reenviar convite
                </DropdownMenuItem>
                <DropdownMenuItem onClick={async () => {
                  const fd = new FormData();
                  fd.set("invitationId", member.id);
                  const result = await revokeInviteAction({ success: false }, fd);
                  if (result.success) {
                    toast.success("Convite revogado.");
                    router.refresh();
                  } else {
                    toast.error(result.error ?? "Erro ao revogar convite.");
                  }
                }} variant="destructive">
                  <Trash size={15} />
                  Revogar convite
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            ) : null}
            {canResetPassword ? (
              <DropdownMenuItem onClick={() => setResetPasswordOpen(true)}>
                <LockKey size={15} />
                Resetar senha
              </DropdownMenuItem>
            ) : null}
            {member.role === "broker" && member.userId ? (
              <DropdownMenuItem
                onClick={() => setTransferOpen(true)}
              >
                <UserSwitch size={15} />
                Transferir leads
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={!canDelete}
              onClick={() => setDeleteOpen(true)}
              variant="destructive"
            >
              <Trash size={15} />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <EditMemberDialog
        key={member.id}
        branches={branches}
        currentBranchId={currentBranchId}
        currentRole={currentRole}
        currentUserId={currentUserId}
        member={member}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
      <DeleteMemberDialog
        key={`${member.id}-delete`}
        member={member}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
      <TransferLeadsDialog
        key={`${member.id}-transfer`}
        member={member}
        allMembers={allMembers}
        currentUserId={currentUserId}
        open={transferOpen}
        onOpenChange={setTransferOpen}
      />
      <ResetPasswordDialog
        key={`${member.id}-reset-password`}
        member={member}
        open={resetPasswordOpen}
        onOpenChange={setResetPasswordOpen}
      />
    </>
  );
}

function ResetPasswordDialog({
  member,
  open,
  onOpenChange,
}: {
  member: TeamMember;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, action, pending] = useActionState<
    TeamActionState & { resetUrl?: string },
    FormData
  >(generateResetPasswordLinkAction, {});
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (state.error) {
      toast.error(state.error);
    }
  }, [state.error]);

  const memberName = member.name ?? member.email;
  const resetUrl = state.resetUrl ?? "";

  const templateMessage = resetUrl
    ? `Olá, ${memberName}! Seu link para redefinir sua senha no sistema Âncora CRM foi gerado. Acesse o link abaixo para criar sua nova senha:\n\n${resetUrl}\n\nEste link é seguro e é válido por 24 horas.`
    : "";

  const handleCopy = async () => {
    if (!templateMessage) return;
    try {
      await navigator.clipboard.writeText(templateMessage);
      setCopied(true);
      toast.success("Mensagem e link copiados com sucesso!");
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error("Erro ao copiar para a área de transferência.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      setCopied(false);
      onOpenChange(val);
    }}>
      <DialogPopup key={open ? "open" : "closed"} className="sm:max-w-md">
        <DialogTitle className="flex items-center gap-2">
          <LockKey size={18} /> Redefinir Senha do Membro
        </DialogTitle>
        <DialogDescription>
          Gere um link seguro de redefinição de senha para <strong>{memberName}</strong>.
        </DialogDescription>

        {!state.resetUrl ? (
          <form action={action} className="grid gap-4 mt-2">
            <input name="userId" type="hidden" value={member.userId ?? ""} />
            <p className="text-xs text-muted-foreground">
              Ao gerar o link, todas as sessões ativas deste membro serão encerradas por segurança.
            </p>
            <div className="flex gap-2 mt-2">
              <Button className="flex-1" disabled={pending || !member.userId} type="submit">
                {pending ? "Gerando Link..." : "Gerar Link de Redefinição"}
              </Button>
              <DialogClose
                render={
                  <Button disabled={pending} type="button" variant="ghost">
                    Cancelar
                  </Button>
                }
              />
            </div>
          </form>
        ) : (
          <div className="grid gap-4 mt-2">
            <Field>
              <FieldLabel>Mensagem Pronta com o Link</FieldLabel>
              <textarea
                readOnly
                className="w-full h-36 p-3 text-xs font-mono rounded-md border border-input bg-muted/50 resize-none focus:outline-none"
                value={templateMessage}
              />
            </Field>

            <div className="flex gap-2">
              <Button className="flex-1 gap-2" onClick={handleCopy} type="button">
                {copied ? <CheckCircle size={16} className="text-emerald-400" /> : <LockKey size={16} />}
                {copied ? "Mensagem e Link Copiados!" : "Copiar Mensagem e Link"}
              </Button>
              <DialogClose
                render={
                  <Button type="button" variant="ghost">
                    Fechar
                  </Button>
                }
              />
            </div>
          </div>
        )}
      </DialogPopup>
    </Dialog>
  );
}

function TransferLeadsDialog({
  member,
  open,
  onOpenChange,
  allMembers,
  currentUserId,
}: {
  member: TeamMember;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allMembers: TeamMember[];
  currentUserId: string;
}) {
  const [state, action, pending] = useActionState<TeamActionState, FormData>(
    transferLeadsAction,
    {},
  );
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  const brokers = allMembers.filter(
    (item) => item.role === "broker" && item.status === "active" && item.userId && item.userId !== member.userId
  ) as (TeamMember & { userId: string })[];

  useEffect(() => {
    if (state.success) {
      toast.success("Leads transferidos com sucesso.");
      onOpenChange(false);
      formRef.current?.reset();
    }
    if (state.error) toast.error(state.error);
  }, [onOpenChange, state.error, state.success]);
  useEffect(() => {
    if (state.success) router.refresh();
  }, [router, state.success]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup key={open ? "open" : "closed"} className="sm:max-w-md">
        <DialogTitle>Transferir Leads em Lote</DialogTitle>
        <DialogDescription>
          Mova todos os leads sob responsabilidade de <strong>{member.name ?? member.email}</strong> para outro corretor ativo.
        </DialogDescription>
        <form ref={formRef} action={action} className="grid gap-4 mt-2">
          <input name="fromUserId" type="hidden" value={member.userId ?? ""} />
          
          <Field>
            <FieldLabel>Corretor de Destino</FieldLabel>
            <Select name="toUserId">
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione um corretor ativo" />
              </SelectTrigger>
              <SelectContent>
                {brokers.map((broker) => (
                  <SelectItem key={broker.userId} value={broker.userId}>
                    {broker.name ?? broker.email} ({broker.branchName ?? "Sem filial"})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="flex gap-2 mt-2">
            <Button className="flex-1" disabled={pending || brokers.length === 0} type="submit">
              {pending ? "Transferindo..." : "Confirmar Transferência"}
            </Button>
            <DialogClose
              render={
                <Button disabled={pending} type="button" variant="ghost">
                  Cancelar
                </Button>
              }
            />
          </div>
          {brokers.length === 0 && (
            <p className="text-[10px] text-destructive text-center mt-1">
              Nenhum outro corretor ativo disponível para receber os leads.
            </p>
          )}
        </form>
      </DialogPopup>
    </Dialog>
  );
}
