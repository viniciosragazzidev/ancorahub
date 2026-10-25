"use client";

/**
 * Ações de membro no visual Lite (/equipe): editar, transferir leads e redefinir senha em painel lateral; excluir na
 * confirmação Lite. Mesmas Server Actions, regras e textos dos diálogos de member-actions.tsx.
 */
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, KeyRound } from "lucide-react";

import { LiteConfirmDialog, LiteSelect } from "@/components/lite/controls";
import { LiteSidePanel } from "@/components/lite/data/side-panel";
import form from "@/components/lite/page/lite-form.module.css";
import page from "@/components/lite/page/lite-page.module.css";
import { toast } from "@/components/ui/sonner";
import type { TenantRole } from "@/shared/db/schema";

import { deleteTeamMemberAction, generateResetPasswordLinkAction, transferLeadsAction, updateTeamMemberAction } from "../actions";
import styles from "./team-lite.module.css";

export type TeamMemberLite = {
  id: string;
  userId: string | null;
  name: string | null;
  email: string;
  phone?: string | null;
  role: TenantRole;
  jobTitle: string;
  status: "pending" | "active" | "disabled";
  branchId: string | null;
  branchName: string | null;
  customRoleScope?: "none" | "own" | "branch" | "tenant" | null;
  customRoleId?: string | null;
  customRoleName?: string | null;
  supervisorId?: string | null;
  canEditAuthority: boolean;
  canManage: boolean;
};

export type BranchOption = { id: string; name: string };
export type CustomRoleOption = { id: string; name: string; scope: "none" | "own" | "branch" | "tenant" };

export const ROLE_LABELS: Record<TenantRole, string> = { director: "Diretor", manager: "Gestor", supervisor: "Supervisor", broker: "Corretor" };
export const STATUS_LABELS: Record<TeamMemberLite["status"], string> = { active: "Ativo", pending: "Pendente", disabled: "Desativado" };
export const JOB_TITLE_LABELS: Record<string, string> = {
  director: "Diretor",
  manager: "Gestor",
  supervisor: "Supervisor",
  broker: "Corretor",
  marketing: "Marketing",
  finance: "Financeiro",
  operations: "Operações",
  support: "Suporte",
};
const JOB_TITLES = ["director", "manager", "supervisor", "broker", "marketing", "finance", "operations", "support"] as const;
const ROLE_OPTION_LABELS: Record<TenantRole, string> = {
  director: "Diretor (acesso global)",
  manager: "Gestor (gestão da unidade)",
  supervisor: "Supervisor (operação da unidade)",
  broker: "Corretor (operação individual)",
};

function useRefreshOnSuccess() {
  const router = useRouter();
  return () => router.refresh();
}

/** Editar membro: os mesmos campos e regras do EditMemberDialog. */
export function EditMemberLite({ member, open, onOpenChange, branches, currentRole, currentBranchId, customRoles, allMembers }: {
  member: TeamMemberLite;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branches: BranchOption[];
  currentRole: TenantRole;
  currentBranchId: string | null;
  customRoles: CustomRoleOption[];
  allMembers: TeamMemberLite[];
}) {
  const refresh = useRefreshOnSuccess();
  const [pending, startTransition] = useTransition();
  const allowedBranches = currentRole === "manager" && currentBranchId ? branches.filter((branch) => branch.id === currentBranchId) : branches;
  const [jobTitle, setJobTitle] = useState(member.jobTitle);
  const [role, setRole] = useState<string>(member.role);
  const [customRoleId, setCustomRoleId] = useState(member.customRoleId ?? "");
  const [branchId, setBranchId] = useState(member.branchId ?? "__tenant__");
  const initialTeam = member.userId ? allMembers.filter((item) => item.supervisorId === member.userId && item.userId).map((item) => item.userId!) : [];
  const [team, setTeam] = useState<string[]>(initialTeam);
  const [teamSearch, setTeamSearch] = useState("");
  const teamCandidates = allMembers.filter((item) => item.role === "broker" && item.status === "active" && item.userId && item.userId !== member.userId && (branchId === "__tenant__" || item.branchId === branchId));
  const selectedCustomRole = customRoles.find((item) => item.id === customRoleId);
  const requiresBranch = jobTitle === "manager" || jobTitle === "broker" || selectedCustomRole?.scope === "branch";
  const roleLocked = currentRole !== "director" || jobTitle === "broker";

  // Fechar descarta o que não foi salvo, como o diálogo atual.
  useEffect(() => {
    if (!open) {
      setJobTitle(member.jobTitle);
      setRole(member.role);
      setCustomRoleId(member.customRoleId ?? "");
      setBranchId(member.branchId ?? "__tenant__");
      setTeamSearch("");
    }
  }, [open, member.customRoleId, member.jobTitle, member.role, member.branchId]);

  const chooseJobTitle = (value: string) => {
    setJobTitle(value);
    if (value === "director" || value === "manager" || value === "supervisor" || value === "broker") setRole(value);
  };
  const chooseRole = (value: string) => {
    setRole(value);
    if (value === "director") setJobTitle("director");
    else if (value === "manager") setJobTitle("manager");
  };
  const chooseBranch = (value: string) => {
    setBranchId(value);
    setTeam((current) => current.filter((id) => allMembers.some((item) => item.userId === id && (value === "__tenant__" || item.branchId === value))));
  };

  const submit = (data: FormData) => {
    startTransition(async () => {
      const result = await updateTeamMemberAction({}, data);
      if (result.success) {
        toast.success("Membro atualizado com sucesso.");
        onOpenChange(false);
        refresh();
      }
      if (result.error) toast.error(result.error);
    });
  };

  const branchOptions = [
    ...(!requiresBranch ? [{ value: "__tenant__", label: "Geral da empresa" }] : []),
    ...allowedBranches.map((branch) => ({ value: branch.id, label: branch.name })),
  ];
  const needle = teamSearch.trim().toLocaleLowerCase("pt-BR");

  return (
    <LiteSidePanel open={open} onOpenChange={onOpenChange} title="Editar membro" description="Atualize os dados, a unidade e o papel operacional desse acesso.">
      <form action={submit} className={form.form}>
        <input type="hidden" name="memberId" value={member.id} />
        <label className={form.field}>
          <span className={form.label}>Nome</span>
          <input className={form.input} name="name" defaultValue={member.name ?? ""} required disabled={pending} />
        </label>
        <label className={form.field}>
          <span className={form.label}>E-mail</span>
          <input className={form.input} name="email" type="email" defaultValue={member.email || ""} required={member.userId !== null} disabled={pending} />
        </label>
        {currentRole === "director" ? (
          <label className={form.field}>
            <span className={form.label}>WhatsApp</span>
            <input className={form.input} name="phone" defaultValue={member.phone ?? ""} inputMode="tel" autoComplete="off" placeholder="21 99999-9999" disabled={pending} />
          </label>
        ) : null}
        <div className={form.field}>
          <LiteSelect label="Cargo" value={jobTitle} onChange={chooseJobTitle} options={JOB_TITLES.filter((value) => currentRole === "director" || (value !== "manager" && value !== "director")).map((value) => ({ value, label: JOB_TITLE_LABELS[value]! }))} />
          <input type="hidden" name="jobTitle" value={jobTitle} />
        </div>
        <div className={form.field}>
          {roleLocked ? (
            <>
              <span className={form.label}>Perfil de acesso</span>
              <span className={styles.locked}>{ROLE_OPTION_LABELS[role as TenantRole] ?? role}</span>
              {jobTitle === "broker" ? <span className={form.hint}>Corretor usa operação individual automaticamente.</span> : null}
            </>
          ) : (
            <LiteSelect label="Perfil de acesso" value={role} onChange={chooseRole} options={(["director", "manager", "supervisor", "broker"] as const).map((value) => ({ value, label: ROLE_OPTION_LABELS[value] }))} />
          )}
          <input type="hidden" name="role" value={role} />
        </div>
        {customRoles.length > 0 && jobTitle !== "director" ? (
          <div className={form.field}>
            <LiteSelect label="Cargo personalizado (opcional)" value={customRoleId} onChange={setCustomRoleId} placeholder="Nenhum cargo personalizado" options={[{ value: "", label: "Nenhum cargo personalizado" }, ...customRoles.map((item) => ({ value: item.id, label: item.name }))]} />
            <input type="hidden" name="customRoleId" value={customRoleId || "__none__"} />
          </div>
        ) : null}
        <div className={form.field}>
          {allowedBranches.length === 1 ? (
            <>
              <span className={form.label}>{requiresBranch ? "Unidade" : "Unidade (opcional)"}</span>
              <span className={styles.locked}>{branchId === "__tenant__" ? "Geral da empresa" : allowedBranches.find((branch) => branch.id === branchId)?.name ?? allowedBranches[0]!.name}</span>
            </>
          ) : (
            <LiteSelect label={requiresBranch ? "Unidade" : "Unidade (opcional)"} value={branchId} placeholder={requiresBranch ? "Selecione a unidade" : "Geral da empresa"} onChange={chooseBranch} options={branchOptions} />
          )}
          <input type="hidden" name="branchId" value={branchId} />
          <span className={form.hint}>{requiresBranch ? "Este acesso precisa ficar em uma única unidade." : "Sem unidade, este cargo atua em toda a empresa dentro das permissões liberadas."}</span>
        </div>
        {role === "supervisor" && member.userId ? (
          <div className={form.field}>
            <span className={form.label}>Corretores que ele supervisiona ({team.length})</span>
            <input type="hidden" name="supervisedBrokerIds" value={JSON.stringify(team)} />
            <input className={form.input} value={teamSearch} onChange={(event) => setTeamSearch(event.target.value)} placeholder="Buscar corretor" aria-label="Buscar corretor" disabled={pending} />
            <ul className={form.checks}>
              {teamCandidates
                .filter((item) => !needle || (item.name ?? item.email).toLocaleLowerCase("pt-BR").includes(needle))
                .map((item) => {
                  const checked = team.includes(item.userId!);
                  const elsewhere = item.supervisorId && item.supervisorId !== member.userId ? allMembers.find((other) => other.userId === item.supervisorId)?.name : null;
                  return (
                    <li key={item.id}>
                      <label className={form.check}>
                        <input type="checkbox" checked={checked} disabled={pending} onChange={() => setTeam((current) => (checked ? current.filter((id) => id !== item.userId) : [...current, item.userId!]))} />
                        <span className={styles.checkName}>{item.name ?? item.email}</span>
                        {elsewhere && !checked ? <span className={page.cellSub}>com {elsewhere}</span> : null}
                      </label>
                    </li>
                  );
                })}
              {!teamCandidates.length ? <li className={page.muted}>Nenhum corretor ativo nesta unidade.</li> : null}
            </ul>
            <span className={form.hint}>Só corretores ativos da unidade do supervisor. Marcar um corretor que já está com outro supervisor passa ele para este.</span>
          </div>
        ) : null}
        <div className={form.actions}>
          <button type="button" className={page.button} disabled={pending} onClick={() => onOpenChange(false)}>Cancelar</button>
          <button type="submit" className={page.primaryButton} disabled={pending}>{pending ? "Salvando..." : "Salvar alterações"}</button>
        </div>
      </form>
    </LiteSidePanel>
  );
}

/** Excluir membro: confirmação Lite com o mesmo texto do diálogo atual. */
export function DeleteMemberLite({ member, open, onOpenChange }: { member: TeamMemberLite; open: boolean; onOpenChange: (open: boolean) => void }) {
  const refresh = useRefreshOnSuccess();
  const [, startTransition] = useTransition();
  const confirm = () => {
    const data = new FormData();
    data.set("memberId", member.id);
    startTransition(async () => {
      const result = await deleteTeamMemberAction({}, data);
      if (result.success) {
        toast.success("Membro removido com sucesso.");
        onOpenChange(false);
        refresh();
      }
      if (result.error) toast.error(result.error);
    });
  };
  return (
    <LiteConfirmDialog
      open={open}
      tone="danger"
      title="Excluir membro"
      confirmLabel="Excluir membro"
      onCancel={() => onOpenChange(false)}
      onConfirm={confirm}
      description={(
        <div className={styles.deleteBody}>
          <span>Essa ação remove o acesso desta empresa, a associação de equipe e as sessões ativas. O histórico operacional é preservado.</span>
          <span className={styles.deleteCard}>
            <span className={page.cellTitle}>{member.name ?? "Sem nome"}</span>
            <span className={page.cellSub}>{member.email}</span>
            <span className={styles.badges}>
              <span className={page.badge}>{ROLE_LABELS[member.role]}</span>
              <span className={page.badge} data-tone={member.status === "active" ? "success" : member.status === "pending" ? "warning" : undefined}>{STATUS_LABELS[member.status]}</span>
            </span>
          </span>
        </div>
      )}
    />
  );
}

/** Transferir todos os leads do corretor para outro corretor ativo. */
export function TransferLeadsLite({ member, open, onOpenChange, allMembers }: { member: TeamMemberLite; open: boolean; onOpenChange: (open: boolean) => void; allMembers: TeamMemberLite[] }) {
  const refresh = useRefreshOnSuccess();
  const [pending, startTransition] = useTransition();
  const [target, setTarget] = useState("");
  const brokers = allMembers.filter((item) => item.role === "broker" && item.status === "active" && item.userId && item.userId !== member.userId);
  useEffect(() => {
    if (!open) setTarget("");
  }, [open]);
  const submit = () => {
    const data = new FormData();
    data.set("fromUserId", member.userId ?? "");
    data.set("toUserId", target);
    startTransition(async () => {
      const result = await transferLeadsAction({}, data);
      if (result.success) {
        toast.success("Leads transferidos com sucesso.");
        onOpenChange(false);
        refresh();
      }
      if (result.error) toast.error(result.error);
    });
  };
  return (
    <LiteSidePanel open={open} onOpenChange={onOpenChange} title="Transferir leads em lote" description={`Mova todos os leads de ${member.name ?? member.email} para outro corretor ativo.`}>
      <div className={form.form}>
        <LiteSelect label="Corretor de destino" value={target} placeholder="Selecione um corretor ativo" onChange={setTarget} options={brokers.map((broker) => ({ value: broker.userId!, label: `${broker.name ?? broker.email} (${broker.branchName ?? "sem unidade"})` }))} />
        {brokers.length === 0 ? <p className={styles.error}>Nenhum outro corretor ativo disponível para receber os leads.</p> : null}
        <div className={form.actions}>
          <button type="button" className={page.button} disabled={pending} onClick={() => onOpenChange(false)}>Cancelar</button>
          <button type="button" className={page.primaryButton} disabled={pending || brokers.length === 0 || !target} onClick={submit}>{pending ? "Transferindo..." : "Confirmar transferência"}</button>
        </div>
      </div>
    </LiteSidePanel>
  );
}

/** Redefinir senha: gera o link, que vai direto para o WhatsApp do membro; a mensagem pronta fica para copiar. */
export function ResetPasswordLite({ member, open, onOpenChange }: { member: TeamMemberLite; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [pending, setPending] = useState(false);
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [whatsapp, setWhatsapp] = useState<"sent" | "failed" | "no_phone" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const memberName = member.name ?? member.email;

  useEffect(() => {
    if (!open) {
      setResetUrl(null);
      setWhatsapp(null);
      setError(null);
      setCopied(false);
      setPending(false);
    }
  }, [open]);

  const generate = async () => {
    const targetId = member.userId ?? member.id;
    setPending(true);
    setError(null);
    try {
      const data = new FormData();
      data.set("userId", targetId);
      const result = await generateResetPasswordLinkAction({}, data);
      if (result.success && result.resetUrl) {
        setResetUrl(result.resetUrl.startsWith("http") ? result.resetUrl : `${window.location.origin}${result.resetUrl}`);
        setWhatsapp(result.resetWhatsApp ?? null);
        if (result.resetWhatsApp === "sent") toast.success(`Link enviado no WhatsApp de ${memberName}.`);
      } else {
        setError(result.error ?? "Erro desconhecido ao gerar o link.");
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Falha na requisição. Verifique sua conexão.");
    } finally {
      setPending(false);
    }
  };

  const message = resetUrl ? `Olá, ${memberName}! Seu link para redefinir sua senha no sistema Âncora CRM foi gerado. Acesse o link abaixo para criar sua nova senha:\n\n${resetUrl}\n\nEste link é seguro e é válido por 24 horas.` : "";
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      toast.success("Mensagem e link copiados com sucesso!");
      window.setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error("Erro ao copiar para a área de transferência.");
    }
  };

  return (
    <LiteSidePanel open={open} onOpenChange={onOpenChange} title="Redefinir senha do membro" description={`O link seguro de redefinição vai direto para o WhatsApp de ${memberName}.`}>
      <div className={form.form}>
        {error ? <p className={styles.error} role="alert">{error}</p> : null}
        {!resetUrl ? (
          <>
            <p className={page.muted}>Ao gerar o link, todas as sessões ativas deste membro são encerradas por segurança.</p>
            <div className={form.actions}>
              <button type="button" className={page.button} disabled={pending} onClick={() => onOpenChange(false)}>Cancelar</button>
              <button type="button" className={page.primaryButton} disabled={pending} onClick={generate}><KeyRound aria-hidden="true" size={16} />{pending ? "Gerando e enviando..." : "Gerar e enviar no WhatsApp"}</button>
            </div>
          </>
        ) : (
          <>
            {whatsapp === "sent" ? <p className={page.badge} data-tone="success">Link enviado no WhatsApp de {memberName}.</p> : null}
            {whatsapp === "no_phone" ? <p className={page.badge} data-tone="warning">{memberName} não tem WhatsApp cadastrado. Copie a mensagem e envie.</p> : null}
            {whatsapp === "failed" ? <p className={page.badge} data-tone="warning">Não deu para enviar pelo WhatsApp agora. Copie a mensagem e envie.</p> : null}
            <label className={form.field}>
              <span className={form.label}>Mensagem pronta com o link</span>
              <textarea className={form.textarea} readOnly rows={6} value={message} />
            </label>
            <div className={form.actions}>
              <button type="button" className={page.button} onClick={() => onOpenChange(false)}>Fechar</button>
              <button type="button" className={page.primaryButton} onClick={copy}>{copied ? <Check aria-hidden="true" size={16} /> : <Copy aria-hidden="true" size={16} />}{copied ? "Copiado" : "Copiar mensagem e link"}</button>
            </div>
          </>
        )}
      </div>
    </LiteSidePanel>
  );
}
