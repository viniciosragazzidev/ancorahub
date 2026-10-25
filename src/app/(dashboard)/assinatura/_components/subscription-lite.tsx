/**
 * /assinatura no visual Lite (Onda 8): o mesmo plano, os mesmos limites e o mesmo cadastro da tela atual, com datas
 * em pt-BR no fuso de São Paulo. "Gerenciar plano" continua desabilitado, com o motivo ao lado.
 */
import { formatLiteDate } from "@/components/lite/format/date";
import page from "@/components/lite/page/lite-page.module.css";
import styles from "./subscription-lite.module.css";

export type SubscriptionLiteData = {
  tenant: { name: string; legalName: string | null; cnpj: string | null; status: string; createdAt: Date };
  plan: { label: string; features: string[] };
  usage: Array<{ label: string; value: number; limit: number | null }>;
};

const count = new Intl.NumberFormat("pt-BR");

function statusText(status: string) {
  return status === "active" ? "Ativo" : status === "delinquent" ? "Inadimplente" : "Inativo";
}

function statusTone(status: string) {
  return status === "active" ? "success" : status === "delinquent" ? "warning" : "danger";
}

export function SubscriptionLite({ tenant, plan, usage }: SubscriptionLiteData) {
  const since = formatLiteDate(tenant.createdAt, { dateStyle: "long" });
  const facts = [
    { label: "Nome fantasia", value: tenant.name },
    { label: "Razão social", value: tenant.legalName ?? "Não informada" },
    { label: "CNPJ", value: tenant.cnpj ?? "Não informado" },
    { label: "Plano contratado", value: plan.label },
    { label: "Status", value: statusText(tenant.status) },
    { label: "Cliente desde", value: since },
  ];

  return (
    <>
      <div className={styles.top}>
        <section className={page.card} aria-labelledby="plan-title">
          <div className={styles.headRow}>
            <div className={page.cardHead}>
              <h2 id="plan-title" className={page.cardTitle}>Plano atual</h2>
              <p className={page.cardDescription}>Sua corretora está no plano {plan.label}. Consulte o plano contratado, limites e estado atual da assinatura.</p>
            </div>
            <span className={page.badge} data-tone={statusTone(tenant.status)}>{statusText(tenant.status)}</span>
          </div>
          <div className={styles.planBlock}>
            <span className={styles.planName}>{plan.label}</span>
            <span className={page.cellSub}>Contratado desde {since}</span>
          </div>
          {plan.features.length ? (
            <div className={styles.features}>
              <h3 className={styles.subTitle}>Funcionalidades inclusas</h3>
              <ul className={styles.featureList}>
                {plan.features.map((feature) => <li key={feature}>{feature}</li>)}
              </ul>
            </div>
          ) : null}
          <div className={styles.manage}>
            <button type="button" className={page.button} disabled>Gerenciar plano</button>
            <span className={page.cellSub}>Ainda não disponível nesta tela.</span>
          </div>
        </section>

        <section className={page.card} aria-labelledby="usage-title">
          <div className={page.cardHead}>
            <h2 id="usage-title" className={page.cardTitle}>Uso e limites</h2>
            <p className={page.cardDescription}>Consumo atual dos recursos contratados</p>
          </div>
          <ul className={styles.usage}>
            {usage.map((stat) => {
              const percentage = stat.limit != null && stat.limit > 0 ? Math.round((stat.value / stat.limit) * 100) : null;
              const tone = percentage == null ? undefined : percentage >= 80 ? "danger" : percentage >= 60 ? "warning" : "success";
              return (
                <li key={stat.label} className={styles.usageRow}>
                  <span className={styles.usageLine}>
                    <span className={page.muted}>{stat.label}</span>
                    <span className={styles.usageValue}>
                      {count.format(stat.value)}{stat.limit != null ? ` / ${count.format(stat.limit)}` : ""}
                      {percentage != null ? <span className={styles.percent} data-tone={tone}> {percentage}%</span> : null}
                    </span>
                  </span>
                  {percentage != null ? (
                    <span className={styles.track} role="meter" aria-label={`${stat.label}: ${percentage}% do limite`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(percentage, 100)}>
                      <span className={styles.bar} data-tone={tone} style={{ width: `${Math.min(percentage, 100)}%` }} />
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <section className={page.card} aria-labelledby="company-title">
        <div className={page.cardHead}>
          <h2 id="company-title" className={page.cardTitle}>Dados da empresa</h2>
          <p className={page.cardDescription}>Informações cadastrais da sua corretora</p>
        </div>
        <dl className={styles.facts}>
          {facts.map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  );
}
