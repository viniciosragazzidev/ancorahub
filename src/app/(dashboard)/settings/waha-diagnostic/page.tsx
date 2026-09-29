"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { diagnoseWahaConnection } from "../whatsapp-actions";

type DiagnosticResult = {
  ok: boolean;
  step?: string;
  kind?: string;
  base?: string;
  error?: string;
  status?: string;
  timestamp?: string;
};

export default function WahaDiagnosticPage() {
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function runDiagnostic() {
    setLoading(true);
    setResult(null);
    try {
      const res = await diagnoseWahaConnection();
      setResult(res);
    } catch (error) {
      setResult({
        ok: false,
        step: "client_error",
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Diagnóstico WhatsApp (WAHA)</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Esta página testa a conectividade entre o CRM e o servidor WhatsApp (VPS).
      </p>

      <Button onClick={runDiagnostic} disabled={loading}>
        {loading ? "Testando..." : "Executar Diagnóstico"}
      </Button>

      {result && (
        <div className="mt-6 p-4 rounded-lg border">
          <div className="flex items-center gap-2 mb-3">
            <span
              className={`size-3 rounded-full ${result.ok ? "bg-emerald-500" : "bg-destructive"}`}
            />
            <span className="font-semibold">
              {result.ok ? "✅ Conectividade OK" : "❌ Falha na Conectividade"}
            </span>
          </div>

          <div className="space-y-2 text-sm">
            <div>
              <span className="font-medium">Etapa:</span>{" "}
              <span className="text-muted-foreground">{result.step || "N/A"}</span>
            </div>

            {result.kind && (
              <div>
                <span className="font-medium">Tipo de Erro:</span>{" "}
                <span className="text-muted-foreground">{result.kind}</span>
              </div>
            )}

            {result.base && (
              <div>
                <span className="font-medium">URL do VPS:</span>{" "}
                <span className="text-muted-foreground font-mono text-xs">{result.base}</span>
              </div>
            )}

            {result.status && (
              <div>
                <span className="font-medium">Status WAHA:</span>{" "}
                <span className="text-muted-foreground">{result.status}</span>
              </div>
            )}

            {result.timestamp && (
              <div>
                <span className="font-medium">Timestamp:</span>{" "}
                <span className="text-muted-foreground">{result.timestamp}</span>
              </div>
            )}

            {result.error && (
              <div className="mt-3 p-3 bg-destructive/10 rounded-md">
                <span className="font-medium text-destructive">Erro:</span>
                <pre className="mt-1 text-xs whitespace-pre-wrap break-all">
                  {result.error}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mt-8 p-4 bg-muted/30 rounded-lg">
        <h2 className="font-semibold mb-2">Possíveis causas do erro WAHA_UNREACHABLE:</h2>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>VPS está desligada ou com problemas de rede</li>
          <li>Certificado SSL inválido ou expirado</li>
          <li>DNS não resolve o domínio</li>
          <li>Firewall bloqueando a conexão</li>
          <li>Serviço Fastify na VPS não está rodando</li>
          <li>Timeout na conexão (rede lenta)</li>
        </ul>
      </div>
    </div>
  );
}
