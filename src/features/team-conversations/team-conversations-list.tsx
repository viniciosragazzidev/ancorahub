"use client";

import { useMemo, useState } from "react";

import { PeopleEmpty, PeopleFilters, PeoplePage, PeopleRow, PeopleSection, PeopleStats } from "@/components/light/people-list/people-list";

import type { TeamConversationSummary } from "./types";

type Filter = "todas" | "aguardando" | "ia";

export function formatWhen(iso: string, now = new Date()) {
  const date = new Date(iso);
  const sameDay = date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) === now.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  return sameDay
    ? date.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
}

/** The conversations of the brokers the viewer manages: who is talking to whom, and who is waiting for an answer. */
export function TeamConversationsList({ conversations, scopeLabel }: { conversations: TeamConversationSummary[]; scopeLabel: "unidade" | "equipe" }) {
  const [filter, setFilter] = useState<Filter>("todas");
  const [query, setQuery] = useState("");
  const waiting = conversations.filter((item) => item.lastFromClient).length;
  const brokers = new Set(conversations.map((item) => item.brokerId).filter(Boolean)).size;

  const visible = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    return conversations.filter((item) => {
      if (filter === "aguardando" && !item.lastFromClient) return false;
      if (filter === "ia" && !item.lastByAi) return false;
      if (!term) return true;
      return item.leadName.toLocaleLowerCase("pt-BR").includes(term) || (item.brokerName ?? "").toLocaleLowerCase("pt-BR").includes(term);
    });
  }, [conversations, filter, query]);

  const filters: Array<{ id: Filter; label: string; count?: number }> = [
    { id: "todas", label: "Todas", count: conversations.length },
    { id: "aguardando", label: "Cliente esperando", count: waiting },
    { id: "ia", label: "Com IA" },
  ];

  return (
    <PeoplePage title={`Mensagens da ${scopeLabel}`} subtitle={`As conversas de WhatsApp dos corretores da sua ${scopeLabel}. Somente leitura.`}>
      <PeopleStats label="Resumo das conversas" items={[
        { value: conversations.length, label: "Conversas" },
        { value: waiting, label: "Cliente esperando resposta", alert: waiting > 0 },
        { value: brokers, label: "Corretores conversando" },
      ]} />
      <PeopleFilters label="Filtrar conversas" options={filters} value={filter} onChange={setFilter} search={query} onSearch={setQuery} searchPlaceholder="Buscar por cliente ou corretor" />
      {visible.length ? (
        <PeopleSection>
          {visible.map((item, index) => (
            <PeopleRow
              key={item.leadId}
              index={index}
              href={`/mensagens/${encodeURIComponent(item.leadId)}`}
              name={item.leadName}
              chip={item.brokerName ?? "Sem corretor"}
              preview={`${item.lastFromClient ? "Cliente: " : item.lastByAi ? "IA: " : "Corretor: "}${item.lastBody || "Mídia"}`}
              previewTone={item.lastFromClient ? "waiting" : "muted"}
              meta={formatWhen(item.lastAt)}
              dot={item.lastFromClient ? "waiting" : null}
              dotLabel="Cliente esperando resposta"
            />
          ))}
        </PeopleSection>
      ) : (
        <PeopleEmpty
          title={conversations.length ? "Nenhuma conversa neste filtro" : "Ainda não há conversas"}
          description={conversations.length ? "Troque o filtro ou a busca para ver outras conversas." : `Quando os corretores da sua ${scopeLabel} conversarem pelo WhatsApp conectado, as mensagens aparecem aqui.`}
        />
      )}
    </PeoplePage>
  );
}
