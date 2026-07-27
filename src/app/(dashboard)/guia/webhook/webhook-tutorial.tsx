"use client";

import { useState } from "react";
import { Check, Copy, ArrowRight } from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";

const steps = [
  {
    number: "01",
    title: "Criar fonte de captura",
    description: "Acesse Configurações > Integrações e clique em Nova fonte.",
    details: [
      "Escolha um nome descritivo (ex: Landing Page - Saúde)",
      "Selecione a origem padrão: Landing page",
      "Selecione a filial de destino (opcional)",
      "Clique em Gerar token",
    ],
  },
  {
    number: "02",
    title: "Copiar o token",
    description: "O token completo é exibido apenas uma vez. Copie e guarde em local seguro.",
    details: [
      "O token começa com crt_live_",
      "Nunca compartilhe publicamente",
      "Se perder, gere um novo em Configurações",
    ],
  },
  {
    number: "03",
    title: "Adicionar snippet no site",
    description: "Cole o script antes do código do formulário no seu HTML.",
    details: [
      "Substitua SEU_TENANT_ID pelo ID da sua corretora",
      "Substitua crt_live_SEU_TOKEN pelo token copiado",
      "O snippet deve vir ANTES do script do formulário",
    ],
  },
  {
    number: "04",
    title: "Configurar envio do formulário",
    description: "No submit, monte o payload com os campos obrigatórios.",
    details: [
      "name (obrigatório) — Nome completo do lead",
      "phone (obrigatório) — Telefone com DDD",
      "source (obrigatório) — Origem (ex: landing-page)",
      "email, planInterest, metadata — Opcionais",
    ],
  },
  {
    number: "05",
    title: "Tratar a resposta",
    description: "Verifique se a requisição foi bem-sucedida e trate os erros.",
    details: [
      "201 — Lead criado com sucesso",
      "200 — Replay idempotente (mesmo payload)",
      "422 — Dados inválidos (veja issues)",
      "401 — Token inválido",
    ],
  },
];

const requiredFields = [
  { field: "name", type: "string", description: "Nome completo do lead (2-160 caracteres)", example: '"Maria da Silva"' },
  { field: "phone", type: "string", description: "Telefone com DDD (mín. 10 dígitos)", example: '"+5521999999999"' },
  { field: "source", type: "string", description: "Origem do lead (1-100 caracteres)", example: '"landing-page"' },
];

const optionalFields = [
  { field: "email", type: "string", description: "E-mail do lead", example: '"maria@email.com"' },
  { field: "planInterest", type: "string", description: "Plano de interesse (máx. 160)", example: '"Plano Empresarial"' },
  { field: "externalId", type: "string", description: "ID no seu sistema (máx. 191)", example: '"lead-123"' },
  { field: "branchExternalId", type: "string", description: "ID da filial de destino", example: '"filial-centro"' },
  { field: "metadata", type: "object", description: "Dados complementares (máx. 20 chaves)", example: '{ "utm_source": "google" }' },
];

const responseCodes = [
  { code: 201, label: "Lead criado", description: "Lead criado com sucesso no sistema" },
  { code: 200, label: "Replay", description: "Mesmo payload enviado anteriormente (idempotente)" },
  { code: 400, label: "JSON inválido", description: "O corpo da requisição não é JSON válido" },
  { code: 401, label: "Não autorizado", description: "Token inválido ou ausente" },
  { code: 409, label: "Conflito", description: "Chave de idempotência usada com payload diferente" },
  { code: 413, label: "Payload grande", description: "Corpo excede 32 KB" },
  { code: 415, label: "Content-Type", description: "Header Content-Type deve ser application/json" },
  { code: 422, label: "Dados inválidos", description: "Payload não passa na validação (veja issues)" },
  { code: 429, label: "Rate limit", description: "Limite de requisições excedido" },
  { code: 500, label: "Erro interno", description: "Erro inesperado no servidor" },
];

function CodeBlock({ code, filename }: { code: string; filename?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="relative rounded-xl border border-border bg-muted/40">
      {filename && (
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <span className="text-xs font-medium text-muted-foreground">{filename}</span>
          <Button onClick={handleCopy} size="sm" variant="ghost" className="h-7 gap-1.5 px-2 text-xs">
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? "Copiado" : "Copiar"}
          </Button>
        </div>
      )}
      {!filename && (
        <button
          onClick={handleCopy}
          className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors"
          title="Copiar código"
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </button>
      )}
      <pre className="overflow-x-auto p-4 text-[12px] leading-6 text-foreground">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function WebhookTutorial() {
  return (
    <main className="mx-auto min-h-full w-full max-w-4xl bg-background p-4 lg:p-6">
      {/* Header */}
      <section className="mb-8">
        <Badge variant="outline" className="mb-3 gap-1.5 border-primary/20 bg-primary/[0.05] text-primary">
          Guia CorreTop
        </Badge>
        <h1 className="text-3xl font-semibold tracking-tight">Integração via Webhook</h1>
        <p className="mt-2 max-w-2xl text-base leading-7 text-muted-foreground">
          Envie leads automaticamente do seu site ou landing page para o CorreTop usando nossa API REST.
        </p>
      </section>

      {/* Quick Start */}
      <Card className="mb-8 border-primary/20 bg-primary/[0.03]">
        <CardHeader>
          <CardTitle className="text-base">Início rápido</CardTitle>
          <CardDescription>Cole este snippet no seu site e comece a enviar leads em 2 minutos.</CardDescription>
        </CardHeader>
        <CardContent>
          <CodeBlock
            filename="index.html"
            code={`<!-- 1. Snippet de Inicialização (antes do </body>) -->
<script>
  window.CORRETOP_HUB_URL = "https://corretop.vercel.app/api/webhooks/leads";
  window.CORRETOP_HUB_TOKEN = "crt_live_SEU_TOKEN";
</script>

<!-- 2. Formulário -->
<form id="lead-form">
  <input name="name" placeholder="Nome completo" required />
  <input name="phone" placeholder="Telefone com DDD" required />
  <input name="email" type="email" placeholder="E-mail (opcional)" />
  <button type="submit">Enviar</button>
</form>

<!-- 3. Script de envio -->
<script>
  document.getElementById("lead-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);

    const response = await fetch(window.CORRETOP_HUB_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + window.CORRETOP_HUB_TOKEN,
        "Idempotency-Key": "lead-" + Date.now()
      },
      body: JSON.stringify({
        name: fd.get("name"),
        phone: fd.get("phone"),
        email: fd.get("email") || undefined,
        source: "landing-page"
      })
    });

    const result = await response.json();
    if (result.success) {
      console.log("Lead criado:", result.data.leadId);
    } else {
      console.error("Erro:", result.error);
    }
  });
</script>`}
          />
        </CardContent>
      </Card>

      {/* Steps */}
      <section className="mb-8">
        <h2 className="mb-4 text-xl font-semibold">Passo a passo</h2>
        <div className="space-y-4">
          {steps.map((step) => (
            <Card key={step.number} className="border-border">
              <CardContent className="flex gap-4 p-5">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-primary/15 bg-primary/[0.07] font-mono text-sm font-semibold text-primary">
                  {step.number}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold">{step.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
                  <ul className="mt-3 space-y-1.5">
                    {step.details.map((detail, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <ArrowRight className="mt-1 size-3 shrink-0 text-primary" />
                        {detail}
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Separator className="my-8" />

      {/* Fields Reference */}
      <section className="mb-8">
        <h2 className="mb-4 text-xl font-semibold">Referência de campos</h2>

        <Card className="mb-4 border-border">
          <CardHeader>
            <CardTitle className="text-base">Campos obrigatórios</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {requiredFields.map((f) => (
                <div key={f.field} className="grid grid-cols-[120px_1fr_140px] gap-4 px-5 py-3 text-sm">
                  <code className="font-medium text-foreground">{f.field}</code>
                  <span className="text-muted-foreground">{f.description}</span>
                  <code className="text-right text-xs text-muted-foreground">{f.example}</code>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base">Campos opcionais</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {optionalFields.map((f) => (
                <div key={f.field} className="grid grid-cols-[120px_1fr_140px] gap-4 px-5 py-3 text-sm">
                  <code className="font-medium text-foreground">{f.field}</code>
                  <span className="text-muted-foreground">{f.description}</span>
                  <code className="text-right text-xs text-muted-foreground">{f.example}</code>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <Separator className="my-8" />

      {/* Response Codes */}
      <section className="mb-8">
        <h2 className="mb-4 text-xl font-semibold">Códigos de resposta</h2>
        <Card className="border-border">
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {responseCodes.map((r) => (
                <div key={r.code} className="flex items-center gap-4 px-5 py-3 text-sm">
                  <Badge
                    variant="outline"
                    className={`w-12 shrink-0 justify-center font-mono ${
                      r.code < 300 ? "border-success/20 bg-success/10 text-success" :
                      r.code < 500 ? "border-warning/20 bg-warning/10 text-warning" :
                      "border-destructive/20 bg-destructive/10 text-destructive"
                    }`}
                  >
                    {r.code}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <span className="font-medium">{r.label}</span>
                    <span className="ml-2 text-muted-foreground">— {r.description}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <Separator className="my-8" />

      {/* Payload Example */}
      <section className="mb-8">
        <h2 className="mb-4 text-xl font-semibold">Exemplo completo de payload</h2>
        <CodeBlock
          filename="payload.json"
          code={`{
  "name": "Maria da Silva",
  "phone": "+5521999999999",
  "email": "maria.silva@example.com",
  "source": "landing-page",
  "planInterest": "Plano Empresarial Premium",
  "externalId": "src-lead-123",
  "branchExternalId": "matriz-01",
  "metadata": {
    "campaign": "saude-empresarial",
    "utm_source": "google",
    "utm_medium": "cpc"
  }
}`}
        />
      </section>

      <Separator className="my-8" />

      {/* Example with curl */}
      <section className="mb-8">
        <h2 className="mb-4 text-xl font-semibold">Teste com curl</h2>
        <CodeBlock
          filename="terminal"
          code={`curl --request POST \\
  --url "https://corretop.vercel.app/api/webhooks/leads" \\
  --header "Authorization: Bearer crt_live_SEU_TOKEN" \\
  --header "Content-Type: application/json" \\
  --header "Idempotency-Key: meu-lead-001" \\
  --data '{
    "name": "João Exemplo",
    "phone": "+5521999999999",
    "email": "joao@email.com",
    "source": "landing-page",
    "planInterest": "Plano familiar"
  }'`}
        />
      </section>

      {/* Back to guide */}
      <div className="flex justify-center pb-8">
        <Button render={<Link href="/guia" />} variant="outline">
          <ArrowRight className="rotate-180" /> Voltar ao guia
        </Button>
      </div>
    </main>
  );
}
