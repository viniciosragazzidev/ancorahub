"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/arc/badge/badge";
import { Button } from "@/components/arc/button/button";
import { PeopleEmpty, PeopleFilters, PeoplePage, PeopleRow, PeopleSection, PeopleStats } from "@/components/light/people-list/people-list";
import { buildWhatsAppUrl } from "@/lib/whatsapp-url";

export type LightClientItem = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  convertedAt: Date | string;
  brokerName?: string | null;
  /** The contract status (active or cancelled) when the client has one; the gestor list filters on it. */
  status?: string | null;
};

type StatusFilter = "all" | "active" | "cancelled";

/** Pill on the row, the same small rounded tag the broker's lead list uses. */
const statusPill = {
  active: { label: "Cliente ativo", tone: "info" },
  cancelled: { label: "Cancelado", tone: "neutral" },
} as const;

const secondaryAction =
  "inline-flex h-10 items-center justify-center rounded-full bg-(--surface-muted) px-4 text-sm font-semibold text-(--foreground)";

const monthFormat = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });

/** "setembro de 2026" -> "Setembro 2026", the same header style as the broker's lead list. */
function monthLabel(value: Date | string) {
  const label = monthFormat.format(new Date(value)).replace(" de ", " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * Clientes of the broker in the phone-book list: one row per client (opens the client) with WhatsApp beside it.
 * `management`: the gestor and supervisor screen (big title, count blocks and months as groups);
 * the broker keeps the compact header and the flat list.
 */
export function LightClientsList({ clients, management = false }: { clients: LightClientItem[]; management?: boolean }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");

  const filteredClients = useMemo(() => {
    const byStatus = management && filter !== "all" ? clients.filter((c) => c.status === filter) : clients;
    if (!searchQuery.trim()) return byStatus;
    const q = searchQuery.toLowerCase().trim();
    return byStatus.filter((c) => c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q)));
  }, [clients, searchQuery, filter, management]);

  const activeCount = clients.filter((c) => c.status === "active").length;
  const cancelledCount = clients.filter((c) => c.status === "cancelled").length;

  /** Management groups keep the list order (most recent first) and open a header per month. */
  const groups = useMemo(() => {
    const byMonth = new Map<string, { label: string; items: LightClientItem[] }>();
    for (const client of filteredClients) {
      const label = monthLabel(client.convertedAt);
      const group = byMonth.get(label) ?? { label, items: [] };
      group.items.push(client);
      byMonth.set(label, group);
    }
    return [...byMonth.values()];
  }, [filteredClients]);

  const searching = searchQuery.trim().length > 0;

  function renderClient(client: LightClientItem, index: number) {
    const convertedDate = new Date(client.convertedAt).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      timeZone: "America/Sao_Paulo",
    });
    const waUrl = buildWhatsAppUrl(client.phone);
    const pill = management && client.status && client.status in statusPill ? statusPill[client.status as keyof typeof statusPill] : null;

    return (
      <PeopleRow
        key={client.id}
        index={index}
        href={`/clientes/${client.id}`}
        name={client.name}
        chip={pill ? <Badge tone={pill.tone} size="sm">{pill.label}</Badge> : client.brokerName ?? undefined}
        preview={[client.brokerName && pill ? `Com ${client.brokerName}` : null, client.phone].filter(Boolean).join(" · ") || "Venda concluída"}
        meta={convertedDate}
        action={waUrl ? <a href={waUrl} target="_blank" rel="noopener noreferrer" className={secondaryAction}>WhatsApp</a> : undefined}
      />
    );
  }

  const countLabel = clients.length === 1 ? "1 cliente conquistado" : `${clients.length} clientes conquistados`;

  return (
    <PeoplePage title="Clientes" hideTitle={!management} subtitle={countLabel}>
      {management ? (
        <PeopleStats items={[
          { value: clients.length, label: "Clientes" },
          { value: new Set(clients.map((client) => client.brokerName ?? "")).size, label: "Corretores com clientes" },
        ]} />
      ) : null}

      <PeopleFilters
        label="Filtrar clientes por situação"
        options={management ? [
          { id: "all" as StatusFilter, label: "Todos", count: clients.length },
          { id: "active" as StatusFilter, label: "Ativos", count: activeCount },
          { id: "cancelled" as StatusFilter, label: "Cancelados", count: cancelledCount },
        ] : undefined}
        value={filter}
        onChange={setFilter}
        search={searchQuery}
        onSearch={setSearchQuery}
        searchPlaceholder="Buscar por nome ou telefone"
        searchLabel="Buscar cliente"
      />

      {filteredClients.length > 0 ? (
        management ? (
          groups.map((group) => (
            <PeopleSection key={group.label} id={`clientes-${group.label.replace(/\s+/g, "-")}`} title={group.label} count={group.items.length}>
              {group.items.map(renderClient)}
            </PeopleSection>
          ))
        ) : (
          <PeopleSection label="Clientes">{filteredClients.map(renderClient)}</PeopleSection>
        )
      ) : (
        <PeopleEmpty
          title={searching ? `Nenhum resultado para "${searchQuery.trim()}"` : "Nenhum cliente ainda"}
          description={searching ? "Tente outro nome ou telefone." : "Quando você concluir uma venda, o cliente aparece aqui."}
          action={searching ? <Button variant="secondary" onClick={() => setSearchQuery("")}>Limpar busca</Button> : undefined}
        />
      )}
    </PeoplePage>
  );
}
