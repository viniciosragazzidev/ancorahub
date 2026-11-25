/**
 * Corpo do hub Atendimento IA (/ia): resumo vivo no topo e três seções em lista de linhas Lite (Configurar, Ensinar,
 * Acompanhar). Cada linha abre a tela que já existe; nada aqui muda dado.
 */
import Link from "next/link";
import {
  Activity,
  BellRing,
  BookOpen,
  ChevronRight,
  FlaskConical,
  Lightbulb,
  ListChecks,
  MessageSquareText,
  MessagesSquare,
  Repeat,
  RotateCcw,
  ShieldCheck,
  Users,
  Wifi,
  Workflow,
  Zap,
  type LucideIcon,
} from "lucide-react";

import page from "@/components/lite/page/lite-page.module.css";
import sections from "@/components/lite/page/lite-sections.module.css";
import type { AiHubSection, AiHubSummaryItem } from "@/features/ai-qualification/ai-area-hub";

import hub from "./ia-hub.module.css";

const ICONS: Record<string, LucideIcon> = {
  comportamento: MessageSquareText,
  permissoes: ShieldCheck,
  "follow-up": Repeat,
  perguntas: ListChecks,
  fluxos: Workflow,
  situacoes: Lightbulb,
  mensagens: MessagesSquare,
  base: BookOpen,
  "leads-qualificacao": Users,
  recuperacao: RotateCcw,
  turbo: Zap,
  alertas: BellRing,
  execucoes: Activity,
  simulador: FlaskConical,
  conectividade: Wifi,
};

export function AiHubView({ summary, sections: list }: { summary: AiHubSummaryItem[]; sections: AiHubSection[] }) {
  return (
    <>
      <section className={page.stats} aria-label="Resumo agora">
        {summary.map((item) => {
          const body = (
            <>
              <span className={page.statLabel}>{item.label}</span>
              {item.id === "status" && item.tone ? (
                <span><span className={page.badge} data-tone={item.tone}>{item.value}</span></span>
              ) : (
                <span className={page.statValue}>{item.value}</span>
              )}
            </>
          );
          return item.href ? (
            <Link key={item.id} href={item.href} className={`${page.stat} ${hub.statLink}`}>{body}</Link>
          ) : (
            <div key={item.id} className={page.stat}>{body}</div>
          );
        })}
      </section>
      {list.map((section) => (
        <section key={section.id} className={sections.group} aria-labelledby={`ia-${section.id}`}>
          <div className={sections.row}>
            <div className={sections.rowText}>
              <h2 id={`ia-${section.id}`} className={sections.rowTitle}>{section.title}</h2>
              <p className={sections.rowDescription}>{section.description}</p>
            </div>
          </div>
          <ul className={sections.list}>
            {section.rows.map((row) => {
              const Icon = ICONS[row.id] ?? ChevronRight;
              return (
                <li key={row.id}>
                  <Link href={row.href} className={`${sections.itemButton} ${hub.rowLink}`}>
                    <span className={hub.lead}>
                      <Icon aria-hidden="true" size={20} className={hub.icon} />
                      <span className={sections.itemText}>
                        <span className={sections.itemTitle}>{row.label}</span>
                        <span className={sections.itemSub}>{row.description}</span>
                      </span>
                    </span>
                    <span className={hub.end}>
                      {row.count ? <span>{row.count}</span> : null}
                      <ChevronRight aria-hidden="true" size={16} />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );
}
