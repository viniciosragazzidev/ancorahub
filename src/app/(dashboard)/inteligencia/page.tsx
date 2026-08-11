import React from "react";
import Link from "next/link";
import {
  Sparkles,
  Building,
  MapPin,
  BookOpen,
  FileText,
  Bot,
  Brain,
  ShieldAlert,
  History,
  Play,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getCompanyProfile, getUnitProfiles, getKnowledgeDocuments, getKnowledgeSuggestions } from "@/features/tenant-intelligence/service";
import { getAgentDefinitions } from "@/features/tenant-intelligence/agent-builder/service";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function TenantIntelligenceOverviewPage() {
  const context = await getRequiredTenantContext();
  const company = await getCompanyProfile(context.tenantId);
  const units = await getUnitProfiles(context.tenantId);
  const docs = await getKnowledgeDocuments(context.tenantId);
  const suggestions = await getKnowledgeSuggestions(context.tenantId);
  const agents = await getAgentDefinitions(context.tenantId);

  const pendingSuggestions = suggestions.filter((s) => s.status === "pending");

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header Banner */}
      <div className="relative rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 space-y-2 overflow-hidden shadow-xs">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1 bg-card text-primary font-semibold">
            <Brain className="size-3.5" />
            Central de Inteligência do Tenant
          </Badge>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Fonte de Conhecimento e Operação da IA
        </h1>
        <p className="text-sm text-muted-foreground max-w-3xl leading-relaxed">
          Camada unificada de inteligência da corretora. O material enviado alimenta o CRM estruturado,
          indexa a base de conhecimento RAG, atualiza o contexto dos agentes e disponibiliza ações nas automações.
        </p>
      </div>

      {/* Health Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-xl border border-border/80 shadow-2xs">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wider">Conhecimento Publicado</CardDescription>
            <CardTitle className="text-2xl font-bold text-foreground flex items-center justify-between">
              <span>{docs.length} docs</span>
              <BookOpen className="size-5 text-primary opacity-80" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Documentos canônicos ativos no RAG</p>
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-border/80 shadow-2xs">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wider">Sugestões de CRM Pendentes</CardDescription>
            <CardTitle className="text-2xl font-bold text-foreground flex items-center justify-between">
              <span>{pendingSuggestions.length} pendentes</span>
              <AlertTriangle className={`size-5 ${pendingSuggestions.length > 0 ? "text-amber-500" : "text-emerald-500"}`} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Alterações de empresa/unidade para aprovação</p>
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-border/80 shadow-2xs">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wider">Agentes Especializados</CardDescription>
            <CardTitle className="text-2xl font-bold text-foreground flex items-center justify-between">
              <span>{agents.length} agentes</span>
              <Bot className="size-5 text-blue-500 opacity-80" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Modelos e prompts ativos por função</p>
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-border/80 shadow-2xs">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wider">Unidades Cadastradas</CardDescription>
            <CardTitle className="text-2xl font-bold text-foreground flex items-center justify-between">
              <span>{units.length} filiais</span>
              <MapPin className="size-5 text-purple-500 opacity-80" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Estrutura física e regional de atendimento</p>
          </CardContent>
        </Card>
      </div>

      {/* Module Grid Navigation */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-foreground tracking-tight">Módulos de Conhecimento</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link href="/inteligencia/corretora" className="group">
            <Card className="rounded-xl border border-border/80 bg-card hover:bg-accent/40 transition-all shadow-2xs h-full flex flex-col justify-between p-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                    <Building className="size-5" />
                  </div>
                  <Badge variant="secondary" className="text-[10px]">Estruturado</Badge>
                </div>
                <h3 className="font-bold text-foreground text-sm group-hover:text-primary transition-colors">Perfil da Corretora</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Identidade, razão social, CNPJ, posicionamento, horários e políticas comerciais oficiais.
                </p>
              </div>
              <div className="flex items-center gap-1 text-xs font-semibold text-primary pt-4">
                <span>Gerenciar Perfil</span>
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
              </div>
            </Card>
          </Link>

          <Link href="/inteligencia/unidades" className="group">
            <Card className="rounded-xl border border-border/80 bg-card hover:bg-accent/40 transition-all shadow-2xs h-full flex flex-col justify-between p-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="size-9 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center font-bold">
                    <MapPin className="size-5" />
                  </div>
                  <Badge variant="secondary" className="text-[10px]">Locais</Badge>
                </div>
                <h3 className="font-bold text-foreground text-sm group-hover:text-primary transition-colors">Unidades & Filiais</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Informações detalhadas por unidade, gerentes locais, telefones e regiões de cobertura.
                </p>
              </div>
              <div className="flex items-center gap-1 text-xs font-semibold text-primary pt-4">
                <span>Ver Unidades</span>
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
              </div>
            </Card>
          </Link>

          <Link href="/inteligencia/materiais" className="group">
            <Card className="rounded-xl border border-border/80 bg-card hover:bg-accent/40 transition-all shadow-2xs h-full flex flex-col justify-between p-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="size-9 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                    <FileText className="size-5" />
                  </div>
                  <Badge variant="secondary" className="text-[10px]">Ingestão</Badge>
                </div>
                <h3 className="font-bold text-foreground text-sm group-hover:text-primary transition-colors">Upload de Materiais</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Envie PDFs, DOCX, XLSX e manuais para extração semântica, vetorização e RAG.
                </p>
              </div>
              <div className="flex items-center gap-1 text-xs font-semibold text-primary pt-4">
                <span>Enviar Material</span>
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
              </div>
            </Card>
          </Link>

          <Link href="/inteligencia/sugestoes" className="group">
            <Card className="rounded-xl border border-border/80 bg-card hover:bg-accent/40 transition-all shadow-2xs h-full flex flex-col justify-between p-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="size-9 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                    <Sparkles className="size-5" />
                  </div>
                  {pendingSuggestions.length > 0 && (
                    <Badge variant="destructive" className="text-[10px]">{pendingSuggestions.length} novas</Badge>
                  )}
                </div>
                <h3 className="font-bold text-foreground text-sm group-hover:text-primary transition-colors">Sugestões de CRM & Diff</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Revise alterações detectadas nos materiais enviados com visualização em Diff e aprovação humana.
                </p>
              </div>
              <div className="flex items-center gap-1 text-xs font-semibold text-primary pt-4">
                <span>Revisar Sugestões</span>
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
              </div>
            </Card>
          </Link>

          <Link href="/inteligencia/agentes" className="group">
            <Card className="rounded-xl border border-border/80 bg-card hover:bg-accent/40 transition-all shadow-2xs h-full flex flex-col justify-between p-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="size-9 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
                    <Bot className="size-5" />
                  </div>
                  <Badge variant="secondary" className="text-[10px]">Agent Builder</Badge>
                </div>
                <h3 className="font-bold text-foreground text-sm group-hover:text-primary transition-colors">Agentes de IA</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Crie e configure agentes especializados com coleções de conhecimento, memória e ferramentas MCP.
                </p>
              </div>
              <div className="flex items-center gap-1 text-xs font-semibold text-primary pt-4">
                <span>Configurar Agentes</span>
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
              </div>
            </Card>
          </Link>

          <Link href="/inteligencia/playground" className="group">
            <Card className="rounded-xl border border-border/80 bg-card hover:bg-accent/40 transition-all shadow-2xs h-full flex flex-col justify-between p-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="size-9 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-bold">
                    <Play className="size-5" />
                  </div>
                  <Badge variant="secondary" className="text-[10px]">Testes</Badge>
                </div>
                <h3 className="font-bold text-foreground text-sm group-hover:text-primary transition-colors">Playground & Debug</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Teste o retrieval de chunks, prompts montados, chamadas de tools MCP e latência em tempo real.
                </p>
              </div>
              <div className="flex items-center gap-1 text-xs font-semibold text-primary pt-4">
                <span>Abrir Playground</span>
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
              </div>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
