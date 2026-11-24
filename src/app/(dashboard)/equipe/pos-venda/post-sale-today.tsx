"use client";

/**
 * "O que sai hoje" (24/11): por regra ligada, quem está pronto agora, quanto o motor ainda manda no dia e quanto
 * já saiu. O diretor pode enviar uma regra para os leads de um dia do marco, sem o limite diário, depois de
 * confirmar. Nada é gravado só por olhar.
 */
import { useState } from "react";

import { LiteConfirmDialog } from "@/components/lite/controls";
import page from "@/components/lite/page/lite-page.module.css";
import { forcePostSaleAutoRuleAction, previewPostSaleTodayAction } from "@/features/post-sale-audit/actions";
import { AUTO_RULE_DEFINITIONS, type AutoRuleKey } from "@/features/post-sale-audit/auto-rules";

import styles from "./post-sale.module.css";

type Today = Extract<Awaited<ReturnType<typeof previewPostSaleTodayAction>>, { ok: true }>["data"];
type Force = { key: AutoRuleKey; day: string; count: number };

const MILESTONE_VERB = { accepted: "aceitos", converted: "vendidos", lost: "perdidos" } as const;
const dayLabel = (day: string) => day.split("-").reverse().slice(0, 2).join("/");
const fmt = (value: number) => value.toLocaleString("pt-BR");

export function PostSaleToday({ canForce }: { canForce: boolean }) {
  const [today, setToday] = useState<Today | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<Force | null>(null);
  const [sending, setSending] = useState<Force | null>(null);
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    const result = await previewPostSaleTodayAction();
    setLoading(false);
    if (result.ok) setToday(result.data);
    else setError(result.error);
  }

  async function force(item: Force) {
    setConfirm(null);
    setSending(item);
    setNote(null);
    const result = await forcePostSaleAutoRuleAction({ key: item.key, milestoneDay: item.day });
    setSending(null);
    if (!result.ok) { setNote({ text: `${result.error} Nada foi enviado além do que já estava na fila.`, error: true }); return; }
    const { started, alreadyStarted, failed } = result.data;
    setNote({ text: `${item.key}: ${fmt(started)} ${started === 1 ? "pesquisa saiu" : "pesquisas saíram"}${alreadyStarted ? `, ${fmt(alreadyStarted)} já tinham recebido` : ""}${failed ? `, ${fmt(failed)} não ${failed === 1 ? "saiu" : "saíram"} pelo canal` : ""}.`, error: false });
    void load();
  }

  const enabled = today?.rules.filter((rule) => rule.enabled) ?? [];
  const total = enabled.reduce((sum, rule) => sum + rule.wouldSend, 0);

  return (
    <section className={page.card} aria-labelledby="pos-venda-hoje">
      <div className={styles.cardHeadRow}>
        <div className={page.cardHead}>
          <h2 id="pos-venda-hoje" className={page.cardTitle}>O que sai hoje</h2>
          <p className={page.cardDescription}>
            {today
              ? `${today.withinHours ? "Hoje" : `Na próxima abertura (${dayLabel(today.sendDay)})`} saem mais ${fmt(total)} pela régua. Já saíram ${fmt(today.tenantUsed)} de ${fmt(today.tenantLimit)} no dia da empresa.`
              : "Veja quem está pronto em cada regra ligada, antes de o motor mandar."}
          </p>
        </div>
        <button type="button" className={page.button} onClick={() => void load()} disabled={loading}>{loading ? "Calculando…" : today ? "Atualizar" : "Ver o que sai hoje"}</button>
      </div>

      {error ? <p className={styles.detail} role="alert">{error} <button type="button" className={page.cellLink} onClick={() => void load()}>Tentar de novo</button></p> : null}
      {note ? <p className={styles.detail} role={note.error ? "alert" : "status"}>{note.text}</p> : null}

      {today && !today.ready ? <p className={styles.detail}>A régua automática ainda não está instalada nesta empresa.</p> : null}
      {today?.ready ? (
        <ul className={styles.todayList}>
          {today.rules.map((rule) => {
            const verb = MILESTONE_VERB[AUTO_RULE_DEFINITIONS[rule.key].milestone];
            return (
              <li key={rule.key} className={styles.todayItem}>
                <div className={styles.todayHead}>
                  <span className={page.cellTitle}>{rule.key} {rule.label}</span>
                  {rule.enabled
                    ? <span className={page.numeric}>{fmt(rule.wouldSend)} {rule.wouldSend === 1 ? "sai" : "saem"} · {fmt(rule.eligible)} {rule.eligible === 1 ? "pronto" : "prontos"} · {fmt(rule.alreadySent)} de {fmt(rule.limit)} já no dia</span>
                    : <span className={page.badge}>Desligada</span>}
                </div>
                {rule.enabled && rule.byMilestoneDay.length ? (
                  <div className={styles.dayChips} role="group" aria-label={`Prontos da ${rule.key} por dia`}>
                    {rule.byMilestoneDay.map((item) => (
                      canForce ? (
                        <button key={item.day} type="button" className={styles.dayChip} disabled={Boolean(sending)} onClick={() => setConfirm({ key: rule.key, day: item.day, count: item.count })} aria-label={`Enviar ${rule.key} agora para ${item.count} ${verb} em ${dayLabel(item.day)}`}>
                          {sending?.key === rule.key && sending.day === item.day ? "Enviando…" : `${fmt(item.count)} ${verb} em ${dayLabel(item.day)}`}
                        </button>
                      ) : <span key={item.day} className={page.badge}>{fmt(item.count)} {verb} em {dayLabel(item.day)}</span>
                    ))}
                  </div>
                ) : null}
                {rule.enabled && !rule.eligible ? <span className={page.muted}>Ninguém pronto agora.</span> : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      {today?.ready && canForce && enabled.some((rule) => rule.eligible) ? <p className={page.muted}>Clique num dia para enviar a regra agora para esses leads, sem o limite do dia.</p> : null}

      <LiteConfirmDialog
        open={confirm !== null}
        title={confirm ? `Enviar ${confirm.key} agora?` : ""}
        confirmLabel="Enviar agora"
        onCancel={() => setConfirm(null)}
        onConfirm={() => { if (confirm) void force(confirm); }}
        description={confirm ? (
          <span>
            {fmt(confirm.count)} {confirm.count === 1 ? "cliente recebe" : "clientes recebem"} a {confirm.key} {AUTO_RULE_DEFINITIONS[confirm.key].label} pelo número de origem, sem o limite do dia ({MILESTONE_VERB[AUTO_RULE_DEFINITIONS[confirm.key].milestone]} em {dayLabel(confirm.day)}). Fora do horário comercial, sai na próxima abertura. Quem já recebeu não recebe de novo.
          </span>
        ) : null}
      />
    </section>
  );
}
