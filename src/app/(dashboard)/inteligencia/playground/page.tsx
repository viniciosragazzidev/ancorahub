import React from "react";
import Link from "next/link";
import { ArrowLeft, Play, Sparkles, BookOpen, Wrench, Shield, Clock } from "lucide-react";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { buildAgentContext } from "@/features/tenant-intelligence/rag/agent-context-builder";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

export default async function AgentPlaygroundPage({
  searchParams,
}: {
  searchParams: Promise<{ query?: string }>;
}) {
  const context = await getRequiredTenantContext();
  const resolvedParams = await searchParams;
  const query = resolvedParams?.query || "Quais planos de saúde cobrem a região de Salvador?";

  const startTime = Date.now();
  const agentContext = await buildAgentContext({
    tenantContext: context,
    queryText: query,
  });
  const latencyMs = Date.now() - startTime;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/inteligencia">
          <Button variant="outline" size="icon" className="rounded-lg">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Play className="size-5 text-indigo-500" />
            Playground do Agente & Inspetor de Contexto
          </h1>
          <p className="text-xs text-muted-foreground">
            Simule requisições, inspecione a recuperação de chunks (RAG), o prompt estruturado e as ferramentas MCP ativas
          </p>
        </div>
      </div>

      {/* Caixa de Pesquisa / Pergunta */}
      <Card className="rounded-xl border border-border/80 shadow-2xs">
        <CardContent className="p-4">
          <form method="GET" className="space-y-3">
            <label className="text-xs font-semibold text-foreground">Simular Pergunta do Lead / Usuário:</label>
            <div className="flex gap-2">
              <input
                type="text"
                name="query"
                defaultValue={query}
                className="flex-1 h-9 rounded-md border border-input bg-transparent px-3 text-xs shadow-2xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="Digite uma pergunta para simular o retrieval..."
              />
              <Button type="submit" className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs">
                <Sparkles className="size-3.5" />
                Executar Retrieval
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Painel do Inspetor */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Formatted Prompt */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="rounded-xl border border-border/80 shadow-2xs">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold">Prompt Estruturado Montado</CardTitle>
                <CardDescription className="text-[11px]">Gerado dinamicamente pelo AgentContextBuilder</CardDescription>
              </div>
              <Badge variant="outline" className="gap-1 text-[10px]">
                <Clock className="size-3" /> {latencyMs}ms
              </Badge>
            </CardHeader>
            <CardContent>
              <pre className="p-3 rounded-lg bg-muted/40 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-foreground overflow-x-auto max-h-[450px]">
                {agentContext.formattedSystemPromptBlock}
              </pre>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Chunks & Tools */}
        <div className="space-y-4">
          {/* Retrieved Chunks */}
          <Card className="rounded-xl border border-border/80 shadow-2xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-bold flex items-center gap-1.5">
                <BookOpen className="size-4 text-primary" />
                Chunks Recuperados ({agentContext.retrievedKnowledge.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {agentContext.retrievedKnowledge.length > 0 ? (
                agentContext.retrievedKnowledge.map((k, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg border border-border/60 bg-muted/20 space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground text-[11px]">{k.title}</span>
                      <Badge variant="secondary" className="text-[9px]">
                        {k.authorityLevel}★
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-3">{k.text}</p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground italic text-center py-4">Nenhum chunk retornado para esta consulta.</p>
              )}
            </CardContent>
          </Card>

          {/* Active MCP Tools */}
          <Card className="rounded-xl border border-border/80 shadow-2xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-bold flex items-center gap-1.5">
                <Wrench className="size-4 text-emerald-500" />
                Ferramentas MCP Autorizadas ({agentContext.mcpTools.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {agentContext.mcpTools.map((t) => (
                <div key={t.name} className="p-2 rounded-md border border-border/40 bg-muted/10 text-xs flex items-center justify-between">
                  <span className="font-mono text-[11px] text-foreground">{t.name}</span>
                  <Badge variant="outline" className="text-[9px] max-w-[150px] truncate">
                    MCP Tool
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
