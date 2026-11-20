"use client";

/**
 * Unidades no visual Lite (/equipe?visao=unidades): os mesmos números e as mesmas ações do BranchesManager, em
 * cartões por unidade com as três chaves (recebe leads, distribuição automática, central), editar, ativar ou
 * desativar e abrir a unidade. Criar e editar em painel lateral.
 *
 * Feedback (FEEDBACK.md, nível 1): cada chave, ativar ou desativar e salvar mostram o envio e confirmam ao lado do
 * próprio controle depois do servidor; a falha mostra a causa, o que continua valendo e "Tentar de novo". Sem toast.
 */
import Link from "next/link";
import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Pencil, Plus, Power, Search } from "lucide-react";

import { Switch } from "@/components/arc/switch/switch";
import { StatCard } from "@/components/dashboard/metric-card";
import { LiteResponsiveData, type LiteColumn } from "@/components/lite/data/data";
import { LiteSidePanel } from "@/components/lite/data/side-panel";
import form from "@/components/lite/page/lite-form.module.css";
import page from "@/components/lite/page/lite-page.module.css";
import { LiteSuccess } from "@/components/lite/motion/success";
import { actionErrorMessage, normalizeActionError } from "@/lib/feedback/action-error";
import { useFeedback } from "@/lib/feedback/use-feedback";
import { createBranchAction, toggleAcceptingLeadsAction, toggleAutoDistributeAction, toggleBranchAction, toggleDistributionHubAction, updateBranchAction, type BranchActionState } from "@/features/branches/actions";

import styles from "./units-lite.module.css";

export type UnitLite = {
  id: string;
  name: string;
  externalId: string | null;
  status: "active" | "inactive";
  memberCount: number;
  acceptingLeads: boolean;
  autoDistribute: boolean;
  isDistributionHub: boolean;
  availableBrokers: number;
  activeLeads: number;
  newLeads: number;
};

type BranchAction = (previous: BranchActionState, formData: FormData) => Promise<BranchActionState>;

type BranchNote = { kind: "done"; label: string } | { kind: "error"; message: string; retry: () => void } | null;

function useBranchAction() {
  const router = useRouter();
  const fire = useFeedback();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<BranchNote>(null);
  const run = (action: BranchAction, data: FormData, onDone?: () => void) => {
    setResult(null);
    fire("tap");
    startTransition(async () => {
      let outcome: BranchActionState;
      let thrown = false;
      try {
        outcome = await action({}, data);
      } catch (error) {
        thrown = true;
        outcome = { error: error instanceof Error ? error.message : undefined };
      }
      if (thrown || outcome.error) {
        fire("error");
        const info = normalizeActionError(outcome.error, "Não deu para salvar agora.");
        setResult({ kind: "error", message: actionErrorMessage(info, "A unidade continua como estava."), retry: () => run(action, data, onDone) });
        return;
      }
      fire("confirm");
      setResult({ kind: "done", label: outcome.message ?? "Configuração atualizada" });
      onDone?.();
      router.refresh();
    });
  };
  const note: ReactNode = pending || !result ? null
    : result.kind === "done" ? <LiteSuccess label={result.label} className="text-sm text-[var(--success)]" />
    : (
      <span className="flex flex-wrap items-center gap-2">
        <span role="alert" className="text-sm text-[var(--danger)]">{result.message}</span>
        <button type="button" className={page.button} onClick={result.retry}>Tentar de novo</button>
      </span>
    );
  return { pending, run, note };
}

function BranchForm({ branch, onDone }: { branch?: UnitLite; onDone: () => void }) {
  const { pending, run, note } = useBranchAction();
  return (
    <form
      className={form.form}
      action={(data) => run(branch ? updateBranchAction : createBranchAction, data, onDone)}
    >
      {branch ? <input type="hidden" name="branchId" value={branch.id} /> : null}
      <label className={form.field}>
        <span className={form.label}>{branch ? "Nome" : "Nome da filial"}</span>
        <input className={form.input} name="name" defaultValue={branch?.name ?? ""} placeholder="Ex.: Filial Centro" required disabled={pending} />
      </label>
      <label className={form.field}>
        <span className={form.label}>Identificador externo (opcional)</span>
        <input className={form.input} name="externalId" defaultValue={branch?.externalId ?? ""} placeholder="Ex.: FIL-01" disabled={pending} />
      </label>
      <div className={form.actions}>
        <button type="button" className={page.button} disabled={pending} onClick={onDone}>Cancelar</button>
        <button type="submit" className={page.primaryButton} disabled={pending} aria-busy={pending || undefined}>{pending ? "Salvando…" : branch ? "Salvar alterações" : "Salvar filial"}</button>
      </div>
      {note}
    </form>
  );
}

function UnitSwitch({ branchId, label, enabled, action, readOnly, readOnlyText, compact = false }: { branchId: string; label: string; enabled: boolean; action: BranchAction; readOnly: boolean; readOnlyText: string; compact?: boolean }) {
  const { pending, run, note } = useBranchAction();
  if (readOnly) {
    return (
      <span className={styles.switchRow}>
        {compact ? null : <span>{label}</span>}
        <span className={page.muted}>{readOnlyText}</span>
      </span>
    );
  }
  return (
    <span className={styles.switchRow} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
      {compact ? null : <span>{label}</span>}
      <Switch
        checked={enabled}
        disabled={pending}
        aria-busy={pending || undefined}
        aria-label={`${label}: ${enabled ? "ligado" : "desligado"}`}
        onCheckedChange={() => {
          const data = new FormData();
          data.set("branchId", branchId);
          run(action, data);
        }}
      />
      {note}
    </span>
  );
}

function StatusButton({ branch }: { branch: UnitLite }) {
  const { pending, run, note } = useBranchAction();
  const verb = branch.status === "active" ? "Desativar" : "Ativar";
  return (
    <>
    <button
      type="button"
      className={page.iconButton}
      disabled={pending}
      aria-busy={pending || undefined}
      aria-label={`${verb} ${branch.name}`}
      title={`${verb} ${branch.name}`}
      onClick={() => {
        const data = new FormData();
        data.set("branchId", branch.id);
        run(toggleBranchAction, data);
      }}
    >
      <Power aria-hidden="true" size={18} />
    </button>
    {note}
    </>
  );
}

type UnitTab = "all" | "receiving" | "paused" | "inactive";

/** Aba de cada unidade: inativa primeiro; ativa que recebe leads ou ativa com recebimento pausado. */
export function unitTab(branch: Pick<UnitLite, "status" | "acceptingLeads">): Exclude<UnitTab, "all"> {
  if (branch.status !== "active") return "inactive";
  return branch.acceptingLeads ? "receiving" : "paused";
}

export function UnitsLite({ branches, canManage }: { branches: UnitLite[]; canManage: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<UnitTab>("all");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<UnitLite | null>(null);
  const needle = query.trim().toLocaleLowerCase("pt-BR");
  const visible = branches.filter((branch) => (tab === "all" || unitTab(branch) === tab)
    && (!needle || branch.name.toLocaleLowerCase("pt-BR").includes(needle) || (branch.externalId ?? "").toLocaleLowerCase("pt-BR").includes(needle)));
  const tabCounts = { all: branches.length, receiving: 0, paused: 0, inactive: 0 };
  for (const branch of branches) tabCounts[unitTab(branch)] += 1;
  const tabs: { value: UnitTab; label: string }[] = [
    { value: "all", label: "Todas" },
    { value: "receiving", label: "Recebendo leads" },
    { value: "paused", label: "Recebimento pausado" },
    { value: "inactive", label: "Inativas" },
  ];
  // Tabela no lugar da grade de cartões (20/11, regra de densidade do CLAUDE.md): uma linha por unidade.
  const columns: LiteColumn<UnitLite>[] = [
    { id: "name", label: "Unidade", primary: true, nowrap: true, render: (branch) => (
      <span>
        <span className={page.cellTitle}><Link href={`/unidades/${branch.id}`} className={page.cellLink} title={branch.name} onClick={(event) => event.stopPropagation()}>{branch.name}</Link></span>
        {branch.externalId ? <span className={page.cellSub}>Identificador {branch.externalId}</span> : null}
      </span>
    ) },
    { id: "status", label: "Status", nowrap: true, render: (branch) => <span className={page.badge} data-tone={branch.status === "active" ? "success" : undefined}>{branch.status === "active" ? "Ativa" : "Inativa"}</span> },
    { id: "members", label: "Equipe", numeric: true, render: (branch) => branch.memberCount },
    { id: "available", label: "Disponíveis", numeric: true, render: (branch) => <span data-tone={branch.availableBrokers === 0 ? "warning" : undefined}>{branch.availableBrokers}</span> },
    { id: "active", label: "Em atendimento", numeric: true, phonePriority: "low", render: (branch) => branch.activeLeads.toLocaleString("pt-BR") },
    { id: "accepting", label: "Recebe leads", render: (branch) => <UnitSwitch compact branchId={branch.id} label="Recebe leads" enabled={branch.acceptingLeads} action={toggleAcceptingLeadsAction} readOnly={!canManage} readOnlyText={branch.acceptingLeads ? "Sim" : "Pausado"} /> },
    { id: "auto", label: "Distribuição automática", phonePriority: "low", render: (branch) => <UnitSwitch compact branchId={branch.id} label="Distribuição automática" enabled={branch.autoDistribute} action={toggleAutoDistributeAction} readOnly={!canManage} readOnlyText={branch.autoDistribute ? "Sim" : "Não"} /> },
    { id: "hub", label: "Central", phonePriority: "low", render: (branch) => <UnitSwitch compact branchId={branch.id} label="Central de redistribuição" enabled={branch.isDistributionHub} action={toggleDistributionHubAction} readOnly={!canManage} readOnlyText={branch.isDistributionHub ? "Sim" : "Não"} /> },
    { id: "actions", label: "Ações", numeric: true, render: (branch) => (
      <span className={styles.icons} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
        {canManage ? (
          <>
            <button type="button" className={page.iconButton} aria-label={`Editar ${branch.name}`} title={`Editar ${branch.name}`} onClick={() => setEditing(branch)}><Pencil aria-hidden="true" size={18} /></button>
            <StatusButton branch={branch} />
          </>
        ) : null}
        <Link href={`/unidades/${branch.id}`} className={page.iconButton} aria-label={`Ver unidade ${branch.name}`} title="Ver unidade"><ChevronRight aria-hidden="true" size={18} /></Link>
      </span>
    ) },
  ];
  const active = branches.filter((branch) => branch.status === "active").length;
  const accepting = branches.filter((branch) => branch.acceptingLeads).length;
  const members = branches.reduce((total, branch) => total + branch.memberCount, 0);

  return (
    <>
      <div className={page.stats}>
        <StatCard label="Total de filiais" value={branches.length} sublabel="no total" animated />
        <StatCard label="Filiais ativas" value={active} sublabel="operacionais" animated animationDelay={0.06} />
        <StatCard label="Recebendo leads" value={accepting} sublabel="com recebimento ativo" animated animationDelay={0.12} />
        <StatCard label="Equipe vinculada" value={members} sublabel="membros nas unidades" animated animationDelay={0.18} />
      </div>

      <section className={page.group} aria-labelledby="unidades-lista">
        <div className={page.cardHead}>
          <h2 id="unidades-lista" className={page.sectionTitle}>Unidades</h2>
          <p className={page.muted}>Equipe, operação e chaves de distribuição de cada unidade.</p>
        </div>
        <div className={page.toolbar}>
          <label className={page.search}>
            <Search aria-hidden="true" size={18} className={page.searchIcon} />
            <input type="search" className={page.searchInput} aria-label="Buscar unidade" placeholder="Buscar pelo nome ou identificador" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <span className={styles.toolbarEnd}>
            <Link href="/distribuicao?view=plantao" className={page.button}>Plantões</Link>
            {canManage ? <button type="button" className={page.primaryButton} onClick={() => setCreating(true)}><Plus aria-hidden="true" size={16} />Nova filial</button> : null}
          </span>
        </div>

        {branches.length > 0 ? (
          <nav className={page.countTabs} aria-label="Filtrar unidades">
            {tabs.map((item) => (
              <button key={item.value} type="button" className={page.countTab} data-active={tab === item.value ? "true" : undefined} aria-pressed={tab === item.value} onClick={() => setTab(item.value)}>
                {item.label}<span className={page.countPill}>{tabCounts[item.value]}</span>
              </button>
            ))}
          </nav>
        ) : null}
        {branches.length === 0 ? (
          <div className={page.empty}><p className={page.emptyTitle}>Nenhuma filial cadastrada</p><p className={page.emptyText}>Crie a primeira unidade para organizar a equipe e o recebimento de leads.</p></div>
        ) : visible.length === 0 ? (
          <div className={page.empty}><p className={page.emptyTitle}>Nenhuma unidade encontrada</p><p className={page.emptyText}>Ajuste a busca, troque de aba ou cadastre uma nova unidade.</p></div>
        ) : (
          <LiteResponsiveData caption="Unidades" columns={columns} rows={visible} rowKey={(branch) => branch.id}
            onRowOpen={(branch) => router.push(`/unidades/${branch.id}`)} empty={<p>Nenhuma unidade nesta aba ou busca.</p>} />
        )}
        {branches.length > 0 ? (
          <ul className={styles.legend}>
            <li><span className={page.cellTitle}>Recebe leads</span>: leads de webhooks e manuais vão para a filial.</li>
            <li><span className={page.cellTitle}>Distribuição automática</span>: atribui aos corretores disponíveis sem intervenção.</li>
            <li><span className={page.cellTitle}>Central</span>: filial que recebe os leads redistribuídos.</li>
          </ul>
        ) : null}
      </section>

      <LiteSidePanel open={creating} onOpenChange={setCreating} title="Cadastrar filial" description="Adicione uma unidade da corretora para organizar a equipe.">
        {creating ? <BranchForm onDone={() => setCreating(false)} /> : null}
      </LiteSidePanel>
      <LiteSidePanel open={editing !== null} onOpenChange={(open) => { if (!open) setEditing(null); }} title="Editar unidade" description="Atualize o nome e o identificador desta unidade.">
        {editing ? <BranchForm key={editing.id} branch={editing} onDone={() => setEditing(null)} /> : null}
      </LiteSidePanel>
    </>
  );
}
