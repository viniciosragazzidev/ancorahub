"use client";

/**
 * Aba "Permissões" do hub de qualificação no visual Lite: os gatilhos do agente (o mesmo painel, numa moldura Lite) e
 * a governança das ferramentas, com a mesma troca de permissão; ações críticas seguem bloqueadas.
 */
import compat from "@/components/lite/page/lite-compat.module.css";
import { LiteResponsiveData, type LiteColumn } from "@/components/lite/data/data";
import page from "@/components/lite/page/lite-page.module.css";

import { AgentTriggersPanel } from "../agent-triggers-panel";
import type { QualificationHubProps } from "../qualification-hub-types";

type Tool = QualificationHubProps["toolPermissions"][number];

const CATEGORY_LABEL: Record<string, string> = { critical: "Crítica", read_only: "Só leitura", write: "Escrita" };

export function PermissionsTabLite({ tools, onToggle }: { tools: Tool[]; onToggle: (tool: Tool) => void }) {
  const columns: LiteColumn<Tool>[] = [
    { id: "name", label: "Ferramenta", primary: true, render: (tool) => <span className={page.cellTitle}>{tool.displayName}</span> },
    { id: "category", label: "Categoria", nowrap: true, render: (tool) => <span className={page.badge} data-tone={tool.category === "critical" ? "danger" : undefined}>{CATEGORY_LABEL[tool.category] ?? tool.category}</span> },
    { id: "description", label: "Descrição", secondary: true, render: (tool) => <span className={page.muted}>{tool.description}</span> },
    { id: "permission", label: "Permissão", render: (tool) => (tool.isCritical ? (
      <span className={page.badge} data-tone="danger">Bloqueada (crítica)</span>
    ) : (
      <button type="button" className={page.button} aria-pressed={tool.permission === "allowed"} aria-label={`${tool.displayName}: ${tool.permission === "allowed" ? "permitida, clique para bloquear" : "bloqueada, clique para permitir"}`} onClick={() => onToggle(tool)}>
        {tool.permission === "allowed" ? "Permitida" : "Bloqueada"}
      </button>
    )) },
  ];
  return (
    <>
      <div className={compat.compat}>
        <AgentTriggersPanel />
      </div>
      <section className={page.group} aria-labelledby="tools-title">
        <header className={page.cardHead}>
          <h2 id="tools-title" className={page.cardTitle}>Governança das ferramentas (MCP)</h2>
          <p className={page.cardDescription}>O que a IA pode consultar ou alterar. Ações críticas ficam sempre bloqueadas.</p>
        </header>
        <LiteResponsiveData caption="Permissões das ferramentas da IA" columns={columns} rows={tools} rowKey={(tool) => tool.toolName} rowTone={(tool) => (tool.isCritical ? "muted" : undefined)} empty={<p className={page.emptyText}>Nenhuma ferramenta cadastrada.</p>} />
      </section>
    </>
  );
}
