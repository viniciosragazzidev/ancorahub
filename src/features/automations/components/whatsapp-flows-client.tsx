"use client";

import * as React from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogPopup as DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createWhatsappFlowAction, updateWhatsappFlowAction, deleteWhatsappFlowAction } from "../actions";

type WhatsappFlow = {
  id: string;
  name: string;
  triggerType: string;
  status: string;
  configuration: unknown;
  createdAt: Date;
};

interface WhatsappFlowsClientProps {
  initialFlows: WhatsappFlow[];
}

const FLOW_TEMPLATES = [
  {
    triggerType: "lead_ads",
    name: "Lead Ads",
    description: "Captura automatica de leads vindo de campanhas pagas do Facebook/Instagram Meta Ads.",
    defaultConfig: { campaignFilter: "", formId: "" },
  },
  {
    triggerType: "site",
    name: "Site / Landing Page",
    description: "Recebimento instantaneo de leads de formularios do site institucional e landing pages.",
    defaultConfig: { webhookUrl: "", autoWelcome: true },
  },
  {
    triggerType: "region_interest",
    name: "Distribuicao por Regiao/Interesse",
    description: "Roteamento inteligente de leads baseado no DDD de origem ou plano de interesse do cliente.",
    defaultConfig: { preferredRegions: "", distributeRoundRobin: true },
  },
  {
    triggerType: "b2b_qualification",
    name: "Qualificacao B2B",
    description: "Fluxo inteligente de perguntas adicionais para leads empresariais (CNPJ, numero de vidas).",
    defaultConfig: { minVidas: 3, askCnpj: true },
  },
  {
    triggerType: "handoff_human",
    name: "Handoff Humano",
    description: "Regras para transferencia automatica do assistente de IA para a fila de corretores humanos.",
    defaultConfig: { notifyGroup: true, fallbackOnTimeout: true },
  },
];

export function WhatsappFlowsClient({ initialFlows }: WhatsappFlowsClientProps) {
  const flows = initialFlows;
  const [activeTemplate, setActiveTemplate] = React.useState<typeof FLOW_TEMPLATES[number] | null>(null);

  // Config form states
  const [flowName, setFlowName] = React.useState("");
  const [configValues, setConfigValues] = React.useState<Record<string, unknown>>({});

  const handleOpenTemplate = (tpl: typeof FLOW_TEMPLATES[number]) => {
    setActiveTemplate(tpl);
    setFlowName(`Fluxo ${tpl.name}`);
    setConfigValues(tpl.defaultConfig);
  };

  const handleCreateFlow = async () => {
    if (!flowName) {
      toast.error("Informe um nome para o fluxo.");
      return;
    }

    const res = await createWhatsappFlowAction({
      name: flowName,
      triggerType: activeTemplate!.triggerType,
      status: "active",
      configuration: configValues,
    });

    if (res.success) {
      toast.success("Fluxo operacional criado com sucesso.");
      setActiveTemplate(null);
      window.location.reload();
    } else {
      toast.error(res.error || "Erro ao criar fluxo.");
    }
  };

  const handleToggleStatus = async (flow: WhatsappFlow) => {
    const newStatus = flow.status === "active" ? "paused" : "active";
    const res = await updateWhatsappFlowAction(flow.id, { status: newStatus });
    if (res.success) {
      toast.success(`Fluxo ${flow.status === "active" ? "pausado" : "ativado"} com sucesso.`);
      window.location.reload();
    } else {
      toast.error(res.error || "Erro ao alterar status.");
    }
  };

  const handleDeleteFlow = async (id: string) => {
    if (!confirm("Deseja excluir este fluxo?")) return;
    const res = await deleteWhatsappFlowAction(id);
    if (res.success) {
      toast.success("Fluxo excluido com sucesso.");
      window.location.reload();
    } else {
      toast.error(res.error || "Erro ao excluir fluxo.");
    }
  };

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Fluxos de WhatsApp</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Gerencie a recepcao, qualificacao e roteamento de contatos do WhatsApp usando a frota ativa do WAHA.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-slate-200 dark:border-slate-700">
          <CardHeader>
            <CardTitle>Modelos de Fluxo Disponiveis</CardTitle>
            <CardDescription>Clique em um modelo para ativar um novo fluxo no seu tenant.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {FLOW_TEMPLATES.map((tpl) => {
              const alreadyExists = flows.some((f) => f.triggerType === tpl.triggerType);
              return (
                <div
                  key={tpl.triggerType}
                  className="flex items-center justify-between p-4 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50"
                >
                  <div className="space-y-1 pr-4">
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{tpl.name}</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{tpl.description}</p>
                  </div>
                  <Button
                    size="sm"
                    variant={alreadyExists ? "outline" : "default"}
                    onClick={() => handleOpenTemplate(tpl)}
                    disabled={alreadyExists}
                  >
                    {alreadyExists ? "Configurado" : "Adicionar"}
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-700">
          <CardHeader>
            <CardTitle>Seus Fluxos Ativos</CardTitle>
            <CardDescription>Fluxos operando atualmente na sua corretora.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {flows.map((flow) => (
              <div
                key={flow.id}
                className="flex items-center justify-between p-4 rounded-lg border border-slate-100 dark:border-slate-800"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{flow.name}</h4>
                    <Badge variant={flow.status === "active" ? "default" : "secondary"}>
                      {flow.status === "active" ? "Ativo" : "Pausado"}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500">
                    Gatilho: {flow.triggerType}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleToggleStatus(flow)}>
                    {flow.status === "active" ? "Pausar" : "Ativar"}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDeleteFlow(flow.id)}>
                    Excluir
                  </Button>
                </div>
              </div>
            ))}

            {flows.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                Nenhum fluxo de WhatsApp ativo configurado.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* CREATE FLOW DIALOG */}
      <Dialog open={activeTemplate !== null} onOpenChange={(open) => !open && setActiveTemplate(null)}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Configurar Fluxo: {activeTemplate?.name}</DialogTitle>
            <DialogDescription>Ajuste os parametros do fluxo operacional.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Nome do Fluxo</label>
              <Input
                value={flowName}
                onChange={(e) => setFlowName(e.target.value)}
              />
            </div>

            {activeTemplate?.triggerType === "lead_ads" && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold">Filtro de Campanha Meta Ads (Opcional)</label>
                  <Input
                    placeholder="Nome da campanha para filtrar"
                    value={String(configValues.campaignFilter ?? "")}
                    onChange={(e) => setConfigValues({ ...configValues, campaignFilter: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold">ID do Formulario Meta Ads (Opcional)</label>
                  <Input
                    placeholder="ID especifico do formulario Meta"
                    value={String(configValues.formId ?? "")}
                    onChange={(e) => setConfigValues({ ...configValues, formId: e.target.value })}
                  />
                </div>
              </div>
            )}

            {activeTemplate?.triggerType === "site" && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold">URL de Webhook Externa (Opcional)</label>
                  <Input
                    placeholder="https://sua-url-site.com/api"
                    value={String(configValues.webhookUrl ?? "")}
                    onChange={(e) => setConfigValues({ ...configValues, webhookUrl: e.target.value })}
                  />
                </div>
              </div>
            )}

            {activeTemplate?.triggerType === "region_interest" && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold">DDDs Preferenciais (separados por virgula)</label>
                  <Input
                    placeholder="11, 21, 19"
                    value={String(configValues.preferredRegions ?? "")}
                    onChange={(e) => setConfigValues({ ...configValues, preferredRegions: e.target.value })}
                  />
                </div>
              </div>
            )}

            {activeTemplate?.triggerType === "b2b_qualification" && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold">Minimo de Vidas (PME)</label>
                  <Input
                    type="number"
                    value={Number(configValues.minVidas ?? 3)}
                    onChange={(e) => setConfigValues({ ...configValues, minVidas: Number(e.target.value) })}
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveTemplate(null)}>Cancelar</Button>
            <Button onClick={handleCreateFlow} className="bg-indigo-600 hover:bg-indigo-700 text-white">Salvar Fluxo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
