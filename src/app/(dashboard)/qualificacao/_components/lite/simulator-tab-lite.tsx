"use client";

/**
 * Aba "Simulador" do hub de qualificação no visual Lite: alertas operacionais (resolver com a mesma ação) e o
 * simulador com bolhas de conversa e o inspetor da memória extraída. A conversa e a memória vêm do hub.
 */
import type { FormEvent } from "react";
import { Send } from "lucide-react";

import form from "@/components/lite/page/lite-form.module.css";
import page from "@/components/lite/page/lite-page.module.css";
import sections from "@/components/lite/page/lite-sections.module.css";
import type { QualificationAlertRecord } from "@/features/ai-qualification/alerts-service";

import type { SimMemory } from "../simulator-memory";
import styles from "./qualification-lite.module.css";

const MEMORY_FIELDS: Array<[keyof SimMemory, string]> = [["nome", "Nome"], ["plano", "Plano"], ["vidas", "Vidas"], ["idade", "Idade"], ["cidade", "Cidade"], ["email", "E-mail"]];
const LEVEL_LABEL: Record<string, string> = { critical: "Crítico", warning: "Atenção", info: "Informação" };

export function SimulatorTabLite({ alerts, onAcknowledge, messages, input, onInput, onSend, loading, memory }: {
  alerts: QualificationAlertRecord[];
  onAcknowledge: (id: string) => void;
  messages: Array<{ sender: "user" | "bot"; text: string }>;
  input: string;
  onInput: (value: string) => void;
  onSend: (event: FormEvent) => void;
  loading: boolean;
  memory: SimMemory;
}) {
  const active = alerts.filter((alert) => alert.status === "active").length;
  return (
    <>
      {alerts.length ? (
        <section className={sections.group} aria-labelledby="alerts-title">
          <div className={sections.row}>
            <div className={sections.rowText}>
              <h2 id="alerts-title" className={sections.rowTitle}>Alertas operacionais ({active} ativos)</h2>
              <p className={sections.rowDescription}>Filas sem corretor, desconexões e problemas de operação.</p>
            </div>
          </div>
          <ul className={sections.list}>
            {alerts.map((alert) => (
              <li key={alert.id} className={sections.item} style={alert.status === "active" ? undefined : { opacity: 0.7 }}>
                <span className={sections.rowText}>
                  <span className={sections.badges} style={{ alignItems: "center" }}>
                    <span className={page.badge} data-tone={alert.level === "critical" ? "danger" : "warning"}>{LEVEL_LABEL[alert.level] ?? alert.level}</span>
                    <span className={sections.rowTitle}>{alert.alertType}</span>
                  </span>
                  <span className={sections.rowDescription}>{alert.message}</span>
                  {alert.suggestedAction ? <span className={sections.itemSub}>Ação recomendada: {alert.suggestedAction}</span> : null}
                </span>
                {alert.status === "active" ? <button type="button" className={page.button} onClick={() => onAcknowledge(alert.id)}>Resolver alerta</button> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <div className={`${styles.columns} ${styles.sim}`}>
        <section className={sections.group} aria-labelledby="simulator-title">
          <div className={sections.row}>
            <div className={sections.rowText}>
              <h2 id="simulator-title" className={sections.rowTitle}>Simulador de qualificação</h2>
              <p className={sections.rowDescription}>Teste o comportamento da IA com a memória sendo preenchida em tempo real. Nada é enviado ao cliente.</p>
            </div>
          </div>
          <div className={styles.chat}>
            <div className={styles.thread} aria-live="polite">
              {messages.map((message, index) => (
                <p key={index} className={styles.bubble} data-from={message.sender} style={{ margin: 0 }}>{message.text}</p>
              ))}
            </div>
            <form onSubmit={onSend} className={styles.composer}>
              <input className={form.input} aria-label="Resposta do cliente" value={input} onChange={(event) => onInput(event.target.value)} placeholder="Digite a resposta do cliente" />
              <button type="submit" className={page.iconButton} disabled={loading} aria-label="Enviar resposta do cliente">
                <Send aria-hidden="true" size={18} />
              </button>
            </form>
          </div>
        </section>
        <section className={sections.group} aria-labelledby="memory-title">
          <div className={sections.row}>
            <h2 id="memory-title" className={sections.rowTitle}>Memória extraída</h2>
          </div>
          <dl className={styles.kv}>
            {MEMORY_FIELDS.map(([key, label]) => (
              <div key={key}><dt>{label}</dt><dd>{memory[key] ?? "Não informado"}</dd></div>
            ))}
          </dl>
        </section>
      </div>
    </>
  );
}
