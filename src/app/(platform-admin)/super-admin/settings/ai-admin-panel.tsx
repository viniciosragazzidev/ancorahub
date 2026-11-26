"use client";

/**
 * Super-admin › IA (26/11): chaves dos provedores com selo de validação e "Testar agora", a reserva de cada
 * perfil lida da cadeia do gateway e o uso do mês por empresa e tipo de uso. Visual Lite, só leitura,
 * exceto o teste. Nunca mostra a chave inteira (só os 4 últimos).
 */
import "@/components/arc/venancor-scope.css";

import { useState } from "react";

import { LiteActionButton } from "@/components/lite/controls/action-button";
import { LiteResponsiveData, type LiteColumn } from "@/components/lite/data/data";
import page from "@/components/lite/page/lite-page.module.css";
import { usageTotals, type CredentialBadge, type UsageSummaryRow } from "@/features/ai-gateway/admin-overview";
import type { AiAdminPanelData, ProfileFallbackRow, ProviderCredentialRow } from "@/features/ai-gateway/admin-panel-data";

import { testAiProviderAction } from "../ai-provider-actions";

const integer = new Intl.NumberFormat("pt-BR");
const usd = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const when = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function Badge({ badge }: { badge: CredentialBadge }) {
  return <span className={page.badge} data-tone={badge.tone}>{badge.label}</span>;
}

function CredentialsCard({ rows }: { rows: ProviderCredentialRow[] }) {
  const [state, setState] = useState<Record<string, { badge: CredentialBadge; checkedAt: string }>>({});
  const columns: LiteColumn<ProviderCredentialRow>[] = [
    {
      id: "name",
      label: "Provedor",
      primary: true,
      render: (row) => (
        <span>
          <span className={page.cellTitle}>{row.name}</span>
          <span className={page.cellSub}>
            {row.masked ? <span className="tabular-nums">{row.masked}</span> : "Sem chave"}
            {row.source ? (row.source === "env" ? " · no Coolify" : " · salva aqui") : ""}
          </span>
        </span>
      ),
    },
    {
      id: "badge",
      label: "Situação",
      phonePriority: "high",
      render: (row) => {
        const current = state[row.provider];
        const checkedAt = current?.checkedAt ?? row.checkedAt;
        return (
          <span>
            <Badge badge={current?.badge ?? row.badge} />
            {checkedAt ? <span className={page.cellSub}>Testada em <span className="tabular-nums">{when.format(new Date(checkedAt))}</span></span> : null}
          </span>
        );
      },
    },
    {
      id: "test",
      label: "Teste",
      nowrap: true,
      phonePriority: "high",
      render: (row) => row.masked ? (
        <LiteActionButton
          size="sm"
          tone="secondary"
          busyLabel="Testando…"
          doneLabel="Testado"
          keeps="A chave continua salva."
          aria-label={`Testar agora a chave ${row.name}`}
          onAction={async () => {
            const result = await testAiProviderAction(row.provider);
            if (!result.ok) return { ok: false, message: result.reason };
            setState((previous) => ({ ...previous, [row.provider]: { badge: result.badge, checkedAt: result.checkedAt } }));
            return { ok: true };
          }}
        >
          Testar agora
        </LiteActionButton>
      ) : null,
    },
  ];
  return (
    <section className={page.card} aria-labelledby="ai-credentials-title">
      <div className={page.cardHead}>
        <h3 id="ai-credentials-title" className={page.cardTitle}>Chaves dos provedores</h3>
        <p className={page.cardDescription}>O teste lista os modelos do provedor, sem gastar token. Mostramos só os 4 últimos caracteres.</p>
      </div>
      <LiteResponsiveData caption="Chaves dos provedores de IA" columns={columns} rows={rows} rowKey={(row) => row.provider} empty={<p className={page.emptyText}>Nenhum provedor.</p>} />
    </section>
  );
}

const profileColumns: LiteColumn<ProfileFallbackRow>[] = [
  {
    id: "title",
    label: "Perfil",
    primary: true,
    render: (row) => (
      <span>
        <span className={page.cellTitle}>{row.title}</span>
        <span className={page.cellSub}>{row.uses}</span>
      </span>
    ),
  },
  { id: "primary", label: "Usa", render: (row) => row.primary },
  { id: "fallback", label: "Reserva", render: (row) => <span className={page.muted}>{row.fallback}</span> },
];

function ProfilesCard({ rows }: { rows: ProfileFallbackRow[] }) {
  return (
    <section className={page.card} aria-labelledby="ai-profiles-title">
      <div className={page.cardHead}>
        <h3 id="ai-profiles-title" className={page.cardTitle}>Reserva por perfil</h3>
        <p className={page.cardDescription}>A ordem que o gateway já segue, só com provedores que têm chave. Muda pelo Coolify ou pela configuração de perfis.</p>
      </div>
      <LiteResponsiveData caption="Reserva de cada perfil de IA" columns={profileColumns} rows={rows} rowKey={(row) => row.id} empty={<p className={page.emptyText}>Nenhum perfil.</p>} />
    </section>
  );
}

const usageColumns: LiteColumn<UsageSummaryRow>[] = [
  { id: "tenant", label: "Empresa", primary: true, nowrap: true, render: (row) => row.tenantName },
  { id: "purpose", label: "Tipo de uso", secondary: true, render: (row) => row.purposeLabel },
  { id: "calls", label: "Chamadas", numeric: true, render: (row) => integer.format(row.calls) },
  { id: "tokens", label: "Tokens", numeric: true, render: (row) => integer.format(row.tokens) },
  { id: "cost", label: "Custo estimado", numeric: true, render: (row) => usd.format(row.costUsd) },
];

function UsageCard({ rows, monthLabel }: { rows: UsageSummaryRow[] | null; monthLabel: string }) {
  const totals = rows ? usageTotals(rows) : null;
  return (
    <section className={page.card} aria-labelledby="ai-usage-title">
      <div className={page.cardHead}>
        <h3 id="ai-usage-title" className={page.cardTitle}>Uso por empresa em {monthLabel}</h3>
        <p className={page.cardDescription}>
          Custo informado pelo provedor ou, no Claude, pelo preço de tabela. Modelos grátis contam zero.
          {totals ? <> Total: <span className="tabular-nums">{integer.format(totals.calls)}</span> chamadas e <span className="tabular-nums">{usd.format(totals.costUsd)}</span>.</> : null}
        </p>
      </div>
      {rows ? (
        <LiteResponsiveData
          caption={`Uso de IA por empresa e tipo de uso em ${monthLabel}`}
          columns={usageColumns}
          rows={rows}
          rowKey={(row) => row.id}
          empty={<p className={page.emptyText}>Nenhuma chamada de IA registrada neste mês. O registro vem de cada chamada feita pelo CRM.</p>}
        />
      ) : (
        <p className={page.emptyText}>Não foi possível ler o uso agora. As chaves e a reserva continuam valendo.</p>
      )}
    </section>
  );
}

export function AiAdminPanel({ data }: { data: AiAdminPanelData }) {
  return (
    <div className={`arc-venancor ${page.stack}`} aria-label="Chaves, reserva e uso da IA" role="group">
      <CredentialsCard rows={data.credentials} />
      <ProfilesCard rows={data.profiles} />
      <UsageCard rows={data.usage} monthLabel={data.monthLabel} />
    </div>
  );
}
