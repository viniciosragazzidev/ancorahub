"use client";

/**
 * Equipes (16/11/2026): lista das equipes (uma por supervisora) e a página de cada uma, com os corretores, os
 * leads enviados pela empresa e os leads da lista importada pela supervisora em abas separadas. Mesmo padrão da
 * aba Membros: tabela no computador, cartões no celular, busca e paginação.
 */
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { LiteResponsiveData, type LiteColumn } from "@/components/lite/data/data";
import { LitePagination, useLitePages } from "@/components/lite/data/pagination";
import { liteDateFormatter } from "@/components/lite/format/date";
import page from "@/components/lite/page/lite-page.module.css";
import { formatLeadPhone } from "@/features/leads/format-lead-phone";
import { LEAD_STATUS_LABELS } from "@/features/leads/lead-status-constants";
import { teamAvatarHue } from "@/features/supervisor-workspace/my-team-page";
import type { TeamBroker, TeamDetail, TeamLeadRow, TeamSummary } from "@/features/team/teams-overview";

import styles from "./team-lite.module.css";

const fmt = (n: number) => n.toLocaleString("pt-BR");
const normalize = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const initialsOf = (name: string) => name.split(/\s+/).filter((word) => word.length > 2 || /^[A-ZÀ-Ú]/.test(word)).slice(0, 2).map((word) => word[0]?.toUpperCase()).join("") || "E";

/** Logo da equipe: a foto que a supervisora salvou ou as iniciais na cor da equipe (mesma cor do perfil dela). */
function TeamLogo({ name, image, size }: { name: string; image: string | null; size: "sm" | "lg" }) {
  return (
    <span className={styles.teamLogo} data-size={size} style={{ "--team-hue": teamAvatarHue(name) } as React.CSSProperties} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element -- foto pequena salva como data URL no perfil da equipe */}
      {image ? <img src={image} alt="" /> : <span>{initialsOf(name.replace(/^Equipe\s+/i, ""))}</span>}
    </span>
  );
}

const AVAILABILITY: Record<string, string> = { available: "Disponível", paused: "Pausado", offline: "Offline", busy: "Ocupado" };

function SearchBox({ value, onChange, label, placeholder }: { value: string; onChange: (value: string) => void; label: string; placeholder: string }) {
  return (
    <div className={page.toolbar}>
      <label className={page.search}>
        <Search aria-hidden="true" size={18} className={page.searchIcon} />
        <input type="search" className={page.searchInput} aria-label={label} placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} />
      </label>
    </div>
  );
}

export function TeamsListLite({ teams }: { teams: TeamSummary[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const rows = useMemo(() => {
    const q = normalize(query.trim());
    return q ? teams.filter((team) => normalize(team.teamName).includes(q) || normalize(team.supervisorName).includes(q) || normalize(team.branchName ?? "").includes(q)) : teams;
  }, [teams, query]);
  const columns: LiteColumn<TeamSummary>[] = [
    {
      id: "team", label: "Equipe", primary: true,
      render: (team) => (
        <span className={styles.teamCell}>
          <TeamLogo name={team.teamName} image={team.teamImage} size="sm" />
          <Link href={`/equipe/equipes/${encodeURIComponent(team.supervisorId)}`} className={`${page.cellTitle} ${page.cellLink}`}>{team.teamName}</Link>
        </span>
      ),
    },
    { id: "supervisor", label: "Supervisora", secondary: true, nowrap: true, render: (team) => team.supervisorName },
    { id: "branch", label: "Unidade", render: (team) => team.branchName ?? "Sem unidade" },
    { id: "brokers", label: "Corretores", numeric: true, render: (team) => fmt(team.brokers) },
    { id: "company", label: "Leads da empresa em aberto", numeric: true, render: (team) => fmt(team.companyOpen) },
    { id: "list", label: "Lista importada", numeric: true, render: (team) => fmt(team.listTotal) },
    { id: "pending", label: "Para distribuir", numeric: true, render: (team) => fmt(team.listPending) },
    { id: "replied", label: "Responderam", numeric: true, render: (team) => fmt(team.listReplied) },
  ];
  return (
    <section className={page.stack} aria-label="Equipes">
      <SearchBox value={query} onChange={setQuery} label="Buscar equipe" placeholder="Buscar pela supervisora ou unidade" />
      <LiteResponsiveData
        caption="Equipes da corretora"
        columns={columns}
        rows={rows}
        rowKey={(team) => team.supervisorId}
        onRowOpen={(team) => router.push(`/equipe/equipes/${encodeURIComponent(team.supervisorId)}`)}
        empty={<p>{query ? "Nenhuma equipe com essa busca." : "Nenhuma supervisora ativa ainda. As equipes aparecem aqui quando houver supervisoras com corretores."}</p>}
      />
    </section>
  );
}

type Tab = "corretores" | "empresa" | "lista";

export function TeamDetailLite({ detail, tab, canViewProfile }: { detail: TeamDetail; tab: Tab; canViewProfile: boolean }) {
  const base = `/equipe/equipes/${encodeURIComponent(detail.supervisor.id)}`;
  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "corretores", label: `Corretores (${fmt(detail.brokers.length)})` },
    { id: "empresa", label: `Leads da empresa (${fmt(detail.totals.company)})` },
    { id: "lista", label: `Lista importada (${fmt(detail.totals.list)})` },
  ];
  return (
    <div className={page.stack}>
      <section className={styles.teamHero} aria-label="Equipe">
        <TeamLogo name={detail.team.name} image={detail.team.image} size="lg" />
        <span className={styles.teamHeroText}>
          <strong>{detail.team.name}</strong>
          <span>{detail.team.description || `Supervisão de ${detail.supervisor.name}`}</span>
        </span>
      </section>
      <section className={page.stats} aria-label="Resumo da equipe">
        <div className={page.stat}><span className={page.statLabel}>Supervisora</span><span className={page.statValue}>{detail.supervisor.name}</span><span className={page.statHint}>{[detail.supervisor.branchName ?? "Sem unidade", AVAILABILITY[detail.supervisor.availability] ?? detail.supervisor.availability].join(" · ")}</span></div>
        <div className={page.stat}><span className={page.statLabel}>Corretores</span><span className={page.statValue}>{fmt(detail.brokers.length)}</span></div>
        <div className={page.stat}><span className={page.statLabel}>Lista para distribuir</span><span className={page.statValue}>{fmt(detail.totals.listPending)}</span></div>
        <div className={page.stat}><span className={page.statLabel}>Lista que respondeu</span><span className={page.statValue}>{fmt(detail.totals.listReplied)}</span></div>
      </section>
      <nav className={styles.tabs} aria-label="Dados da equipe">
        {tabs.map((item) => <Link key={item.id} href={`${base}?aba=${item.id}`} className={styles.tab} aria-current={tab === item.id ? "page" : undefined}>{item.label}</Link>)}
      </nav>
      {tab === "corretores" ? <BrokersTable brokers={detail.brokers} canViewProfile={canViewProfile} /> : null}
      {tab === "empresa" ? <LeadsTable key="empresa" rows={detail.companyLeads} kind="empresa" total={detail.totals.company} /> : null}
      {tab === "lista" ? <LeadsTable key="lista" rows={detail.listLeads} kind="lista" total={detail.totals.list} /> : null}
    </div>
  );
}

function BrokersTable({ brokers, canViewProfile }: { brokers: TeamBroker[]; canViewProfile: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const rows = useMemo(() => {
    const q = normalize(query.trim());
    return q ? brokers.filter((broker) => normalize(broker.name).includes(q) || normalize(broker.email).includes(q)) : brokers;
  }, [brokers, query]);
  const columns: LiteColumn<TeamBroker>[] = [
    // Nome do corretor abre o perfil dele (o mesmo da aba Membros).
    { id: "name", label: "Corretor", primary: true, nowrap: true, render: (broker) => (canViewProfile ? <Link href={`/equipe/${encodeURIComponent(broker.id)}`} className={`${page.cellTitle} ${page.cellLink}`} title={broker.name}>{broker.name}</Link> : broker.name) },
    { id: "email", label: "E-mail", secondary: true, render: (broker) => broker.email },
    { id: "availability", label: "Situação", render: (broker) => <span className={page.badge} data-tone={broker.availability === "available" ? "success" : undefined}>{AVAILABILITY[broker.availability] ?? broker.availability}</span> },
    { id: "company", label: "Leads da empresa em aberto", numeric: true, render: (broker) => fmt(broker.companyOpen) },
    { id: "list", label: "Da lista em aberto", numeric: true, render: (broker) => fmt(broker.listOpen) },
  ];
  return (
    <section className={page.stack} aria-label="Corretores da equipe">
      <SearchBox value={query} onChange={setQuery} label="Buscar corretor" placeholder="Buscar por nome ou e-mail" />
      <LiteResponsiveData caption="Corretores da equipe" columns={columns} rows={rows} rowKey={(broker) => broker.id} onRowOpen={canViewProfile ? (broker) => router.push(`/equipe/${encodeURIComponent(broker.id)}`) : undefined} empty={<p>{query ? "Nenhum corretor com essa busca." : "Esta equipe ainda não tem corretores ativos."}</p>} />
    </section>
  );
}

function LeadsTable({ rows: all, kind, total }: { rows: TeamLeadRow[]; kind: "empresa" | "lista"; total: number }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [only, setOnly] = useState<"all" | "pending" | "replied">("all");
  const rows = useMemo(() => {
    const q = normalize(query.trim());
    const digits = query.replace(/\D/g, "");
    return all.filter((lead) => {
      if (only === "pending" && lead.brokerName) return false;
      if (only === "replied" && !lead.replied) return false;
      if (!q) return true;
      return normalize(lead.name).includes(q) || normalize(lead.brokerName ?? "").includes(q) || Boolean(digits && lead.phone.includes(digits));
    });
  }, [all, query, only]);
  const { pageRows, pagination, reset } = useLitePages(rows, 50);
  // Lead da lista sem resposta não abre para a gestão (só aparece aqui); os demais abrem a ficha.
  const canOpen = (lead: TeamLeadRow) => kind === "empresa" || lead.replied;
  const columns: LiteColumn<TeamLeadRow>[] = [
    { id: "name", label: "Lead", primary: true, render: (lead) => (canOpen(lead) ? <Link href={`/leads/${encodeURIComponent(lead.id)}`}>{lead.name}</Link> : lead.name) },
    { id: "phone", label: "Telefone", secondary: true, render: (lead) => formatLeadPhone(lead.phone) },
    { id: "broker", label: "Corretor", nowrap: true, render: (lead) => lead.brokerName ?? (kind === "lista" ? "Para distribuir" : "Sem corretor") },
    { id: "status", label: "Etapa", render: (lead) => (kind === "lista" && !lead.brokerName ? "Para distribuir" : LEAD_STATUS_LABELS[lead.status] ?? lead.status) },
    ...(kind === "lista" ? [{ id: "replied", label: "Respondeu", render: (lead: TeamLeadRow) => (lead.replied ? <span className={page.badge} data-tone="success">Respondeu</span> : "Ainda não") } satisfies LiteColumn<TeamLeadRow>] : []),
    { id: "date", label: kind === "lista" ? "Importado em" : "Recebido em", phonePriority: "low", render: (lead) => liteDateFormatter({ day: "2-digit", month: "short", year: "numeric" }).format(new Date(lead.date)) },
  ];
  const label = kind === "lista" ? "Leads da lista importada" : "Leads enviados pela empresa";
  return (
    <section className={page.stack} aria-label={label}>
      <div className={page.toolbar}>
        <label className={page.search}>
          <Search aria-hidden="true" size={18} className={page.searchIcon} />
          <input type="search" className={page.searchInput} aria-label="Buscar lead" placeholder="Buscar por nome, telefone ou corretor" value={query} onChange={(event) => { setQuery(event.target.value); reset(); }} />
        </label>
        {kind === "lista" ? (
          <nav className={styles.tabs} aria-label="Situação da lista">
            {([["all", "Todos"], ["pending", "Para distribuir"], ["replied", "Responderam"]] as const).map(([id, text]) => (
              <button key={id} type="button" className={styles.tab} aria-current={only === id ? "page" : undefined} onClick={() => { setOnly(id); reset(); }}>{text}</button>
            ))}
          </nav>
        ) : null}
      </div>
      {total > all.length ? <p className={page.statHint}>{`Mostrando os ${fmt(all.length)} mais recentes de ${fmt(total)}.`}</p> : null}
      <LiteResponsiveData
        caption={label}
        columns={columns}
        rows={pageRows}
        rowKey={(lead) => lead.id}
        onRowOpen={(lead) => { if (canOpen(lead)) router.push(`/leads/${encodeURIComponent(lead.id)}`); }}
        empty={<p>{query || only !== "all" ? "Nenhum lead com esse filtro." : kind === "lista" ? "A supervisora ainda não importou nenhuma lista." : "Nenhum lead da empresa com esta equipe."}</p>}
      />
      <LitePagination {...pagination} label={`Paginação: ${label}`} />
    </section>
  );
}
