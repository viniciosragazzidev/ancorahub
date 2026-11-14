"use client";

/**
 * Ações de membro no visual Lite (/equipe): editar, transferir leads e redefinir senha em painel lateral; excluir na
 * confirmação Lite. Mesmas Server Actions, regras e textos dos diálogos de member-actions.tsx.
 *
 * Feedback (FEEDBACK.md, nível 1): o botão mostra o envio; depois que o servidor confirma, o painel fecha e
 * `onDone` leva a confirmação para a lista (o objeto). A falha fica no painel, com a causa e "Tentar de novo".
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, KeyRound } from "lucide-react";

import { LiteConfirmDialog, LiteSelect } from "@/components/lite/controls";
import { actionErrorMessage, normalizeActionError } from "@/lib/feedback/action-error";
import { useFeedback } from "@/lib/feedback/use-feedback";
import { LiteSidePanel } from "@/components/lite/data/side-panel";
import form from "@/components/lite/page/lite-form.module.css";
import page from "@/components/lite/page/lite-page.module.css";
import type { TenantRole } from "@/shared/db/schema";

import { deleteTeamMemberAction, generateResetPasswordLinkAction, transferLeadsAction, updateTeamMemberAction } from "../actions";
import { ActionNote, BusyLabel, useActionStatus } from "./action-status-lite";
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
export function EditMemberLite({ member, open, onOpenChange, branches, currentRole, currentBranchId, customRoles, allMembers, onDone }: {
  member: TeamMemberLite;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branches: BranchOption[];
  currentRole: TenantRole;
  currentBranchId: string | null;
  customRoles: CustomRoleOption[];
  allMembers: TeamMemberLite[];
  /** Confirmação na lista depois que o painel fecha. */
  onDone?: (label: string) => void;
}) {
  const refresh = useRefreshOnSuccess();
  const { status, run } = useActionStatus();
  const pending = status.edit?.state === "busy";
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
    // O que acontece depois do servidor fica dentro da tarefa: o "Tentar de novo" refaz tudo.
    void run("edit", async () => {
      const result = await updateTeamMemberAction({}, data);
      if (!result.success) return { ok: false as const, error: result.error };
      onOpenChange(false);
      onDone?.(`${member.name ?? member.email}: dados atualizados`);
      refresh();
      return result;
    }, { done: "Membro atualizado", fallback: "Não deu para salvar as alterações agora.", keeps: "O que você preencheu continua aqui." });
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
          <button type="submit" className={page.primaryButton} disabled={pending} aria-busy={pending || undefined}><BusyLabel busy={pending} label="Salvando…">Salvar alterações</BusyLabel></button>
        </div>
        {status.edit?.state === "error" ? <ActionNote status={status.edit} /> : null}
      </form>
    </LiteSidePanel>
  );
}

/** Excluir membro: confirmação Lite com o mesmo texto do diálogo atual. */
export function DeleteMemberLite({ member, open, onOpenChange, onDone }: { member: TeamMemberLite; open: boolean; onOpenChange: (open: boolean) => void; onDone?: (label: string) => void }) {
  const refresh = useRefreshOnSuccess();
  const { status, run } = useActionStatus();
  const pending = status.delete?.state === "busy";
  const confirm = () => {
    if (pending) return;
    const data = new FormData();
    data.set("memberId", member.id);
    void run("delete", async () => {
      const result = await deleteTeamMemberAction({}, data);
      if (!result.success) return { ok: false as const, error: result.error };
      onOpenChange(false);
      onDone?.(`${member.name ?? member.email} removido da equipe`);
      refresh();
      return result;
    }, { done: "Membro removido", fallback: "Não deu para excluir o membro agora.", keeps: "O acesso continua como estava." });
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
          {pending ? <span className={page.muted} role="status">Excluindo…</span> : null}
          {status.delete?.state === "error" ? <ActionNote status={status.delete} /> : null}
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
export function TransferLeadsLite({ member, open, onOpenChange, allMembers, onDone }: { member: TeamMemberLite; open: boolean; onOpenChange: (open: boolean) => void; allMembers: TeamMemberLite[]; onDone?: (label: string) => void }) {
  const refresh = useRefreshOnSuccess();
  const { status, run } = useActionStatus();
  const pending = status.transfer?.state === "busy";
  const [target, setTarget] = useState("");
  const brokers = allMembers.filter((item) => item.role === "broker" && item.status === "active" && item.userId && item.userId !== member.userId);
  useEffect(() => {
    if (!open) setTarget("");
  }, [open]);
  const submit = () => {
    const data = new FormData();
    data.set("fromUserId", member.userId ?? "");
    data.set("toUserId", target);
    const targetName = brokers.find((broker) => broker.userId === target)?.name ?? "o corretor escolhido";
    void run("transfer", async () => {
      const result = await transferLeadsAction({}, data);
      if (!result.success) return { ok: false as const, error: result.error };
      onOpenChange(false);
      onDone?.(`Leads de ${member.name ?? member.email} transferidos para ${targetName}`);
      refresh();
      return result;
    }, { done: "Leads transferidos", fallback: "Não deu para transferir os leads agora.", keeps: `Os leads continuam com ${member.name ?? member.email}.` });
  };
  return (
    <LiteSidePanel open={open} onOpenChange={onOpenChange} title="Transferir leads em lote" description={`Mova todos os leads de ${member.name ?? member.email} para outro corretor ativo.`}>
      <div className={form.form}>
        <LiteSelect label="Corretor de destino" value={target} placeholder="Selecione um corretor ativo" onChange={setTarget} options={brokers.map((broker) => ({ value: broker.userId!, label: `${broker.name ?? broker.email} (${broker.branchName ?? "sem unidade"})` }))} />
        {brokers.length === 0 ? <p className={styles.error}>Nenhum outro corretor ativo disponível para receber os leads.</p> : null}
        <div className={form.actions}>
          <button type="button" className={page.button} disabled={pending} onClick={() => onOpenChange(false)}>Cancelar</button>
          <button type="button" className={page.primaryButton} disabled={pending || brokers.length === 0 || !target} aria-busy={pending || undefined} onClick={submit}><BusyLabel busy={pending} label="Transferindo…">Confirmar transferência</BusyLabel></button>
        </div>
        {status.transfer?.state === "error" ? <ActionNote status={status.transfer} /> : null}
      </div>
    </LiteSidePanel>
  );
}

/** Redefinir senha: gera o link, que vai direto para o WhatsApp do membro; a mensagem pronta fica para copiar. */
export function ResetPasswordLite({ member, open, onOpenChange }: { member: TeamMemberLite; open: boolean; onOpenChange: (open: boolean) => void }) {
  const fire = useFeedback();
  const [pending, setPending] = useState(false);
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [whatsapp, setWhatsapp] = useState<"sent" | "failed" | "no_phone" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"idle" | "copied" | "failed">("idle");
  const memberName = member.name ?? member.email;

  useEffect(() => {
    if (!open) {
      setResetUrl(null);
      setWhatsapp(null);
      setError(null);
      setCopied("idle");
      setPending(false);
    }
  }, [open]);

  const generate = async () => {
    if (pending) return;
    const targetId = member.userId ?? member.id;
    setPending(true);
    setError(null);
    fire("tap");
    try {
      const data = new FormData();
      data.set("userId", targetId);
      const result = await generateResetPasswordLinkAction({}, data);
      if (result.success && result.resetUrl) {
        // O resultado (link enviado ou mensagem para copiar) aparece no próprio painel; sem toast repetindo.
        setResetUrl(result.resetUrl.startsWith("http") ? result.resetUrl : `${window.location.origin}${result.resetUrl}`);
        setWhatsapp(result.resetWhatsApp ?? null);
        fire("confirm");
      } else {
        fire("error");
        setError(actionErrorMessage(normalizeActionError(result.error, "Não deu para gerar o link agora."), "A senha atual continua valendo."));
      }
    } catch (failure) {
      fire("error");
      setError(actionErrorMessage(normalizeActionError(failure, "Não deu para gerar o link agora."), "A senha atual continua valendo."));
    } finally {
      setPending(false);
    }
  };

  const message = resetUrl ? `Olá, ${memberName}! Seu link para redefinir sua senha no sistema Âncora CRM foi gerado. Acesse o link abaixo para criar sua nova senha:\n\n${resetUrl}\n\nEste link é seguro e é válido por 24 horas.` : "";
  // Copiar é nível 0: o botão mostra "Copiado" e volta sozinho.
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied("copied");
    } catch {
      setCopied("failed");
    }
    window.setTimeout(() => setCopied("idle"), 3000);
  };

  return (
    <LiteSidePanel open={open} onOpenChange={onOpenChange} title="Redefinir senha do membro" description={`O link seguro de redefinição vai direto para o WhatsApp de ${memberName}.`}>
      <div className={form.form}>
        {error ? (
          <div className={styles.badges}>
            <p className={styles.error} role="alert">{error}</p>
            {!resetUrl ? <button type="button" className={page.button} disabled={pending} onClick={generate}>Tentar de novo</button> : null}
          </div>
        ) : null}
        {!resetUrl ? (
          <>
            <p className={page.muted}>Ao gerar o link, todas as sessões ativas deste membro são encerradas por segurança.</p>
            <div className={form.actions}>
              <button type="button" className={page.button} disabled={pending} onClick={() => onOpenChange(false)}>Cancelar</button>
              <button type="button" className={page.primaryButton} disabled={pending} aria-busy={pending || undefined} onClick={generate}><BusyLabel busy={pending} label="Gerando e enviando…"><KeyRound aria-hidden="true" size={16} />Gerar e enviar no WhatsApp</BusyLabel></button>
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
              <button type="button" className={page.primaryButton} onClick={copy}>{copied === "copied" ? <Check aria-hidden="true" size={16} /> : <Copy aria-hidden="true" size={16} />}<span role="status">{copied === "copied" ? "Copiado" : copied === "failed" ? "Não deu para copiar" : "Copiar mensagem e link"}</span></button>
            </div>
          </>
        )}
      </div>
    </LiteSidePanel>
  );
}
