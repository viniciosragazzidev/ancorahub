import React from "react";
import Link from "next/link";
import { ArrowLeft, Bot, Plus, Sparkles, CheckCircle2 } from "lucide-react";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getAgentDefinitions, createAgentDefinition } from "@/features/tenant-intelligence/agent-builder/service";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default async function AgentsPage() {
  const context = await getRequiredTenantContext();
  const agents = await getAgentDefinitions(context.tenantId);

  async function handleCreateAgent(formData: FormData) {
    "use server";
    const ctx = await getRequiredTenantContext();
    const name = formData.get("name") as string;
    const slug = formData.get("slug") as string;
    const objective = formData.get("objective") as string;
    const category = formData.get("category") as string;
    const systemPrompt = formData.get("systemPrompt") as string;

    if (!name || !slug || !systemPrompt) return;

    await createAgentDefinition(ctx.tenantId, {
      name,
      slug,
      objective: objective || "Atendimento especializado ao cliente",
      category,
      systemPrompt,
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
            <Bot className="size-5 text-blue-500" />
            Agent Builder - Agentes Especializados
          </h1>
          <p className="text-xs text-muted-foreground">
            Configure agentes de IA com prompts, memórias, coleções de conhecimento e ferramentas MCP autorizadas
          </p>
        </div>
      </div>

      <Card className="rounded-xl border border-border/80 shadow-2xs">
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Plus className="size-4 text-primary" />
            Criar Novo Agente Especializado
          </CardTitle>
          <CardDescription className="text-xs">
            Cada agente consulta apenas o escopo de conhecimento e ferramentas permitido para sua função
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={handleCreateAgent} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Nome do Agente</label>
                <Input name="name" required placeholder="Ex: Qualificador de Leads PME" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Identificador / Slug</label>
                <Input name="slug" required placeholder="qualificador-pme" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Categoria</label>
                <select
                  name="category"
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-xs shadow-2xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="qualification">Qualificação de Leads</option>
                  <option value="sales">Vendas e Cotação</option>
                  <option value="documentation">Documentação e Contrato</option>
                  <option value="support">Suporte Operacional</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Objetivo Principal do Agente</label>
              <Input name="objective" placeholder="Qualificar o cliente solicitando quantidade de vidas e regiao antes de distribuir ao corretor..." />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Instruções do Sistema (System Prompt)</label>
              <Textarea
                name="systemPrompt"
                required
                rows={5}
                placeholder="Você é um assistente virtual especialista da corretora Âncora Saúde. Seu tom deve ser profissional, direto e amigável..."
              />
            </div>

            <div className="flex justify-end">
              <Button type="submit" className="gap-2">
                <Sparkles className="size-4" />
                Criar Agente Especializado
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Lista de Agentes Ativos */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-foreground">Agentes Criados ({agents.length})</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {agents.map((ag) => (
            <Card key={ag.id} className="rounded-xl border border-border/80 p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-foreground">{ag.name}</h3>
                  <p className="text-[11px] text-muted-foreground">/{ag.slug}</p>
                </div>
                <Badge variant="outline" className="text-[10px] capitalize bg-blue-500/10 text-blue-600 border-blue-500/20">
                  {ag.category}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">{ag.objective}</p>
              <div className="pt-2 border-t flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Versão v{ag.version}</span>
                <Badge variant="secondary" className="text-[10px]">
                  {ag.modelProvider}/{ag.modelName}
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
