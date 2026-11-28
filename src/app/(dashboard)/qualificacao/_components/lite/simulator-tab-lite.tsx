"use client";

/**
 * Aba "Simulador" do hub de qualificação no visual Lite: o simulador com bolhas de conversa e o inspetor da memória
 * extraída. A conversa e a memória vêm do hub. Os alertas moraram aqui até 25/11/2026; agora têm tela própria
 * (/ia/alertas) e aqui fica só o link.
 */
import type { FormEvent } from "react";
import { Send } from "lucide-react";
import Link from "next/link";

import form from "@/components/lite/page/lite-form.module.css";
import page from "@/components/lite/page/lite-page.module.css";
import sections from "@/components/lite/page/lite-sections.module.css";

import type { SimMemory } from "../simulator-memory";
import styles from "./qualification-lite.module.css";
import { LiteHint } from "@/components/lite/page/lite-hint";

const MEMORY_FIELDS: Array<[keyof SimMemory, string]> = [["nome", "Nome"], ["plano", "Plano"], ["vidas", "Vidas"], ["idade", "Idade"], ["cidade", "Cidade"], ["email", "E-mail"]];

export function SimulatorTabLite({ activeAlerts, messages, input, onInput, onSend, loading, memory }: {
  /** Alertas abertos, só para o texto do link. */
  activeAlerts: number;
  messages: Array<{ sender: "user" | "bot"; text: string }>;
  input: string;
  onInput: (value: string) => void;
  onSend: (event: FormEvent) => void;
  loading: boolean;
  memory: SimMemory;
}) {
  return (
    <>
      <Link href="/ia/alertas" className={sections.link}>
        Ver alertas{activeAlerts > 0 ? ` (${activeAlerts.toLocaleString("pt-BR")} ${activeAlerts === 1 ? "aberto" : "abertos"})` : ""}
      </Link>
      <div className={`${styles.columns} ${styles.sim}`}>
        <section className={sections.group} aria-labelledby="simulator-title">
          <div className={sections.row}>
            <div className={sections.rowText}>
              <h2 id="simulator-title" className={sections.rowTitle}>Simulador de qualificação<LiteHint text="Teste o comportamento da IA com a memória sendo preenchida em tempo real. Nada é enviado ao cliente." /></h2>
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
