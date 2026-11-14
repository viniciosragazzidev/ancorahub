"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowRight, CalendarDays, Check, Clock3, LayoutGrid, MessageCircle, Search, Plus } from "lucide-react";
import { Button } from "@/components/arc/button/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useLightAvailabilityContext } from "@/components/light/light-availability-context";
import { Button as ActionButton } from "@/components/ui/button";
import { LitePress } from "@/components/lite/motion";
import { PresenceCalloutList } from "./presence-callout";
import type { HomeSummary } from "./chat-home";
import type { HomeNowItem, PresenceAskView, ThreadSummary } from "./types";
import page from "@/components/lite/page/lite-page.module.css";
import layout from "./broker-home-overview.module.css";

// Preserve the existing client-only boundary around the acceptance Server Action.
const AcceptLeadButton = dynamic(() => import("@/features/broker-workspace/components/accept-lead-button").then((module) => module.AcceptLeadButton), {
  ssr: false,
  loading: () => <ActionButton disabled className={page.primaryButton}>Preparando ação…</ActionButton>,
});

function deadline(expiresAt: string | undefined, now: number) {
  if (!expiresAt) return null;
  const minutes = Math.ceil((Date.parse(expiresAt) - now) / 60_000);
  return minutes <= 0 ? "Prazo encerrado. Atualize sua fila." : `Aceite em até ${minutes} min`;
}

function ItemAction({
  item,
  expired,
  primary = false,
}: {
  item: HomeNowItem;
  expired: boolean;
  primary?: boolean;
}) {
  // Uma ação primária por tela: só o "Seu próximo passo" usa o botão cheio; o resto da lista fica secundário.
  if (item.acceptLeadId) {
    return (
      <AcceptLeadButton leadId={item.acceptLeadId} appearance="shared" disabled={expired} className={primary ? undefined : layout.secondaryAction}>
        {expired ? "Oferta encerrada" : item.actionLabel}
      </AcceptLeadButton>
    );
  }
  const link = (
    <Link href={item.href} className={primary ? page.primaryButton : page.button}>
      {item.actionLabel}
      <ArrowRight size={16} aria-hidden="true" />
    </Link>
  );
  // O link primário não passa pelo Button (que já tem toque): ganha a escala de toque do Lite.
  return primary ? <LitePress className={layout.press}>{link}</LitePress> : link;
}

export function BrokerHomeOverview({
  viewerName,
  nowIso,
  summary,
  nextLead,
  rail,
  conversations,
  presenceAsks,
  learning,
  onSearch,
  onNew,
}: {
  viewerName: string;
  nowIso: string;
  summary: HomeSummary | null;
  nextLead: ThreadSummary | null;
  rail: ReactNode;
  conversations: ReactNode;
  presenceAsks: PresenceAskView[];
  learning: ReactNode;
  onSearch: () => void;
  onNew: () => void;
}) {
  const shell = useLightAvailabilityContext();
  const [clock, setClock] = useState(() => Date.parse(nowIso));
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);
  const firstName = viewerName.split(/\s+/)[0] || viewerName;
  const now = new Date(nowIso);
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(now),
  );
  const date = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);
  const items = summary?.now?.items ?? [];
  const focus: HomeNowItem | null =
    items[0] ??
    (summary?.next
      ? ({
          id: "next",
          title: summary.next.label,
          detail: summary.next.detail,
          actionLabel: summary.next.label,
          href: summary.next.href,
          acceptLeadId: summary.next.acceptLeadId,
          tone: summary.next.urgent ? "urgent" : "normal",
        } satisfies HomeNowItem)
      : nextLead
        ? {
            id: nextLead.id,
            title: nextLead.name,
            detail: "Há uma conversa esperando sua atenção.",
            actionLabel: "Abrir conversa",
            href: nextLead.href,
          }
        : null);
  const expiresAt = focus && "expiresAt" in focus ? focus.expiresAt : undefined;
  const expired = Boolean(expiresAt && Date.parse(expiresAt) <= clock);
  const paused = shell?.availability === "paused";
  const tools =
    shell?.homeTools?.filter((item) =>
      ["/clientes", "/cotacao", "/plantoes"].includes(item.href),
    ) ?? [];
  const stats = summary
    ? [
        { label: "Recebidos hoje", value: summary.receivedToday },
        { label: "Aceitos hoje", value: summary.acceptedToday },
        { label: "Em atendimento", value: summary.inServiceNow },
        { label: "Contato atrasando", value: summary.slaAtRiskNow },
      ]
    : [];

  return (
    <div className={layout.shell} data-broker-home="v2">
      <div className={layout.rail}>{rail}</div>
      <section className={layout.main} aria-label="Área de trabalho do corretor">
        <div className={layout.content}>
          <header className={layout.header}>
            <div>
              <p className={layout.date}>{date}</p>
              <h1 className={layout.title}>
                {hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite"}, {firstName}.
              </h1>
              <p className={layout.subtitle}>Seu trabalho, um próximo passo de cada vez.</p>
            </div>
            <div className={layout.headerActions}>
              <Badge variant={paused ? "warning" : "success"}>
                {paused ? "Recebimento pausado" : "Disponível"}
              </Badge>
              <Button variant="ghost" className={`${page.iconButton} ${layout.mobileAction}`} aria-label="Buscar minhas conversas" onClick={onSearch}><Search size={18} aria-hidden="true" /></Button>
              <Button variant="ghost" className={`${page.iconButton} ${layout.mobileAction}`} aria-label="Nova ação" onClick={onNew}><Plus size={18} aria-hidden="true" /></Button>
              <Button variant="ghost" onClick={(event) => shell?.openMore?.(event.currentTarget)}>
                <LayoutGrid size={16} aria-hidden="true" />
                Ferramentas
              </Button>
            </div>
          </header>

          {paused ? (
            <div className={layout.availability} role="status">
              <span>Você continua atendendo sua carteira. Novas ofertas ficam pausadas.</span>
              <Button
                variant="secondary"
                loading={shell?.isPending}
                onClick={() => shell?.setStatus("available")}
              >
                Ficar disponível
              </Button>
            </div>
          ) : null}
          <PresenceCalloutList asks={presenceAsks} />

          <section className={`${page.card} ${layout.focus}`} aria-labelledby="broker-next-title">
            <div className={layout.sectionHeading}>
              <span className={layout.eyebrow}>Seu próximo passo</span>
              {focus ? (
                <Badge variant={focus.tone === "urgent" ? "warning" : "outline"}>
                  {focus.acceptLeadId ? "Oferta de lead" : "Precisa de atenção"}
                </Badge>
              ) : (
                <Badge variant="success">Tudo em dia</Badge>
              )}
            </div>
            {focus ? (
              <>
                <h2 id="broker-next-title" className={layout.focusTitle}>
                  {focus.title}
                </h2>
                <p className={layout.description}>{focus.detail}</p>
                {expiresAt ? (
                  <p className={layout.deadline}>
                    <Clock3 size={15} aria-hidden="true" />
                    {deadline(expiresAt, clock)}
                  </p>
                ) : null}
                <div className={layout.focusActions}>
                  <ItemAction key={focus.id} item={focus} expired={expired} primary />
                  {focus.acceptLeadId ? (
                    <p className={layout.actionHint}>
                      Ao aceitar, o atendimento começa e o WhatsApp é aberto.
                    </p>
                  ) : null}
                  {expired ? (
                    <Link href="/leads?tab=minha-fila" className={page.button}>
                      Atualizar minha fila
                    </Link>
                  ) : null}
                </div>
              </>
            ) : (
              <>
                <h2 id="broker-next-title" className={layout.focusTitle}>
                  Tudo em dia por aqui.
                </h2>
                <p className={layout.description}>
                  Nenhum aceite, resposta ou retorno pendente agora. Você pode continuar seus
                  atendimentos.
                </p>
                <Link href="/leads?tab=minha-fila" className={page.button}>
                  <MessageCircle size={16} aria-hidden="true" />
                  Abrir minha fila
                </Link>
              </>
            )}
          </section>

          {items.length > 1 ? (
            <section aria-labelledby="broker-pending-title" className={layout.pending}>
              <div className={layout.sectionHeading}>
                <h2 id="broker-pending-title" className={page.cardTitle}>
                  Também precisa de você
                </h2>
                <span className={layout.muted}>
                  {items.length - 1} {items.length === 2 ? "pendência" : "pendências"}
                </span>
              </div>
              <ul className={layout.pendingList}>
                {items.slice(1).map((item) => (
                  <li key={item.id} className={layout.pendingRow}>
                    <span className={layout.itemIcon}>
                      <MessageCircle size={18} aria-hidden="true" />
                    </span>
                    <div className={layout.itemCopy}>
                      <strong>{item.title}</strong>
                      <p>{item.detail}</p>
                    </div>
                    <ItemAction
                      item={item}
                      expired={Boolean(item.expiresAt && Date.parse(item.expiresAt) <= clock)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {stats.length ? (
            <section aria-label="Seu dia em números" className={layout.numbers}>
              <dl>
                {stats.map((stat) => (
                  <div key={stat.label}>
                    <dt>{stat.label}</dt>
                    <dd>{stat.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          <section className={layout.tools} aria-labelledby="broker-tools-title">
            <div className={layout.sectionHeading}>
              <h2 id="broker-tools-title" className={page.cardTitle}>
                Seu espaço de trabalho
              </h2>
              <Button variant="ghost" onClick={(event) => shell?.openMore?.(event.currentTarget)}>
                Ver ferramentas
                <ArrowRight size={16} aria-hidden="true" />
              </Button>
            </div>
            <nav aria-label="Atalhos de trabalho" className={page.toolbar}>
              <Link href="/leads?tab=minha-fila" className={page.button}>
                Minha fila
              </Link>
              {tools.map((tool) => (
                <Link key={tool.href} href={tool.href} className={page.button}>
                  {tool.label}
                </Link>
              ))}
            </nav>
          </section>

          {summary?.duty ? (
            <LitePress kind="card">
              <Link href={summary.duty.href} className={`${page.card} ${layout.duty}`}>
                <CalendarDays size={22} aria-hidden="true" />
                <span>
                  <strong>{summary.duty.title}</strong>
                  <span>{summary.duty.detail}</span>
                </span>
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
            </LitePress>
          ) : null}
          {summary?.goal ? (
            <section className={page.card} aria-label="Minha meta">
              <div className={layout.sectionHeading}>
                <h2 className={page.cardTitle}>{summary.goal.name}</h2>
                <Link href="/desempenho" className={page.button}>
                  Ver desempenho
                </Link>
              </div>
              <Progress
                value={Math.min(100, Math.max(0, summary.goal.percentage))}
                aria-label={summary.goal.name}
              />
              <p className={layout.description}>
                {summary.goal.currentValue} de {summary.goal.targetValue} ·{" "}
                {summary.goal.percentage}%
              </p>
            </section>
          ) : null}
          {learning && shell?.showHomeLearning !== false ? (
            <details className={layout.learning}>
              <summary>
                <span>
                  <Check size={16} aria-hidden="true" />
                  Meu acompanhamento
                </span>
                <span className={layout.muted}>Jornada e primeiros passos</span>
              </summary>
              <div className={layout.learningContent}>{learning}</div>
            </details>
          ) : null}
          <section
            className={layout.mobileConversations}
            aria-labelledby="broker-conversations-title"
          >
            <h2 id="broker-conversations-title" className={page.cardTitle}>
              Suas conversas
            </h2>
            {conversations}
          </section>
        </div>
      </section>
    </div>
  );
}
