"use client";

/**
 * Regras de roteamento no Lite (27/11/2026): tabela no padrão /equipe em ordem de prioridade; a linha abre a gaveta com
 * destino, condições e as ações (subir, descer, editar, pausar, excluir). "Nova regra" é o CTA da aba. O formulário de
 * criar e editar é o mesmo de antes (`dialog`).
 */
import { useState, type ReactNode } from "react";

import { ScrollArea } from "@/components/ui/scroll-area";
import type { RoutingRule } from "@/features/lead-distribution/routing-engine";
import { cn } from "@/lib/utils";
import { DotsIcon, PlConfirm, PlMenu, PlSheet, PlusIcon, pl } from "../plantao/_components/plantoes-1a1-kit";
import { Section1a1, TableFoot1a1, ab, cols, usePages1a1 } from "./abas-1a1-kit";

export function RoutingRules1a1({ rules, canEdit, targetName, fallbackName, conditionTags, onCreate, onEdit, onToggle, onDelete, onMove, dialog }: {
  rules: RoutingRule[];
  canEdit: boolean;
  targetName: (rule: RoutingRule) => string;
  fallbackName: (rule: RoutingRule) => string | null;
  conditionTags: (rule: RoutingRule) => string[];
  onCreate: () => void;
  onEdit: (rule: RoutingRule) => void;
  onToggle: (rule: RoutingRule) => Promise<void>;
  onDelete: (ruleId: string) => Promise<void>;
  onMove: (index: number, direction: "up" | "down") => Promise<void>;
  dialog: ReactNode;
}) {
  const pages = usePages1a1(rules, 20);
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const open = rules.find((rule) => rule.id === openId) ?? null;
  const openIndex = open ? rules.indexOf(open) : -1;
  const template = "64px minmax(200px, 1.4fr) minmax(170px, 1fr) minmax(220px, 1.6fr) 150px 96px 52px";

  const menuItems = (rule: RoutingRule, index: number) => [
    { label: "Subir prioridade", onSelect: () => { void onMove(index, "up"); }, disabled: index === 0 },
    { label: "Descer prioridade", onSelect: () => { void onMove(index, "down"); }, disabled: index === rules.length - 1 },
    { label: "Editar regra", onSelect: () => { setOpenId(null); onEdit(rule); } },
    { label: rule.enabled ? "Pausar regra" : "Ativar regra", onSelect: () => { void onToggle(rule); } },
    { label: "Excluir regra", danger: true, onSelect: () => setConfirmDelete(rule.id) },
  ];

  const statusBadge = (rule: RoutingRule) => <span className={cn(pl.badge, rule.enabled ? pl.bGood : undefined)}>{rule.enabled ? "Ativa" : "Pausada"}</span>;
  const modeLabel = (rule: RoutingRule) => (rule.distributionMode === "manual" ? "Ação manual" : "Oferta automática");

  return (
    <>
      <Section1a1 id="regras-roteamento" title="Regras de roteamento" count={rules.length}
        lead="Em ordem de prioridade: a primeira regra que combinar com o lead decide para onde ele vai."
        actions={canEdit ? <button type="button" className={cn(pl.pill, pl.pillPrimary)} onClick={onCreate}><PlusIcon />Nova regra</button> : null}>
        {rules.length === 0 ? (
          <div className={ab.empty}>
            <p className={ab.emptyTitle}>Nenhuma regra de roteamento configurada</p>
            <p className={ab.emptyText}>Todos os novos leads seguirão o fluxo padrão da fila geral da unidade. Crie a primeira regra para direcionar por tipo de plano, origem ou localidade.</p>
          </div>
        ) : (
          <>
            <ScrollArea orientation="horizontal" className={ab.desktopOnly}>
              <div className={ab.table} style={cols(template, 1040)} role="table" aria-label="Regras de roteamento">
                <div className={cn(ab.tr, ab.th)} role="row"><span>Prioridade</span><span>Regra</span><span>Destino</span><span>Condições</span><span>Distribuição</span><span>Status</span><span className={pl.srOnly}>Ações</span></div>
                {pages.pageRows.map((rule) => {
                  const index = rules.indexOf(rule);
                  const tags = conditionTags(rule);
                  const fallback = fallbackName(rule);
                  return (
                    <div key={rule.id} className={cn(ab.tr, ab.trBtn, !rule.enabled && ab.trOff)} role="row" tabIndex={0}
                      onClick={() => setOpenId(rule.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setOpenId(rule.id); } }}
                      aria-label={`Abrir regra ${rule.name}`}>
                      <span><span className={ab.prio}>#{rule.priority}</span></span>
                      <span className={ab.strong}>{rule.name}</span>
                      <span className={ab.cellText}><span className={ab.secondary}>{targetName(rule)}</span>{fallback ? <span className={ab.sub}>Reserva: {fallback}</span> : null}</span>
                      <span className={ab.secondary} title={tags.join(" · ")}>{tags.length ? tags.join(" · ") : "Qualquer lead"}</span>
                      <span className={ab.secondary}>{modeLabel(rule)}</span>
                      <span>{statusBadge(rule)}</span>
                      <span className={ab.rowMenu} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                        {canEdit ? <PlMenu trigger={<DotsIcon />} triggerClassName={cn(pl.iconbtn, pl.iconbtnGhost)} triggerLabel={`Ações da regra ${rule.name}`} items={menuItems(rule, index)} /> : null}
                      </span>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
            <div className={ab.mobileList}>
              {pages.pageRows.map((rule) => (
                <button key={rule.id} type="button" className={ab.mRow} onClick={() => setOpenId(rule.id)}>
                  <span className={ab.prio}>#{rule.priority}</span>
                  <span className={ab.cellText} style={{ flex: 1 }}><span className={ab.strong}>{rule.name}</span><span className={ab.sub}>{targetName(rule)}</span></span>
                  {statusBadge(rule)}
                </button>
              ))}
            </div>
            <TableFoot1a1 pages={pages} noun="regras" label="Páginas das regras" />
          </>
        )}
      </Section1a1>

      <PlSheet open={Boolean(open)} onOpenChange={(next) => { if (!next) setOpenId(null); }} title={open?.name ?? ""}
        badges={open ? <>{statusBadge(open)}<span className={pl.badge}>#{open.priority}</span><span className={pl.badge}>{modeLabel(open)}</span></> : null}
        footer={open && canEdit ? (
          <>
            <button type="button" className={cn(pl.pill, pl.pillPrimary, pl.pillWide)} onClick={() => { const rule = open; setOpenId(null); onEdit(rule); }}>Editar regra</button>
            <PlMenu side="top" trigger={<DotsIcon />} triggerClassName={pl.iconbtn} triggerLabel="Mais ações" items={menuItems(open, openIndex).filter((item) => item.label !== "Editar regra")} />
          </>
        ) : null}>
        {open ? (
          <dl className={ab.kv}>
            <dt>Destino</dt><dd>{targetName(open)}</dd>
            <dt>Fila reserva</dt><dd>{fallbackName(open) ?? "Nenhuma"}</dd>
            <dt>Distribuição</dt><dd>{modeLabel(open)}</dd>
            <dt>Condições</dt><dd>{conditionTags(open).length ? conditionTags(open).join(" · ") : "Qualquer lead"}</dd>
          </dl>
        ) : null}
      </PlSheet>

      <PlConfirm open={Boolean(confirmDelete)} onOpenChange={(next) => { if (!next) setConfirmDelete(null); }}
        title="Excluir esta regra de roteamento?" description="Os próximos leads deixam de seguir esta regra. Os leads já distribuídos não mudam."
        confirmLabel="Excluir regra" danger
        onConfirm={() => { const id = confirmDelete; setConfirmDelete(null); setOpenId(null); if (id) void onDelete(id); }} />
      {dialog}
    </>
  );
}
