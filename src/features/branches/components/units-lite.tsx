"use client";

/**
 * Unidades no visual Lite (/equipe?visao=unidades): os mesmos números e as mesmas ações do BranchesManager, em
 * cartões por unidade com as três chaves (recebe leads, distribuição automática, central), editar, ativar ou
 * desativar e abrir a unidade. Criar e editar em painel lateral.
 */
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Pencil, Plus, Power, Search } from "lucide-react";

import { Switch } from "@/components/arc/switch/switch";
import { StatCard } from "@/components/dashboard/metric-card";
import { LiteSidePanel } from "@/components/lite/data/side-panel";
import form from "@/components/lite/page/lite-form.module.css";
import page from "@/components/lite/page/lite-page.module.css";
import { toast } from "@/components/ui/sonner";
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

function useBranchAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const run = (action: BranchAction, data: FormData, onDone?: () => void) => {
    startTransition(async () => {
      const result = await action({}, data);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Configuração atualizada.");
      onDone?.();
      router.refresh();
    });
  };
  return { pending, run };
}

function BranchForm({ branch, onDone }: { branch?: UnitLite; onDone: () => void }) {
  const { pending, run } = useBranchAction();
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
        <button type="submit" className={page.primaryButton} disabled={pending}>{pending ? "Salvando..." : branch ? "Salvar alterações" : "Salvar filial"}</button>
      </div>
    </form>
  );
}

function UnitSwitch({ branchId, label, enabled, action, readOnly, readOnlyText }: { branchId: string; label: string; enabled: boolean; action: BranchAction; readOnly: boolean; readOnlyText: string }) {
  const { pending, run } = useBranchAction();
  if (readOnly) {
    return (
      <span className={styles.switchRow}>
        <span>{label}</span>
        <span className={page.muted}>{readOnlyText}</span>
      </span>
    );
  }
  return (
    <span className={styles.switchRow}>
      <span>{label}</span>
      <Switch
        checked={enabled}
        disabled={pending}
        aria-label={`${label}: ${enabled ? "ligado" : "desligado"}`}
        onCheckedChange={() => {
          const data = new FormData();
          data.set("branchId", branchId);
          run(action, data);
        }}
      />
    </span>
  );
}

function StatusButton({ branch }: { branch: UnitLite }) {
  const { pending, run } = useBranchAction();
  const verb = branch.status === "active" ? "Desativar" : "Ativar";
  return (
    <button
      type="button"
      className={page.iconButton}
      disabled={pending}
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
  );
}

export function UnitsLite({ branches, canManage }: { branches: UnitLite[]; canManage: boolean }) {
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<UnitLite | null>(null);
  const needle = query.trim().toLocaleLowerCase("pt-BR");
  const visible = branches.filter((branch) => !needle || branch.name.toLocaleLowerCase("pt-BR").includes(needle) || (branch.externalId ?? "").toLocaleLowerCase("pt-BR").includes(needle));
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

        {branches.length === 0 ? (
          <div className={page.empty}><p className={page.emptyTitle}>Nenhuma filial cadastrada</p><p className={page.emptyText}>Crie a primeira unidade para organizar a equipe e o recebimento de leads.</p></div>
        ) : visible.length === 0 ? (
          <div className={page.empty}><p className={page.emptyTitle}>Nenhuma unidade encontrada</p><p className={page.emptyText}>Ajuste a busca ou cadastre uma nova unidade.</p></div>
        ) : (
          <ul className={styles.grid}>
            {visible.map((branch) => (
              <li key={branch.id} className={styles.card} data-status={branch.status}>
                <div className={styles.cardHead}>
                  <span className={styles.name}>
                    <span className={page.cellTitle}>{branch.name}</span>
                    <span className={page.cellSub}>{branch.externalId ? `Identificador ${branch.externalId}` : "Sem identificador"}</span>
                  </span>
                  <span className={page.badge} data-tone={branch.status === "active" ? "success" : undefined}>{branch.status === "active" ? "Ativa" : "Inativa"}</span>
                </div>
                <dl className={styles.metrics}>
                  <div><dt>Equipe</dt><dd>{branch.memberCount}</dd></div>
                  <div><dt>Disponíveis</dt><dd>{branch.availableBrokers}</dd></div>
                  <div><dt>Em atendimento</dt><dd>{branch.activeLeads}</dd></div>
                </dl>
                <div className={styles.switches}>
                  <UnitSwitch branchId={branch.id} label="Recebe leads" enabled={branch.acceptingLeads} action={toggleAcceptingLeadsAction} readOnly={!canManage} readOnlyText={branch.acceptingLeads ? "Sim" : "Pausado"} />
                  <UnitSwitch branchId={branch.id} label="Distribuição automática" enabled={branch.autoDistribute} action={toggleAutoDistributeAction} readOnly={!canManage} readOnlyText={branch.autoDistribute ? "Sim" : "Não"} />
                  <UnitSwitch branchId={branch.id} label="Central de redistribuição" enabled={branch.isDistributionHub} action={toggleDistributionHubAction} readOnly={!canManage} readOnlyText={branch.isDistributionHub ? "Sim" : "Não"} />
                </div>
                <div className={styles.cardFoot}>
                  {canManage ? (
                    <span className={styles.icons}>
                      <button type="button" className={page.iconButton} aria-label={`Editar ${branch.name}`} title={`Editar ${branch.name}`} onClick={() => setEditing(branch)}><Pencil aria-hidden="true" size={18} /></button>
                      <StatusButton branch={branch} />
                    </span>
                  ) : <span />}
                  <Link href={`/unidades/${branch.id}`} className={page.button} aria-label={`Ver unidade ${branch.name}`}>Ver unidade <ChevronRight aria-hidden="true" size={16} /></Link>
                </div>
              </li>
            ))}
          </ul>
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
