"use client";

/**
 * Regras de comissão e pós-venda no visual Lite. Mesmas Server Actions (criar, editar, ativar ou desativar, excluir,
 * pós-venda), os mesmos campos do formulário (inclusive o JSON de percentuais) e as mesmas mensagens. As regras viram
 * tabela (cartões no celular), o formulário abre no painel lateral e excluir pede confirmação Lite.
 */
import { useActionState, useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Trash2 } from "lucide-react";

import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { LiteConfirmDialog, LiteMenu, LiteSelect } from "@/components/lite/controls";
import { LiteResponsiveData, type LiteColumn } from "@/components/lite/data/data";
import { LiteSidePanel } from "@/components/lite/data/side-panel";
import form from "@/components/lite/page/lite-form.module.css";
import page from "@/components/lite/page/lite-page.module.css";
import sections from "@/components/lite/page/lite-sections.module.css";
import { toast } from "@/components/ui/sonner";
import { createCommissionRuleAction, deleteCommissionRuleAction, toggleCommissionRuleAction, updateCommissionRuleAction } from "@/features/commissions/actions";
import type { CommissionRuleRecord } from "@/features/commissions/queries";
import type { CommissionActionState } from "@/features/commissions/schema";
import { updatePostSaleSettingsAction } from "@/features/post-sale/actions";

import styles from "./commission-rules-lite.module.css";

type Carrier = { id: string; name: string };
type StatusFilter = "all" | "active" | "inactive";

const STATUS_OPTIONS = [{ value: "all", label: "Todas" }, { value: "active", label: "Ativas" }, { value: "inactive", label: "Inativas" }];

function formatPercentage(percent: number): string {
  return `${percent.toFixed(percent % 1 === 0 ? 0 : 1)}%`;
}

function normalize(text: string) {
  return text.trim().normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR");
}

function RuleForm({ rule, carriers, onDone }: { rule: CommissionRuleRecord | null; carriers: Carrier[]; onDone: () => void }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<CommissionActionState, FormData>(rule ? updateCommissionRuleAction : createCommissionRuleAction, {});
  const [ruleType, setRuleType] = useState<"unica" | "escalonada">(rule?.type ?? "escalonada");
  const [months, setMonths] = useState<number[]>(() => (rule?.percentages?.length ? [...rule.percentages] : [100, 25, 5]));
  const [appliesToAll, setAppliesToAll] = useState(rule?.appliesToAll ?? false);
  const [carrier, setCarrier] = useState(rule?.carrierId ?? "");
  const [plan, setPlan] = useState(rule?.planId ?? "");

  useEffect(() => {
    if (state.success) {
      toast.success("Regra de comissão salva.");
      router.refresh();
      onDone();
    }
    if (state.error) toast.error(state.error);
  }, [state, router, onDone]);

  const changeType = (value: string) => {
    const next = value as "unica" | "escalonada";
    setRuleType(next);
    if (next === "unica" && months.length > 1) setMonths([months[0]!]);
  };
  const total = months.reduce((sum, value) => sum + value, 0);
  const valid = months.every((value) => value > 0);
  const planOptions = [{ value: "", label: "Todos os planos" }, ...(carrier ? [{ value: "__all__", label: "Todos os planos desta operadora" }] : [])];

  return (
    <form action={formAction} className={form.form}>
      {rule ? <input type="hidden" name="ruleId" value={rule.id} /> : null}
      <input type="hidden" name="percentages" value={JSON.stringify(months)} />
      <input type="hidden" name="type" value={ruleType} />
      <label className={form.field}>
        <span className={form.label}>Nome da regra</span>
        <input className={form.input} name="name" defaultValue={rule?.name ?? ""} placeholder="Ex.: comissão padrão individual" required />
      </label>
      <fieldset className={styles.fieldset}>
        <legend className={form.label}>Aplicar a</legend>
        <label className={form.check} style={{ paddingLeft: 0 }}>
          <input type="checkbox" name="appliesToAll" checked={appliesToAll} onChange={(event) => setAppliesToAll(event.target.checked)} />
          <span>Todos os planos e operadoras (regra geral, usada quando não houver regra específica)</span>
        </label>
        {!appliesToAll ? (
          <div className={form.row}>
            <LiteSelect label="Operadora" value={carrier} placeholder="Selecione uma operadora" options={carriers.map((item) => ({ value: item.id, label: item.name }))} onChange={(value) => { setCarrier(value); setPlan(""); }} />
            <LiteSelect label="Plano" value={plan} options={planOptions} onChange={setPlan} />
            <input type="hidden" name="carrierId" value={carrier} />
            <input type="hidden" name="planId" value={plan} />
          </div>
        ) : null}
        {!appliesToAll ? <p className={form.hint}>{plan && plan !== "__all__" ? "Regra específica para este plano." : carrier ? "Regra para todos os planos da operadora." : "Defina a operadora primeiro."}</p> : null}
      </fieldset>
      <fieldset className={styles.fieldset}>
        <legend className={form.label}>Tipo de comissão</legend>
        <SegmentedControl label="Tipo de comissão" value={ruleType} onValueChange={changeType} options={[{ value: "unica", label: "Única" }, { value: "escalonada", label: "Escalonada" }]} />
        <ol className={styles.months}>
          {months.map((value, index) => (
            <li key={index} className={styles.month}>
              <label className={styles.monthLabel} htmlFor={`commission-month-${index}`}>{index + 1}º mês</label>
              <span className={styles.percent}>
                <input
                  id={`commission-month-${index}`}
                  className={form.input}
                  type="number"
                  min="0"
                  max="1000"
                  step="0.1"
                  value={value || ""}
                  placeholder="0"
                  onChange={(event) => setMonths((current) => current.map((item, position) => (position === index ? Math.max(0, Math.min(1000, parseFloat(event.target.value) || 0)) : item)))}
                />
                <span aria-hidden="true">%</span>
              </span>
              {months.length > 1 ? (
                <button type="button" className={page.iconButton} aria-label={`Remover ${index + 1}º mês`} onClick={() => setMonths((current) => current.filter((_, position) => position !== index))}>
                  <Trash2 aria-hidden="true" size={18} />
                </button>
              ) : null}
            </li>
          ))}
        </ol>
        {ruleType === "escalonada" && months.length < 60 ? (
          <div>
            <button type="button" className={page.button} onClick={() => setMonths((current) => [...current, 0])}>
              <Plus aria-hidden="true" size={16} />
              Adicionar mês
            </button>
          </div>
        ) : null}
        <p className={form.hint}>
          {months.map((value, index) => `M${index + 1}: ${formatPercentage(value)}`).join(" · ")}
          {ruleType === "escalonada" && months.length > 1 ? ` · Total: ${formatPercentage(total)}` : ""}
        </p>
        {!valid ? <p className={sections.error} role="alert">Todos os percentuais devem ser maiores que zero.</p> : null}
      </fieldset>
      <div className={form.actions}>
        <button type="button" className={page.button} onClick={onDone}>Cancelar</button>
        <button type="submit" className={page.primaryButton} disabled={pending || !valid}>{pending ? "Salvando..." : rule ? "Salvar alterações" : "Criar regra de comissão"}</button>
      </div>
    </form>
  );
}

export function CommissionRulesLite({ rules, carriers }: { rules: CommissionRuleRecord[]; carriers: Carrier[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [panel, setPanel] = useState<{ rule: CommissionRuleRecord | null } | null>(null);
  const [removing, setRemoving] = useState<CommissionRuleRecord | null>(null);
  const [pending, startTransition] = useTransition();
  const closePanel = useCallback(() => setPanel(null), []);
  const cancelRemove = useCallback(() => setRemoving(null), []);

  const visible = useMemo(() => {
    const query = normalize(search);
    return rules.filter((rule) => {
      const matches = !query || rule.name.toLocaleLowerCase("pt-BR").includes(query) || (rule.carrierName ?? "").toLocaleLowerCase("pt-BR").includes(query);
      const byStatus = status === "all" || (status === "active" && rule.active) || (status === "inactive" && !rule.active);
      return matches && byStatus;
    });
  }, [rules, search, status]);

  const run = (action: typeof toggleCommissionRuleAction, rule: CommissionRuleRecord) => startTransition(async () => {
    const formData = new FormData();
    formData.set("ruleId", rule.id);
    const result = await action({}, formData);
    if (result.success) {
      toast.success("Regra de comissão salva.");
      router.refresh();
    }
    if (result.error) toast.error(result.error);
  });

  const columns: LiteColumn<CommissionRuleRecord>[] = [
    { id: "name", label: "Regra", primary: true, render: (rule) => <span className={page.cellTitle}>{rule.name}</span> },
    { id: "carrier", label: "Operadora", secondary: true, render: (rule) => rule.carrierName ?? (rule.appliesToAll ? "Todas" : "Não definida") },
    { id: "plan", label: "Plano", render: (rule) => rule.planName ?? (rule.appliesToAll ? "Todos" : rule.carrierId ? "Todos da operadora" : "Não definido") },
    { id: "type", label: "Tipo", nowrap: true, render: (rule) => (rule.type === "unica" ? "Única" : "Escalonada") },
    { id: "months", label: "Parcelas", render: (rule) => <span className={page.numeric}>{(Array.isArray(rule.percentages) ? rule.percentages : [100]).map((value, index) => `M${index + 1} ${formatPercentage(value)}`).join(" · ")}</span> },
    { id: "status", label: "Status", nowrap: true, render: (rule) => <span className={page.badge} data-tone={rule.active ? "success" : undefined}>{rule.active ? "Ativa" : "Inativa"}</span> },
    {
      id: "actions",
      label: "Ações",
      render: (rule) => (
        <LiteMenu
          label={`Ações da regra ${rule.name}`}
          items={[
            { id: "toggle", label: rule.active ? "Desativar" : "Ativar", onSelect: () => run(toggleCommissionRuleAction, rule) },
            { id: "edit", label: "Editar", onSelect: () => setPanel({ rule }) },
            { id: "delete", label: "Excluir", onSelect: () => setRemoving(rule) },
          ]}
        />
      ),
    },
  ];

  return (
    <>
      <div className={page.stats}>
        {[
          { label: "Regras cadastradas", value: rules.length },
          { label: "Regras ativas", value: rules.filter((rule) => rule.active).length },
          { label: "Operadoras com regra", value: new Set(rules.filter((rule) => rule.carrierId).map((rule) => rule.carrierId)).size },
        ].map((item) => (
          <div key={item.label} className={page.stat}>
            <span className={page.statLabel}>{item.label}</span>
            <span className={page.statValue}>{item.value}</span>
          </div>
        ))}
      </div>
      <section className={page.group} aria-labelledby="commission-rules-title" aria-busy={pending}>
        <header className={page.cardHead}>
          <h2 id="commission-rules-title" className={page.cardTitle}>Regras de comissão</h2>
          <p className={page.cardDescription}>Como os corretores são comissionados por operadora e plano. As regras ativas valem ao converter um lead em venda.</p>
        </header>
        <div className={page.toolbar}>
          <label className={page.search}>
            <Search aria-hidden="true" size={18} className={page.searchIcon} />
            <input className={page.searchInput} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome ou operadora" aria-label="Buscar regra de comissão" />
          </label>
          <div className={page.selectNarrow}>
            <LiteSelect label="Status" hideLabel value={status} options={STATUS_OPTIONS} onChange={(value) => setStatus(value as StatusFilter)} />
          </div>
          <button type="button" className={`${page.primaryButton} ${page.toolbarEnd}`} onClick={() => setPanel({ rule: null })}>
            <Plus aria-hidden="true" size={16} />
            Nova regra
          </button>
        </div>
        <LiteResponsiveData
          caption="Regras de comissão"
          columns={columns}
          rows={visible}
          rowKey={(rule) => rule.id}
          onRowOpen={(rule) => setPanel({ rule })}
          empty={rules.length === 0 ? (
            <div className={page.cardHead}>
              <p className={page.emptyTitle}>Nenhuma regra de comissão</p>
              <p className={page.emptyText}>Crie a primeira regra para definir como as vendas serão repassadas aos corretores.</p>
            </div>
          ) : (
            <div className={page.cardHead}>
              <p className={page.emptyTitle}>Nenhuma regra encontrada</p>
              <p className={page.emptyText}>Ajuste a busca ou o filtro para ver outros resultados.</p>
              <div><button type="button" className={page.button} onClick={() => { setSearch(""); setStatus("all"); }}>Limpar filtros</button></div>
            </div>
          )}
        />
      </section>
      <LiteSidePanel open={Boolean(panel)} onOpenChange={(open) => { if (!open) closePanel(); }} title={panel?.rule ? `Editar: ${panel.rule.name}` : "Nova regra de comissão"} description="Percentuais de repasse para as vendas realizadas.">
        {panel ? <RuleForm key={panel.rule?.id ?? "new"} rule={panel.rule} carriers={carriers} onDone={closePanel} /> : null}
      </LiteSidePanel>
      <LiteConfirmDialog
        open={Boolean(removing)}
        title="Excluir esta regra?"
        description={removing ? `"${removing.name}" deixa de valer nas próximas vendas.` : undefined}
        confirmLabel="Excluir regra"
        tone="danger"
        onCancel={cancelRemove}
        onConfirm={() => {
          const target = removing;
          setRemoving(null);
          if (target) run(deleteCommissionRuleAction, target);
        }}
      />
    </>
  );
}

export function PostSaleSettingsLite({ chargebackWindowDays, active }: { chargebackWindowDays: number; active: boolean }) {
  const [days, setDays] = useState(String(chargebackWindowDays));
  const [enabled, setEnabled] = useState(active);
  const [pending, startTransition] = useTransition();
  return (
    <section className={sections.group} aria-labelledby="post-sale-title">
      <div className={sections.row}>
        <div className={sections.rowText}>
          <h2 id="post-sale-title" className={sections.rowTitle}>Pós-venda e chargeback</h2>
          <p className={sections.rowDescription}>Controla apenas a sinalização de possíveis estornos. O sistema nunca desconta dinheiro automaticamente.</p>
        </div>
      </div>
      <div className={sections.formBody}>
        <div className={styles.postSale}>
          <label className={form.field}>
            <span className={form.label}>Janela de chargeback (dias)</span>
            <input className={form.input} type="number" min="0" max="3650" value={days} onChange={(event) => setDays(event.target.value)} />
          </label>
          <label className={form.check} style={{ paddingLeft: 0 }}>
            <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
            Ativa
          </label>
          <button
            type="button"
            className={page.button}
            disabled={pending}
            onClick={() => startTransition(async () => {
              const result = await updatePostSaleSettingsAction({ chargebackWindowDays: Number(days), active: enabled });
              if (result.error) toast.error(result.error);
              else toast.success("Configuração de pós-venda salva.");
            })}
          >
            {pending ? "Salvando..." : "Salvar configuração"}
          </button>
        </div>
      </div>
    </section>
  );
}
