"use client";

/**
 * /guia/webhook no visual Lite (Onda 8): o mesmo conteúdo (passos, campos, códigos de resposta e exemplos) numa
 * coluna de leitura. Blocos de código rolam dentro de si; copiar mostra "Copiado" no próprio botão.
 */
import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Check, Copy } from "lucide-react";

import page from "@/components/lite/page/lite-page.module.css";
import { CURL_CODE, optionalFields, PAYLOAD_CODE, QUICK_START_CODE, requiredFields, responseCodes, steps } from "./webhook-tutorial";
import styles from "./webhook-tutorial-lite.module.css";

/** Os textos de apoio usam travessão; no Lite ele vira dois-pontos. */
const plain = (text: string) => text.replace(/ — /g, ": ");

function CodeBlockLite({ code, filename }: { code: string; filename: string }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div className={styles.code}>
      <div className={styles.codeHead}>
        <span className={page.cellSub}>{filename}</span>
        <button type="button" className={styles.copy} onClick={() => void handleCopy()} aria-label={`Copiar ${filename}`}>
          {copied ? <Check aria-hidden="true" size={16} /> : <Copy aria-hidden="true" size={16} />}
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
      <pre className={styles.pre}><code>{code}</code></pre>
    </div>
  );
}

function FieldList({ title, fields }: { title: string; fields: typeof requiredFields }) {
  return (
    <section className={page.card} aria-label={title}>
      <h3 className={styles.subTitle}>{title}</h3>
      <dl className={styles.fields}>
        {fields.map((field) => (
          <div key={field.field} className={styles.field}>
            <dt><code>{field.field}</code></dt>
            <dd>
              <span>{field.description}</span>
              <code className={page.cellSub}>{field.example}</code>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function WebhookTutorialLite() {
  return (
    <div className={styles.column}>
      <section className={page.cardHead} aria-label="Integração via webhook">
        <p className={styles.lead}>Envie leads automaticamente do seu site ou landing page para a plataforma usando nossa API REST.</p>
      </section>

      <section className={page.card} aria-labelledby="webhook-quick-title">
        <div className={page.cardHead}>
          <h2 id="webhook-quick-title" className={page.cardTitle}>Início rápido</h2>
          <p className={page.cardDescription}>Cole este snippet no seu site e comece a enviar leads em 2 minutos.</p>
        </div>
        <CodeBlockLite filename="index.html" code={QUICK_START_CODE} />
      </section>

      <section className={page.group} aria-labelledby="webhook-steps-title">
        <h2 id="webhook-steps-title" className={page.cardTitle}>Passo a passo</h2>
        <ol className={styles.steps}>
          {steps.map((step, index) => (
            <li key={step.number} className={page.card}>
              <div className={styles.stepHead}>
                <span className={styles.stepNumber} aria-hidden="true">{index + 1}</span>
                <div className={page.cardHead}>
                  <h3 className={styles.subTitle}>{step.title}</h3>
                  <p className={page.cardDescription}>{step.description}</p>
                </div>
              </div>
              <ul className={styles.details}>
                {step.details.map((detail) => <li key={detail}>{plain(detail)}</li>)}
              </ul>
            </li>
          ))}
        </ol>
      </section>

      <section className={page.group} aria-labelledby="webhook-fields-title">
        <h2 id="webhook-fields-title" className={page.cardTitle}>Referência de campos</h2>
        <FieldList title="Campos obrigatórios" fields={requiredFields} />
        <FieldList title="Campos opcionais" fields={optionalFields} />
      </section>

      <section className={page.card} aria-labelledby="webhook-codes-title">
        <h2 id="webhook-codes-title" className={page.cardTitle}>Códigos de resposta</h2>
        <ul className={styles.codes}>
          {responseCodes.map((response) => (
            <li key={response.code} className={styles.codeRow}>
              <span className={page.badge} data-tone={response.code < 300 ? "success" : response.code < 500 ? "warning" : "danger"}>{response.code}</span>
              <span><span className={page.cellTitle}>{response.label}</span><span className={page.muted}>: {response.description}</span></span>
            </li>
          ))}
        </ul>
      </section>

      <section className={page.group} aria-labelledby="webhook-payload-title">
        <h2 id="webhook-payload-title" className={page.cardTitle}>Exemplo completo de payload</h2>
        <CodeBlockLite filename="payload.json" code={PAYLOAD_CODE} />
      </section>

      <section className={page.group} aria-labelledby="webhook-curl-title">
        <h2 id="webhook-curl-title" className={page.cardTitle}>Teste com curl</h2>
        <CodeBlockLite filename="terminal" code={CURL_CODE} />
      </section>

      <div>
        <Link href="/guia" className={page.button}><ArrowLeft aria-hidden="true" size={16} /> Voltar ao guia</Link>
      </div>
    </div>
  );
}
