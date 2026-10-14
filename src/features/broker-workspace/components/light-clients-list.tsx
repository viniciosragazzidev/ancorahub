"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { Avatar } from "@/components/arc/avatar/avatar";
import { Button } from "@/components/arc/button/button";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { SearchField } from "@/components/arc/search-field/search-field";
import { AssistantAvatar } from "@/components/chat/assistant-avatar";
import { LitePageEnter, LiteList, LiteListItem } from "@/components/light/light-motion";
import { buildWhatsAppUrl } from "@/lib/whatsapp-url";

export type LightClientItem = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  convertedAt: Date | string;
  brokerName?: string | null;
};

const secondaryAction =
  "inline-flex h-11 items-center justify-center rounded-full bg-(--surface-muted) px-4 text-sm font-semibold text-(--foreground)";

/** Clientes of the broker: search, then one white card per client with WhatsApp and Abrir. */
/** `management`: the gestor and supervisor screen (big title and count blocks); the broker keeps the compact header. */
export function LightClientsList({ clients, management = false }: { clients: LightClientItem[]; management?: boolean }) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clients;
    const q = searchQuery.toLowerCase().trim();
    return clients.filter((c) => c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q)));
  }, [clients, searchQuery]);

  const searching = searchQuery.trim().length > 0;

  return (
    <LitePageEnter className="flex min-h-full flex-col text-foreground">
      <div className="arc-venancor mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 px-4 pb-6 pt-2 sm:px-6">
        {management ? (
          <header className="flex flex-col gap-1">
            <h1 className="text-[2rem] font-semibold leading-tight tracking-tight text-(--foreground)">Clientes</h1>
            <p className="text-sm text-(--text-secondary)">
              {clients.length === 1 ? "1 cliente conquistado" : `${clients.length} clientes conquistados`}
            </p>
          </header>
        ) : (
          <header>
            <h1 className="sr-only">Clientes</h1>
            <p className="text-sm text-(--text-secondary)">
              {clients.length === 1 ? "1 cliente conquistado" : `${clients.length} clientes conquistados`}
            </p>
          </header>
        )}

        {management ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-(--surface-muted) p-4">
              <p className="text-2xl font-semibold tabular-nums text-(--foreground)">{clients.length}</p>
              <p className="text-xs text-(--text-secondary)">Clientes</p>
            </div>
            <div className="rounded-2xl bg-(--surface-muted) p-4">
              <p className="text-2xl font-semibold tabular-nums text-(--foreground)">{new Set(clients.map((client) => client.brokerName ?? "")).size}</p>
              <p className="text-xs text-(--text-secondary)">Corretores com clientes</p>
            </div>
          </div>
        ) : null}

        <SearchField label="Buscar cliente" placeholder="Nome ou telefone" value={searchQuery} onValueChange={setSearchQuery} />

        {filteredClients.length > 0 ? (
          <LiteList className="flex flex-col gap-3" label="Clientes">
            {filteredClients.map((client) => {
              const convertedDate = new Date(client.convertedAt).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                timeZone: "America/Sao_Paulo",
              });
              const waUrl = buildWhatsAppUrl(client.phone);

              return (
                <LiteListItem key={client.id} className="flex flex-col gap-4 rounded-3xl bg-(--surface) p-5 shadow-(--shadow-resting)">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={client.name} size="lg" className="light-avatar" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-semibold text-(--foreground)">{client.name}</p>
                      <p className="text-sm tabular-nums text-(--text-secondary)">Venda concluída em {convertedDate}</p>
                      {client.brokerName ? <p className="text-sm text-(--text-secondary)">Com {client.brokerName}</p> : null}
                      {client.phone ? <p className="text-sm tabular-nums text-(--text-secondary)">{client.phone}</p> : null}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    {waUrl ? (
                      <a href={waUrl} target="_blank" rel="noopener noreferrer" className={`${secondaryAction} sm:flex-1`}>
                        WhatsApp
                      </a>
                    ) : null}
                    <Link href={`/clientes/${client.id}`} className={`${secondaryAction} sm:flex-1`}>
                      Abrir cliente
                    </Link>
                  </div>
                </LiteListItem>
              );
            })}
          </LiteList>
        ) : (
          <EmptyState
            label="Lista de clientes vazia"
            icon={<AssistantAvatar shape="logo" hue={null} size={56} />}
            title={searching ? `Nenhum resultado para "${searchQuery.trim()}"` : "Nenhum cliente ainda"}
            description={searching ? "Tente outro nome ou telefone." : "Quando você concluir uma venda, o cliente aparece aqui."}
            action={searching ? <Button variant="secondary" onClick={() => setSearchQuery("")}>Limpar busca</Button> : undefined}
          />
        )}
      </div>
    </LitePageEnter>
  );
}
