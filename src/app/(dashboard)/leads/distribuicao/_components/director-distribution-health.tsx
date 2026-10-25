import { Badge } from "@/components/arc/badge/badge";
import { formatLiteDate } from "@/components/lite/format/date";
import styles from "./director-distribution-health.module.css";

type Health = { pending: number; retrying: number; processing: number; failed: number; completed: number };
type EventRow = { id: string; leadName: string; brokerName: string | null; queueName: string | null; action: string; reason: string | null; createdAt: string };
type FailedEffect = { id: string; leadName: string; type: string; attemptCount: number; lastErrorCode: string | null; lastErrorMessage: string | null };

function eventActionLabel(action: string) {
  const labels: Record<string, string> = {
    "lead.assigned": "Lead atribuído",
    lead_assigned: "Lead atribuído",
    "lead.routed_to_unit": "Lead enviado à unidade",
    lead_returned_to_queue: "Lead devolvido à fila",
    "lead.assignment_recovered": "Atribuição recuperada",
    lead_offer_accepted: "Oferta aceita",
    lead_offer_expired: "Oferta expirada",
  };
  return labels[action] ?? "Atualização de distribuição";
}

function effectTypeLabel(type: string) {
  const labels: Record<string, string> = {
    assignment: "Atribuição de lead",
    notify_broker: "Aviso ao corretor",
    update_meta_status: "Atualização na Meta",
  };
  return labels[type] ?? "Ação de integração";
}

export function DirectorDistributionHealth({ events, jobs, jobsAvailable, jobsEnabled, effects, failedEffects }: {
  events: EventRow[];
  jobs: Health;
  jobsAvailable: boolean;
  jobsEnabled: boolean;
  effects: Health;
  failedEffects: FailedEffect[];
}) {
  const jobLabel = !jobsAvailable ? "Aguardando configuração" : !jobsEnabled ? "Pausada" : jobs.failed > 0 ? "Requer atenção" : "Ativa";
  const effectLabel = effects.failed > 0 ? "Requer revisão" : "Íntegro";
  return (
    <div className={styles.root}>
      <section className={styles.section} aria-labelledby="distribution-health-history">
        <div className={styles.sectionHeading}>
          <h2 id="distribution-health-history">Histórico de decisões</h2>
          <p>Atribuições, redistribuições e intervenções deste escopo.</p>
        </div>
        {events.length ? (
          <ol className={styles.events}>
            {events.map((event) => (
              <li key={event.id} className={styles.event}>
                <div className={styles.eventCopy}>
                  <p><strong>{event.leadName}</strong> <span aria-hidden="true">→</span> {event.brokerName ?? "Aguardando corretor"}</p>
                  <p>{event.queueName ?? "Inbox geral"} · {eventActionLabel(event.action)}{event.reason ? ` · ${event.reason}` : ""}</p>
                </div>
                <time dateTime={event.createdAt}>{formatLiteDate(event.createdAt, { dateStyle: "short", timeStyle: "short" })}</time>
              </li>
            ))}
          </ol>
        ) : <p className={styles.empty}>Ainda não há eventos neste escopo.</p>}
      </section>

      <div className={styles.healthGrid}>
        <section className={styles.section} aria-labelledby="distribution-health-jobs">
          <div className={styles.sectionHeading}>
            <h2 id="distribution-health-jobs">Automação da fila</h2>
            <Badge tone={!jobsAvailable || !jobsEnabled ? "neutral" : jobs.failed ? "warning" : "success"}>{jobLabel}</Badge>
          </div>
          <dl className={styles.metrics}>
            <div><dt>Aguardando</dt><dd>{jobs.pending + jobs.retrying}</dd></div>
            <div><dt>Em processamento</dt><dd>{jobs.processing}</dd></div>
            <div><dt>Exceções</dt><dd>{jobs.failed}</dd></div>
          </dl>
          <p className={styles.note}>{jobs.failed ? "Exceções para revisão da gestão." : jobs.pending + jobs.retrying ? "O motor tentará distribuir as pendências." : "Nenhuma pendência automática."}</p>
        </section>

        <section className={styles.section} aria-labelledby="distribution-health-effects">
          <div className={styles.sectionHeading}>
            <h2 id="distribution-health-effects">Efeitos de entrada</h2>
            <Badge tone={effects.failed ? "warning" : "success"}>{effectLabel}</Badge>
          </div>
          <dl className={styles.metrics}>
            <div><dt>Aguardando</dt><dd>{effects.pending + effects.retrying}</dd></div>
            <div><dt>Processando</dt><dd>{effects.processing}</dd></div>
            <div><dt>Exceções</dt><dd>{effects.failed}</dd></div>
            <div><dt>Concluídos</dt><dd>{effects.completed}</dd></div>
          </dl>
          {failedEffects.length ? (
            <ul className={styles.failures} aria-label="Efeitos que falharam">
              {failedEffects.map((effect) => <li key={effect.id}><strong>{effect.leadName} · {effectTypeLabel(effect.type)}</strong><span>{effect.lastErrorMessage ?? "A integração precisa de revisão."} · {effect.attemptCount} tentativas</span></li>)}
            </ul>
          ) : <p className={styles.note}>Nenhum efeito pendente de revisão.</p>}
        </section>
      </div>
    </div>
  );
}
