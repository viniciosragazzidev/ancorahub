import React from "react";
import Link from "next/link";
import { ArrowLeft, FileText, Upload, Sparkles, CheckCircle2 } from "lucide-react";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getKnowledgeDocuments } from "@/features/tenant-intelligence/service";
import { processMaterialIngestion } from "@/features/tenant-intelligence/ingestion/pipeline";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

export default async function MaterialsPage() {
  const context = await getRequiredTenantContext();
  const docs = await getKnowledgeDocuments(context.tenantId);

  async function handleIngestTextMaterial(formData: FormData) {
    "use server";
    const ctx = await getRequiredTenantContext();
    const fileName = formData.get("fileName") as string;
    const category = formData.get("category") as string;
    const rawText = formData.get("rawText") as string;

    if (!fileName || !rawText) return;

    await processMaterialIngestion({
      tenantId: ctx.tenantId,
      fileName,
      fileType: "txt",
      fileUrl: "local://inline",
      rawText,
      userCategoryChoice: category,
      uploadedByUserId: ctx.userId,
    });
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/inteligencia">
          <Button variant="outline" size="icon" className="rounded-lg">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FileText className="size-5 text-emerald-500" />
            Upload Inteligente de Materiais
          </h1>
          <p className="text-xs text-muted-foreground">
            Ingestão semântica de PDFs, DOCX, XLSX, TXT e materiais comerciais para RAG e CRM
          </p>
        </div>
      </div>

      <Card className="rounded-xl border border-border/80 shadow-2xs">
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Upload className="size-4 text-primary" />
            Adicionar Novo Conhecimento
          </CardTitle>
          <CardDescription className="text-xs">
            O pipeline extrai entidades, detecta conflitos, propõe atualizações de CRM com Diff e vetoriza os trechos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={handleIngestTextMaterial} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Título do Material / Nome do Arquivo</label>
                <Input name="fileName" required placeholder="Ex: Tabela Amil 2026 Salvador.pdf" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">O que é este material?</label>
                <select
                  name="category"
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-xs shadow-2xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="company_info">Informações da Corretora</option>
                  <option value="unit_info">Informações de uma Unidade</option>
                  <option value="product_plan">Produto / Plano de Saúde</option>
                  <option value="operator_rules">Operadora / Regras de Venda</option>
                  <option value="faq">FAQ / Perguntas Frequentes</option>
                  <option value="internal_policy">Política Interna / Compliance</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Conteúdo / Texto Extrato do Documento</label>
              <Textarea
                name="rawText"
                required
                rows={6}
                placeholder="Cole aqui o texto completo ou conteúdo lido do documento (ex: normas de comercialização, telefones, rede credenciada, carências)..."
              />
            </div>

            <div className="flex justify-end">
              <Button type="submit" className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                <Sparkles className="size-4" />
                Processar Ingestão Semântica
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Lista de Documentos Canônicos Publicados */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-foreground">Documentos Canônicos Publicados ({docs.length})</h2>
        <div className="grid grid-cols-1 gap-3">
          {docs.map((doc) => (
            <Card key={doc.id} className="rounded-xl border border-border/80 p-4 shadow-2xs flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-foreground">{doc.title}</h3>
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {doc.category}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary">
                    {doc.authorityLevel}★ Autoridade
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-1">{doc.canonicalContent}</p>
              </div>
              <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 bg-emerald-500/10 text-[10px]">
                <CheckCircle2 className="size-3" /> Publicado (v{doc.version})
              </Badge>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
