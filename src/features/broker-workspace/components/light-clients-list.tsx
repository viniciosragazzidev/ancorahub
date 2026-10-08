"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { UserCheck, WhatsappLogo } from "@/components/huge-icons";
import { Avatar } from "@/components/arc/avatar/avatar";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { SearchField } from "@/components/arc/search-field/search-field";
import "@/components/arc/venancor-scope.css";

import { buildWhatsAppUrl } from "@/lib/whatsapp-url";

export type LightClientItem = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  convertedAt: Date | string;
};

const CARD_STYLE: React.CSSProperties = {
  background: "var(--surface)",
  borderRadius: "1.5rem",
  boxShadow: "var(--shadow-resting)",
};

const AVATAR_STYLE: React.CSSProperties = {
  background: "color-mix(in srgb, var(--accent) 12%, var(--surface))",
  border: "none",
  color: "var(--accent)",
  fontWeight: 600,
};

export function LightClientsList({ clients }: { clients: LightClientItem[] }) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clients;
    const q = searchQuery.toLowerCase().trim();
    return clients.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q))
    );
  }, [clients, searchQuery]);

  return (
    <div
      className="arc-venancor min-h-full flex flex-col"
      style={{ background: "var(--background)", color: "var(--foreground)" }}
    >
      <div className="mx-auto w-full max-w-4xl space-y-5 px-4 pt-6 flex-1 pb-[max(120px,var(--mobile-safe-bottom,0px))] sm:px-6">
        {/* Screen title */}
        <header>
          <h1
            className="text-[30px] leading-tight font-bold"
            style={{ letterSpacing: "-0.03em" }}
          >
            Clientes
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
            {clients.length === 1 ? "1 cliente conquistado" : `${clients.length} clientes conquistados`}
          </p>
        </header>

        {/* Search */}
        <SearchField
          label="Buscar cliente"
          placeholder="Nome ou telefone..."
          value={searchQuery}
          onValueChange={setSearchQuery}
        />

        {/* Clients List */}
        {filteredClients.length > 0 ? (
          <ul className="space-y-3">
            {filteredClients.map((client) => {
              const convertedDateStr = new Date(client.convertedAt).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              });
              const waUrl = buildWhatsAppUrl(client.phone);

              return (
                <li
                  key={client.id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                  style={CARD_STYLE}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar name={client.name} size="lg" style={AVATAR_STYLE} />
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <h2
                        className="text-base font-bold truncate"
                        style={{ letterSpacing: "-0.01em" }}
                      >
                        {client.name}
                      </h2>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                        Venda concluída em {convertedDateStr}
                      </p>
                      {client.phone ? (
                        <p
                          className="text-xs font-mono font-medium"
                          style={{ color: "var(--accent)" }}
                        >
                          {client.phone}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {/* Actions are always visible (also the swipe-free path) */}
                  <div className="flex shrink-0 items-center gap-2 pl-[52px] sm:pl-0">
                    {waUrl ? (
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                        style={{ background: "var(--success)" }}
                      >
                        <WhatsappLogo className="size-4" />
                        WhatsApp
                      </a>
                    ) : null}
                    <Link
                      href={`/clientes/${client.id}`}
                      className="inline-flex h-11 items-center gap-1 rounded-full px-4 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                      style={{ background: "var(--foreground)" }}
                    >
                      Abrir
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div style={CARD_STYLE}>
            <EmptyState
              label="Estado vazio da lista de clientes"
              icon={<UserCheck width={24} height={24} strokeWidth={1.5} />}
              title={
                searchQuery.trim()
                  ? `Nenhum resultado para "${searchQuery.trim()}"`
                  : "Nenhum cliente encontrado"
              }
              description={
                searchQuery.trim()
                  ? "Tente outro nome ou telefone."
                  : "Você ainda não tem clientes cadastrados."
              }
              action={
                searchQuery.trim() ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="inline-flex h-11 cursor-pointer items-center rounded-full px-4 text-xs font-semibold transition-colors hover:opacity-90"
                    style={{ background: "var(--accent-subtle)", color: "var(--accent)" }}
                  >
                    Limpar busca
                  </button>
                ) : undefined
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}
