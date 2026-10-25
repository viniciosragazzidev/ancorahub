"use client";

/**
 * Diagnóstico do WhatsApp (WAHA) no visual Lite: o mesmo teste (diagnoseWahaConnection) e os mesmos campos do
 * resultado, em lista de rótulo e valor, com o status em texto e cor de token.
 */
import { useState } from "react";

import { DashboardHeader } from "@/components/dashboard-header";
import page from "@/components/lite/page/lite-page.module.css";
import sections from "@/app/(dashboard)/settings/_components/lite/sections-lite.module.css";

import { diagnoseWahaConnection } from "../whatsapp-actions";

type DiagnosticResult = { ok: boolean; step?: string; kind?: string; base?: string; error?: string; status?: string; timestamp?: string };

const CAUSES = [
  "A VPS está desligada ou com problemas de rede",
  "Certificado SSL inválido ou expirado",
  "O DNS não resolve o domínio",
  "Firewall bloqueando a conexão",
  "O serviço Fastify na VPS não está rodando",
  "Tempo esgotado na conexão (rede lenta)",
];

export function WahaDiagnosticLite({ initialResult = null }: { initialResult?: DiagnosticResult | null }) {
  const [result, setResult] = useState<DiagnosticResult | null>(initialResult);
  const [loading, setLoading] = useState(false);

  async function runDiagnostic() {
    setLoading(true);
    setResult(null);
    try {
      setResult(await diagnoseWahaConnection());
    } catch (error) {
      setResult({ ok: false, step: "client_error", error: error instanceof Error ? error.message : String(error) });
    } finally {
      setLoading(false);
    }
  }

  const rows: Array<[string, string | undefined, boolean?]> = result
    ? [["Etapa", result.step || "Não informada"], ["Tipo de erro", result.kind], ["URL do VPS", result.base, true], ["Status WAHA", result.status], ["Horário", result.timestamp, true]]
    : [];

  return (
    <>
      <DashboardHeader breadcrumb="Configurações" title="Diagnóstico do WhatsApp" />
      <main className={page.stack}>
        <section className={sections.group} aria-labelledby="waha-title">
          <div className={sections.row}>
            <div className={sections.rowText}>
              <h2 id="waha-title" className={sections.rowTitle}>Conectividade com o servidor do WhatsApp</h2>
              <p className={sections.rowDescription}>Testa a conexão entre o CRM e o servidor WhatsApp (VPS).</p>
            </div>
            <button type="button" className={page.primaryButton} onClick={runDiagnostic} disabled={loading}>
              {loading ? "Testando..." : "Executar diagnóstico"}
            </button>
          </div>
          {result ? (
            <>
              <div className={sections.row} aria-live="polite">
                <p className={sections.rowTitle}>Resultado</p>
                <span className={page.badge} data-tone={result.ok ? "success" : "danger"}>{result.ok ? "Conectividade ok" : "Falha na conectividade"}</span>
              </div>
              <dl className={sections.list} style={{ margin: 0 }}>
                {rows.filter(([, value]) => value).map(([label, value, mono]) => (
                  <div key={label} className={sections.item}>
                    <dt className={sections.rowDescription}>{label}</dt>
                    <dd className={sections.value} style={mono ? { fontFamily: "var(--font-mono, ui-monospace, monospace)" } : undefined}>{value}</dd>
                  </div>
                ))}
              </dl>
              {result.error ? (
                <div className={sections.formBody}>
                  <div className={sections.notice} data-tone="danger" role="alert">
                    <p className={sections.noticeTitle} data-tone="danger">Erro</p>
                    <pre className={sections.note} style={{ margin: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{result.error}</pre>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </section>
        <section className={sections.group} aria-labelledby="waha-causes">
          <div className={sections.row}>
            <h2 id="waha-causes" className={sections.rowTitle}>Possíveis causas do erro WAHA_UNREACHABLE</h2>
          </div>
          <div className={sections.formBody}>
            <ul className={sections.steps}>
              {CAUSES.map((cause) => <li key={cause}>{cause}</li>)}
            </ul>
          </div>
        </section>
      </main>
    </>
  );
}
