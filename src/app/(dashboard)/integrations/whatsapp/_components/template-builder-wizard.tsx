"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogPopup, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, ArrowRight, InfoIcon, PaperPlaneTilt, Plus } from "@/components/huge-icons";

type TemplateBuilderWizardProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export function TemplateBuilderWizard({ open, onClose, onSuccess }: TemplateBuilderWizardProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Basic
  const [name, setName] = useState("");
  const [category, setCategory] = useState<"UTILITY" | "MARKETING" | "AUTHENTICATION">("UTILITY");
  const [language, setLanguage] = useState("pt_BR");

  // Step 2: Content
  const [headerType, setHeaderType] = useState<"NONE" | "TEXT" | "IMAGE" | "DOCUMENT">("NONE");
  const [headerText, setHeaderText] = useState("");
  const [bodyText, setBodyText] = useState("Olá {{1}}, recebemos sua solicitação na {{2}}. Como podemos ajudar?");
  const [footerText, setFooterText] = useState("");
  const [buttonType, setButtonType] = useState<"NONE" | "QUICK_REPLY" | "URL">("NONE");
  const [buttonText, setButtonText] = useState("Falar com consultor");
  const [buttonUrl, setButtonUrl] = useState("https://crm.ancorasaude.cloud/onboarding/");

  // Step 3: Variables & Samples
  const [sampleVar1, setSampleVar1] = useState("Marcos");
  const [sampleVar2, setSampleVar2] = useState("Âncora Saúde");

  const formattedName = name.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");

  const handleAddVariable = () => {
    const match = bodyText.match(/\{\{(\d+)\}\}/g);
    const nextIndex = match ? match.length + 1 : 1;
    setBodyText((prev) => `${prev} {{${nextIndex}}}`);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const components: any[] = [];

      if (headerType === "TEXT" && headerText.trim()) {
        components.push({
          type: "HEADER",
          format: "TEXT",
          text: headerText.trim(),
        });
      } else if (headerType === "IMAGE" || headerType === "DOCUMENT") {
        components.push({
          type: "HEADER",
          format: headerType,
        });
      }

      const bodyComponent: any = {
        type: "BODY",
        text: bodyText.trim(),
      };

      if (bodyText.includes("{{1}}") || bodyText.includes("{{2}}")) {
        const samples: string[] = [];
        if (bodyText.includes("{{1}}")) samples.push(sampleVar1.trim() || "Amostra 1");
        if (bodyText.includes("{{2}}")) samples.push(sampleVar2.trim() || "Amostra 2");
        bodyComponent.example = {
          body_text: [samples],
        };
      }
      components.push(bodyComponent);

      if (footerText.trim()) {
        components.push({
          type: "FOOTER",
          text: footerText.trim(),
        });
      }

      if (buttonType === "QUICK_REPLY" && buttonText.trim()) {
        components.push({
          type: "BUTTONS",
          buttons: [{ type: "QUICK_REPLY", text: buttonText.trim() }],
        });
      } else if (buttonType === "URL" && buttonText.trim() && buttonUrl.trim()) {
        components.push({
          type: "BUTTONS",
          buttons: [{ type: "URL", text: buttonText.trim(), url: buttonUrl.trim() }],
        });
      }

      const res = await fetch("/api/integrations/whatsapp/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formattedName,
          category,
          language,
          components,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Falha ao enviar o template para a Meta.");
        return;
      }

      onSuccess();
    } catch {
      setError("Erro de comunicação com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  const getPreviewText = () => {
    return bodyText
      .replace(/\{\{1\}\}/g, sampleVar1 || "[Exemplo 1]")
      .replace(/\{\{2\}\}/g, sampleVar2 || "[Exemplo 2]");
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogPopup className="max-w-2xl overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Criar Modelo Oficial WhatsApp (Meta)</DialogTitle>
          <DialogDescription>
            Passo {step} de 4 — {step === 1 ? "Informações Básicas" : step === 2 ? "Conteúdo da Mensagem" : step === 3 ? "Amostras de Variáveis" : "Revisão e Envio"}
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            {error}
          </div>
        ) : null}

        {/* PASSO 1: BÁSICO */}
        {step === 1 ? (
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="template-name">Nome do template (formatado automaticamente em snake_case)</Label>
              <Input
                id="template-name"
                placeholder="ex: boas_vindas_corretor"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Nome técnico Meta: <code className="font-mono text-primary">{formattedName || "boas_vindas_corretor"}</code>
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Categoria oficial Meta</Label>
                <Select value={category} onValueChange={(val) => val && setCategory(val as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UTILITY">Utilidade (Transacional / Avisos)</SelectItem>
                    <SelectItem value="MARKETING">Marketing (Campanhas / Ofertas)</SelectItem>
                    <SelectItem value="AUTHENTICATION">Autenticação (Códigos / OTP)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Idioma</Label>
                <Select value={language} onValueChange={(val) => val && setLanguage(val)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pt_BR">Português (Brasil)</SelectItem>
                    <SelectItem value="en_US">Inglês (US)</SelectItem>
                    <SelectItem value="es">Espanhol</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        ) : null}

        {/* PASSO 2: CONTEÚDO */}
        {step === 2 ? (
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Cabeçalho (Opcional)</Label>
              <Select value={headerType} onValueChange={(val) => val && setHeaderType(val as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Sem cabeçalho</SelectItem>
                  <SelectItem value="TEXT">Texto simples</SelectItem>
                  <SelectItem value="IMAGE">Imagem</SelectItem>
                  <SelectItem value="DOCUMENT">Documento PDF</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {headerType === "TEXT" ? (
              <Input
                placeholder="Texto do cabeçalho..."
                value={headerText}
                onChange={(e) => setHeaderText(e.target.value)}
              />
            ) : null}

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Corpo da mensagem (obrigatório)</Label>
                <Button variant="ghost" size="sm" onClick={handleAddVariable} type="button" className="text-xs">
                  <Plus className="size-3 mr-1" />
                  Inserir Variável
                </Button>
              </div>
              <Textarea
                rows={4}
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                placeholder="Digite o conteúdo usando {{1}}, {{2}} para variáveis..."
              />
              <p className="text-[11px] text-muted-foreground">
                Use <code className="font-mono text-primary">{"{{1}}"}</code> e <code className="font-mono text-primary">{"{{2}}"}</code> para dados dinâmicos.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Rodapé (Opcional)</Label>
              <Input
                placeholder="ex: Mensagem automática de atendimento"
                value={footerText}
                onChange={(e) => setFooterText(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Botões (Opcional)</Label>
              <Select value={buttonType} onValueChange={(val) => val && setButtonType(val as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Sem botões</SelectItem>
                  <SelectItem value="QUICK_REPLY">Resposta Rápida (Quick Reply)</SelectItem>
                  <SelectItem value="URL">Link / URL do Site</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {buttonType !== "NONE" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  placeholder="Texto do botão..."
                  value={buttonText}
                  onChange={(e) => setButtonText(e.target.value)}
                />
                {buttonType === "URL" ? (
                  <Input
                    placeholder="URL do site (ex: https://site.com/{{1}})"
                    value={buttonUrl}
                    onChange={(e) => setButtonUrl(e.target.value)}
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* PASSO 3: AMOSTRAS & PREVIEW */}
        {step === 3 ? (
          <div className="grid gap-6 sm:grid-cols-2 py-2">
            <div className="space-y-4">
              <p className="text-xs font-semibold">Exemplos sintéticos para aprovação da Meta</p>
              <p className="text-xs text-muted-foreground">
                A Meta exige dados de amostra sem informações reais para analisar a intenção da mensagem.
              </p>

              {bodyText.includes("{{1}}") ? (
                <div className="space-y-1">
                  <Label className="text-xs">Exemplo para {"{{1}}"}</Label>
                  <Input value={sampleVar1} onChange={(e) => setSampleVar1(e.target.value)} className="text-xs" />
                </div>
              ) : null}

              {bodyText.includes("{{2}}") ? (
                <div className="space-y-1">
                  <Label className="text-xs">Exemplo para {"{{2}}"}</Label>
                  <Input value={sampleVar2} onChange={(e) => setSampleVar2(e.target.value)} className="text-xs" />
                </div>
              ) : null}
            </div>

            {/* Simulated Phone Mockup */}
            <div className="rounded-lg border border-border bg-emerald-950/10 p-3">
              <p className="text-[10px] font-mono uppercase text-muted-foreground mb-2">Simulação de Tela do WhatsApp</p>
              <div className="rounded-lg bg-card border border-border p-3 text-xs shadow-sm space-y-2">
                {headerType !== "NONE" ? (
                  <p className="font-semibold text-primary pb-1 border-b border-border/50">
                    {headerText || `[${headerType}]`}
                  </p>
                ) : null}
                <p className="whitespace-pre-wrap leading-relaxed">{getPreviewText()}</p>
                {footerText ? <p className="text-[10px] text-muted-foreground pt-1 border-t border-border/50">{footerText}</p> : null}
                {buttonType !== "NONE" ? (
                  <div className="pt-2 border-t border-border flex justify-center">
                    <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{buttonText}</span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {/* PASSO 4: REVISÃO */}
        {step === 4 ? (
          <div className="space-y-4 py-2 text-xs">
            <div className="rounded-lg border border-border p-3 space-y-2 bg-muted/20">
              <p><strong>Nome técnico:</strong> {formattedName}</p>
              <p><strong>Categoria:</strong> {category}</p>
              <p><strong>Idioma:</strong> {language}</p>
              <p><strong>Conteúdo:</strong> {bodyText}</p>
            </div>

            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 flex items-start gap-2 text-amber-700 dark:text-amber-400">
              <InfoIcon className="size-4 shrink-0 mt-0.5" />
              <p>
                Este modelo será enviado para análise da Meta. Durante a fase de validação, o status permanecerá em <strong>EM ANÁLISE (PENDING)</strong>.
              </p>
            </div>
          </div>
        ) : null}

        {/* Actions Footer */}
        <div className="flex justify-between items-center pt-4 border-t border-border">
          {step > 1 ? (
            <Button variant="outline" size="sm" onClick={() => setStep(step - 1)}>
              <ArrowLeft className="size-3.5 mr-1" /> Voltar
            </Button>
          ) : <div />}

          {step < 4 ? (
            <Button size="sm" onClick={() => setStep(step + 1)} disabled={!formattedName}>
              Avançar <ArrowRight className="size-3.5 ml-1" />
            </Button>
          ) : (
            <Button size="sm" onClick={handleSubmit} disabled={loading}>
              <PaperPlaneTilt className="size-3.5 mr-1" />
              {loading ? "Enviando..." : "Submeter à Meta"}
            </Button>
          )}
        </div>
      </DialogPopup>
    </Dialog>
  );
}
