"use client";

/**
 * Fluxos de WhatsApp no visual Lite. Mesmos modelos, campos de configuração e Server Actions (criar, pausar ou ativar,
 * excluir) com as mesmas mensagens. A configuração abre no painel lateral e excluir pede confirmação Lite no lugar do
 * confirm do navegador.
 */
import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { LiteConfirmDialog } from "@/components/lite/controls";
import { LiteSidePanel } from "@/components/lite/data/side-panel";
import form from "@/components/lite/page/lite-form.module.css";
import page from "@/components/lite/page/lite-page.module.css";
import sections from "@/components/lite/page/lite-sections.module.css";
import { toast } from "@/components/ui/sonner";

import styles from "./whatsapp-flows-lite.module.css";
import { createWhatsappFlowAction, deleteWhatsappFlowAction, updateWhatsappFlowAction } from "../actions";

type WhatsappFlow = { id: string; name: string; triggerType: string; status: string; configuration: unknown; createdAt: Date };
type Template = { triggerType: string; name: string; description: string; defaultConfig: Record<string, unknown> };

const FLOW_TEMPLATES: Template[] = [
  { triggerType: "lead_ads", name: "Lead Ads", description: "Captura automática de leads vindos de campanhas pagas do Facebook e Instagram (Meta Ads).", defaultConfig: { campaignFilter: "", formId: "" } },
  { triggerType: "site", name: "Site ou landing page", description: "Recebimento instantâneo de leads de formulários do site institucional e de landing pages.", defaultConfig: { webhookUrl: "", autoWelcome: true } },
  { triggerType: "region_interest", name: "Distribuição por região ou interesse", description: "Roteamento de leads pelo DDD de origem ou pelo plano de interesse do cliente.", defaultConfig: { preferredRegions: "", distributeRoundRobin: true } },
  { triggerType: "b2b_qualification", name: "Qualificação B2B", description: "Perguntas adicionais para leads empresariais (CNPJ, número de vidas).", defaultConfig: { minVidas: 3, askCnpj: true } },
  { triggerType: "handoff_human", name: "Passagem para humano", description: "Regras para transferir do assistente de IA para a fila de corretores.", defaultConfig: { notifyGroup: true, fallbackOnTimeout: true } },
];
const TEMPLATE_NAME = new Map(FLOW_TEMPLATES.map((template) => [template.triggerType, template.name]));

export function WhatsappFlowsLite({ initialFlows }: { initialFlows: WhatsappFlow[] }) {
  const flows = initialFlows;
  const router = useRouter();
  const [active, setActive] = useState<Template | null>(null);
  const [flowName, setFlowName] = useState("");
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [removing, setRemoving] = useState<WhatsappFlow | null>(null);
  const [pending, startTransition] = useTransition();
  const cancelRemove = useCallback(() => setRemoving(null), []);

  const open = (template: Template) => {
    setActive(template);
    setFlowName(`Fluxo ${template.name}`);
    setConfig(template.defaultConfig);
  };

  const create = () => {
    if (!flowName) {
      toast.error("Informe um nome para o fluxo.");
      return;
    }
    startTransition(async () => {
      const result = await createWhatsappFlowAction({ name: flowName, triggerType: active!.triggerType, status: "active", configuration: config });
      if (result.success) {
        toast.success("Fluxo operacional criado com sucesso.");
        setActive(null);
        router.refresh();
      } else {
        toast.error(result.error || "Erro ao criar fluxo.");
      }
    });
  };

  const toggle = (flow: WhatsappFlow) => startTransition(async () => {
    const result = await updateWhatsappFlowAction(flow.id, { status: flow.status === "active" ? "paused" : "active" });
    if (result.success) {
      toast.success(`Fluxo ${flow.status === "active" ? "pausado" : "ativado"} com sucesso.`);
      router.refresh();
    } else {
      toast.error(result.error || "Erro ao alterar status.");
    }
  });

  const remove = (flow: WhatsappFlow) => startTransition(async () => {
    const result = await deleteWhatsappFlowAction(flow.id);
    if (result.success) {
      toast.success("Fluxo excluido com sucesso.");
      router.refresh();
    } else {
      toast.error(result.error || "Erro ao excluir fluxo.");
    }
  });

  const field = (key: string, label: string, placeholder?: string, type: "text" | "number" = "text") => (
    <label className={form.field}>
      <span className={form.label}>{label}</span>
      <input
        className={form.input}
        type={type}
        placeholder={placeholder}
        value={type === "number" ? Number(config[key] ?? 3) : String(config[key] ?? "")}
        onChange={(event) => setConfig({ ...config, [key]: type === "number" ? Number(event.target.value) : event.target.value })}
      />
    </label>
  );

  return (
    <>
      <div className={styles.grid}>
        <section className={sections.group} aria-labelledby="flow-templates-title">
          <div className={sections.row}>
            <div className={sections.rowText}>
              <h2 id="flow-templates-title" className={sections.rowTitle}>Modelos de fluxo</h2>
              <p className={sections.rowDescription}>Escolha um modelo para ativar um novo fluxo na sua corretora.</p>
            </div>
          </div>
          <ul className={sections.list}>
            {FLOW_TEMPLATES.map((template) => {
              const exists = flows.some((flow) => flow.triggerType === template.triggerType);
              return (
                <li key={template.triggerType} className={sections.item}>
                  <span className={sections.rowText}>
                    <span className={sections.rowTitle}>{template.name}</span>
                    <span className={sections.rowDescription}>{template.description}</span>
                  </span>
                  {exists ? <span className={page.badge} data-tone="success">Configurado</span> : (
                    <button type="button" className={page.button} onClick={() => open(template)} aria-label={`Adicionar ${template.name}`}>Adicionar</button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
        <section className={sections.group} aria-labelledby="flows-title" aria-busy={pending}>
          <div className={sections.row}>
            <div className={sections.rowText}>
              <h2 id="flows-title" className={sections.rowTitle}>Seus fluxos</h2>
              <p className={sections.rowDescription}>Fluxos operando na sua corretora.</p>
            </div>
          </div>
          {flows.length ? (
            <ul className={sections.list}>
              {flows.map((flow) => (
                <li key={flow.id} className={sections.item}>
                  <span className={sections.itemText}>
                    <span className={sections.itemTitle}>{flow.name}</span>
                    <span className={sections.itemSub}>Gatilho: {TEMPLATE_NAME.get(flow.triggerType) ?? flow.triggerType}</span>
                  </span>
                  <span className={sections.actions} style={{ alignItems: "center", gap: 8 }}>
                    <span className={page.badge} data-tone={flow.status === "active" ? "success" : undefined}>{flow.status === "active" ? "Ativo" : "Pausado"}</span>
                    <button type="button" className={page.button} disabled={pending} onClick={() => toggle(flow)}>{flow.status === "active" ? "Pausar" : "Ativar"}</button>
                    <button type="button" className={page.button} data-tone="danger" disabled={pending} onClick={() => setRemoving(flow)} aria-label={`Excluir ${flow.name}`}>Excluir</button>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className={sections.empty}>
              <p className={sections.emptyTitle}>Nenhum fluxo configurado</p>
              <p>Adicione um modelo ao lado para começar.</p>
            </div>
          )}
        </section>
      </div>
      <LiteSidePanel open={active !== null} onOpenChange={(value) => { if (!value) setActive(null); }} title={`Configurar fluxo: ${active?.name ?? ""}`} description="Ajuste os parâmetros do fluxo operacional.">
        <div className={form.form}>
          <label className={form.field}>
            <span className={form.label}>Nome do fluxo</span>
            <input className={form.input} value={flowName} onChange={(event) => setFlowName(event.target.value)} />
          </label>
          {active?.triggerType === "lead_ads" ? (
            <>
              {field("campaignFilter", "Filtro de campanha Meta Ads (opcional)", "Nome da campanha para filtrar")}
              {field("formId", "ID do formulário Meta Ads (opcional)", "ID específico do formulário Meta")}
            </>
          ) : null}
          {active?.triggerType === "site" ? field("webhookUrl", "URL de webhook externa (opcional)", "https://sua-url-site.com/api") : null}
          {active?.triggerType === "region_interest" ? field("preferredRegions", "DDDs preferenciais (separados por vírgula)", "11, 21, 19") : null}
          {active?.triggerType === "b2b_qualification" ? field("minVidas", "Mínimo de vidas (PME)", undefined, "number") : null}
          <div className={form.actions}>
            <button type="button" className={page.button} onClick={() => setActive(null)}>Cancelar</button>
            <button type="button" className={page.primaryButton} disabled={pending} onClick={create}>Salvar fluxo</button>
          </div>
        </div>
      </LiteSidePanel>
      <LiteConfirmDialog
        open={Boolean(removing)}
        title="Excluir este fluxo?"
        description={removing ? `"${removing.name}" para de operar na sua corretora.` : undefined}
        confirmLabel="Excluir fluxo"
        tone="danger"
        onCancel={cancelRemove}
        onConfirm={() => {
          const target = removing;
          setRemoving(null);
          if (target) remove(target);
        }}
      />
    </>
  );
}

