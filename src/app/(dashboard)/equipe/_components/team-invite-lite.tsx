"use client";

/**
 * Criar membro no visual Lite (página /equipe/convidar e, depois, o "Novo funcionário" de /equipe). Mesmas regras e
 * mesmas Server Actions do TeamInviteSection: cadastro manual (cargo, perfil de acesso, código do corretor, cargo
 * personalizado, unidade) ou importação CSV; ao criar, a mensagem pronta com o link de ativação.
 */
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Copy, Link2, MessageCircle } from "lucide-react";

import { LiteSelect } from "@/components/lite/controls";
import form from "@/components/lite/page/lite-form.module.css";
import page from "@/components/lite/page/lite-page.module.css";
import { toast } from "@/components/ui/sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { openWhatsApp } from "@/lib/whatsapp-open";
import { buildWhatsAppWebUrl } from "@/lib/whatsapp-url";

import { createTeamUserAction, importBrokersAction } from "../actions";
import styles from "./team-invite-lite.module.css";

export type InviteCustomRole = { id: string; name: string; scope: "none" | "own" | "branch" | "tenant" };

const JOB_TITLES = [
  { value: "director", label: "Diretor" },
  { value: "manager", label: "Gestor" },
  { value: "broker", label: "Corretor" },
  { value: "marketing", label: "Marketing" },
  { value: "finance", label: "Financeiro" },
  { value: "operations", label: "Operações" },
  { value: "support", label: "Suporte" },
] as const;

const ROLE_LABELS: Record<string, string> = { director: "Acesso global (direção)", manager: "Gestão da unidade", broker: "Operação individual" };

/** Mensagem de convite: o mesmo texto da tela atual. */
export function inviteMessage(name: string | null, link: string) {
  return `Olá${name ? `, ${name}` : ""}! Seja bem-vindo(a) à nossa equipe.\n\nPara concluir o seu cadastro e ativar o seu acesso ao CRM, acesse o seu link de ativação exclusivo abaixo:\n\n${link}\n\nSe precisar de ajuda com o seu primeiro acesso, estou à disposição!`;
}

export function TeamInviteLite({ branches, canInviteManager, canInviteDirector = false, customRoles = [], onDone }: {
  branches: { id: string; name: string }[];
  canInviteManager: boolean;
  canInviteDirector?: boolean;
  customRoles?: InviteCustomRole[];
  /** Fechar o painel que hospeda o formulário (quando houver). */
  onDone?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState<"manual" | "csv">("manual");
  const [jobTitle, setJobTitle] = useState("broker");
  const [role, setRole] = useState("broker");
  const [customRoleId, setCustomRoleId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [branchError, setBranchError] = useState(false);
  const [created, setCreated] = useState<{ name: string; link: string; whatsapp: string } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const csvRef = useRef<HTMLFormElement>(null);

  const jobOptions = JOB_TITLES.filter((item) => (item.value === "director" ? canInviteDirector : canInviteManager || item.value !== "manager"));
  const roleOptions = [
    ...(canInviteDirector ? ["director"] : []),
    ...(canInviteManager && jobTitle !== "director" ? ["manager"] : []),
    ...(jobTitle !== "manager" && jobTitle !== "director" ? ["broker"] : []),
  ].map((value) => ({ value, label: ROLE_LABELS[value]! }));
  const roleLocked = jobTitle === "manager" || jobTitle === "director" || jobTitle === "broker";

  const chooseJobTitle = (value: string) => {
    setJobTitle(value);
    if (value === "director" || value === "manager" || value === "supervisor" || value === "broker") setRole(value);
  };
  const chooseRole = (value: string) => {
    setRole(value);
    if (value === "director") setJobTitle("director");
    else if (value === "manager" && (jobTitle === "director" || jobTitle === "broker")) setJobTitle("manager");
  };

  const submit = (data: FormData) => {
    if (!branchId) {
      setBranchError(true);
      return;
    }
    const name = String(data.get("name") ?? "");
    const titleLabel = JOB_TITLES.find((item) => item.value === jobTitle)?.label ?? "Funcionário";
    startTransition(async () => {
      const result = await createTeamUserAction({ success: false }, data);
      if (!result.success) {
        toast.error("Não foi possível criar o acesso", { description: result.error });
        return;
      }
      toast.success(`Acesso de ${titleLabel} criado com sucesso.`);
      if (result.token) {
        setCreated({ name, link: `${window.location.origin}/onboarding?token=${result.token}`, whatsapp: result.whatsappStatus ?? "not_available" });
      } else {
        formRef.current?.reset();
        onDone?.();
      }
      router.refresh();
    });
  };

  const importCsv = (data: FormData) => {
    startTransition(async () => {
      const result = await importBrokersAction({ success: false }, data);
      if (result.success) {
        toast.success("Importação concluída.", { description: result.report || "" });
        csvRef.current?.reset();
        onDone?.();
        router.refresh();
      } else {
        toast.error("Não foi possível importar", { description: result.error });
      }
    });
  };

  if (created) {
    const message = inviteMessage(created.name || null, created.link);
    const whatsappText = created.whatsapp === "sent" ? "Convite enviado pelo WhatsApp corporativo." : created.whatsapp === "queued" ? "Convite na fila de envio do WhatsApp corporativo." : "Envie a mensagem de convite manualmente.";
    return (
      <div className={form.form}>
        <div className={styles.done}>
          <CheckCircle2 aria-hidden="true" size={24} className={styles.doneIcon} />
          <div className={page.cardHead}>
            <h2 className={page.sectionTitle}>Convite criado</h2>
            <p className={page.muted}>O perfil foi criado. Como não usamos senha padrão, envie o link de ativação exclusivo para o colaborador.</p>
          </div>
        </div>
        <p className={page.badge} data-tone={created.whatsapp === "queued" || created.whatsapp === "sent" ? "success" : "warning"}>{whatsappText}</p>
        <div className={form.field}>
          <span className={form.label}>Mensagem pronta para WhatsApp</span>
          <p className={styles.message}>{message}</p>
        </div>
        <div className={styles.doneActions}>
          <button type="button" className={page.primaryButton} onClick={async () => { await navigator.clipboard.writeText(message); toast.success("Mensagem completa de convite copiada!"); }}>
            <Copy aria-hidden="true" size={16} />Copiar mensagem
          </button>
          <button type="button" className={page.button} onClick={async () => { await navigator.clipboard.writeText(created.link); toast.success("Link direto copiado!"); }}>
            <Link2 aria-hidden="true" size={16} />Copiar só o link
          </button>
          <button type="button" className={page.button} onClick={() => openWhatsApp(buildWhatsAppWebUrl(null, message))}>
            <MessageCircle aria-hidden="true" size={16} />Abrir no WhatsApp
          </button>
          <button type="button" className={page.button} onClick={() => { setCreated(null); setCustomRoleId(""); setTab("manual"); onDone?.(); }}>Fechar</button>
        </div>
      </div>
    );
  }

  return (
    <Tabs value={tab} onValueChange={(value) => setTab(value as "manual" | "csv")} variant="segment" className={styles.tabs}>
      <TabsList aria-label="Forma de cadastro" className="w-max">
        <TabsTrigger value="manual">Cadastro manual</TabsTrigger>
        <TabsTrigger value="csv">Importação CSV</TabsTrigger>
      </TabsList>

      <TabsContent value="manual">
        <form ref={formRef} action={submit} className={form.form}>
          <div className={form.row}>
            <label className={form.field}>
              <span className={form.label}>Nome</span>
              <input className={form.input} name="name" required disabled={pending} autoComplete="name" />
            </label>
            <label className={form.field}>
              <span className={form.label}>Telefone</span>
              <input className={form.input} name="phone" required disabled={pending} placeholder="(21) 99999-9999" inputMode="tel" />
            </label>
          </div>
          <div className={form.row}>
            <label className={form.field}>
              <span className={form.label}>E-mail (opcional)</span>
              <input className={form.input} name="email" type="email" autoComplete="email" disabled={pending} />
              <span className={form.hint}>Se ficar vazio, o membro define o e-mail de acesso ao abrir o convite.</span>
            </label>
            <label className={form.field}>
              <span className={form.label}>CPF (opcional)</span>
              <input className={form.input} name="cpf" disabled={pending} placeholder="000.000.000-00" inputMode="numeric" />
            </label>
          </div>
          <div className={form.row}>
            <div className={form.field}>
              <LiteSelect label="Cargo" value={jobTitle} onChange={chooseJobTitle} options={jobOptions.map((item) => ({ value: item.value, label: item.label }))} />
              <input type="hidden" name="jobTitle" value={jobTitle} />
            </div>
            <div className={form.field}>
              {roleLocked ? (
                <>
                  <span className={form.label}>Perfil de acesso</span>
                  <span className={styles.locked}>{ROLE_LABELS[role] ?? role}</span>
                  {jobTitle === "broker" ? <span className={form.hint}>Corretor usa operação individual automaticamente.</span> : null}
                </>
              ) : (
                <LiteSelect label="Perfil de acesso" value={role} onChange={chooseRole} options={roleOptions} />
              )}
              <input type="hidden" name="role" value={role} />
            </div>
          </div>
          {jobTitle === "broker" ? (
            <label className={form.field}>
              <span className={form.label}>Código do corretor (opcional)</span>
              <input className={form.input} name="brokerCode" placeholder="Ex.: COR-001" autoComplete="off" disabled={pending} />
              <span className={form.hint}>Se ficar vazio, o sistema gera um código. O código é único nesta corretora.</span>
            </label>
          ) : null}
          {customRoles.length > 0 && jobTitle !== "director" ? (
            <div className={form.field}>
              <LiteSelect label="Cargo personalizado (opcional)" value={customRoleId} onChange={setCustomRoleId} placeholder="Nenhum cargo personalizado" options={[{ value: "", label: "Nenhum cargo personalizado" }, ...customRoles.map((item) => ({ value: item.id, label: item.name }))]} />
              <input type="hidden" name="customRoleId" value={customRoleId} />
              <span className={form.hint}>O cargo define permissões e rotas visíveis; o perfil continua sendo o papel operacional.</span>
            </div>
          ) : null}
          <div className={form.field}>
            <LiteSelect label="Unidade" value={branchId} placeholder="Selecione a unidade" onChange={(value) => { setBranchId(value); setBranchError(false); }} options={branches.map((branch) => ({ value: branch.id, label: branch.name }))} />
            <input type="hidden" name="branchId" value={branchId} />
            {branchError ? <span className={styles.error} role="alert">Escolha a unidade do membro.</span> : null}
          </div>
          <div className={form.actions}>
            <button type="submit" className={page.primaryButton} disabled={pending}>{pending ? "Criando acesso..." : "Criar acesso"}</button>
          </div>
        </form>
      </TabsContent>

      <TabsContent value="csv">
        <form ref={csvRef} action={importCsv} className={form.form}>
          <label className={form.field}>
            <span className={form.label}>Arquivo CSV (.csv)</span>
            <input className={styles.file} name="file" type="file" accept=".csv" required disabled={pending} />
          </label>
          <div className={styles.instructions}>
            <span className={page.cellTitle}>Como montar o CSV</span>
            <ol>
              <li>O cabeçalho obrigatório é nome, telefone.</li>
              <li>E-mail, CPF e unidade são opcionais. Sem e-mail, o corretor define no primeiro acesso.</li>
              <li>Cada corretor entra como pendente e recebe o convite de primeiro acesso pela fila do WhatsApp oficial.</li>
            </ol>
          </div>
          <div className={form.actions}>
            <button type="submit" className={page.primaryButton} disabled={pending}>{pending ? "Importando..." : "Importar corretores"}</button>
          </div>
        </form>
      </TabsContent>
    </Tabs>
  );
}
