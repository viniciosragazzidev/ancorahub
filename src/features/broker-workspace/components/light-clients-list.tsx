"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, MagnifyingGlass, UserCheck, WhatsappLogo, X } from "@/components/huge-icons";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { buildWhatsAppUrl } from "@/lib/whatsapp-url";
import { cn } from "@/lib/utils";

export type LightClientItem = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  convertedAt: Date | string;
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
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <div className="mx-auto w-full max-w-4xl space-y-5 px-4 py-6 pb-28 sm:px-6 flex-1">
        {/* Top Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">Meus Clientes</span>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Clientes Conquistados ({clients.length})
            </h1>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <MagnifyingGlass className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            aria-label="Buscar cliente por nome ou telefone"
            placeholder="Buscar cliente por nome ou telefone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-9 text-xs"
          />
          {searchQuery && (
            <Button
              type="button"
              onClick={() => setSearchQuery("")}
              aria-label="Limpar busca"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              size="icon-sm"
              variant="ghost"
            >
              <X className="size-3.5" />
            </Button>
          )}
        </div>

        {/* Clients List */}
        <div className="space-y-3">
          {filteredClients.length > 0 ? (
            filteredClients.map((client) => {
              const convertedDateStr = new Date(client.convertedAt).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              });

              return (
                <Card key={client.id} variant="subtle" className="p-4 bg-card/95 hover:border-primary/30 transition-colors">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1 min-w-0 flex-1">
                      <h2 className="text-base font-semibold text-foreground truncate">{client.name}</h2>
                      <p className="text-xs text-muted-foreground">
                        Venda concluída em {convertedDateStr}
                      </p>
                      {client.phone ? (
                        <p className="text-xs font-mono font-medium text-primary">{client.phone}</p>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {buildWhatsAppUrl(client.phone) ? (
                        <a
                          href={buildWhatsAppUrl(client.phone)!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(
                            buttonVariants({ size: "sm" }),
                            "h-9 px-3 text-xs font-semibold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white flex items-center rounded-xl",
                          )}
                        >
                          <WhatsappLogo className="size-4" />
                          WhatsApp
                        </a>
                      ) : null}
                      <Link
                        href={`/clientes/${client.id}`}
                        className={cn(
                          buttonVariants({ variant: "outline", size: "sm" }),
                          "h-9 px-3 text-xs font-semibold gap-1 rounded-xl",
                        )}
                      >
                        Ver
                        <ArrowRight className="size-3.5" />
                      </Link>
                    </div>
                  </div>
                </Card>
              );
            })
          ) : (
            <Card variant="subtle" className="flex flex-col items-center justify-center p-8 text-center bg-card/95 border-dashed">
              <UserCheck className="size-8 text-muted-foreground/60" />
              <h2 className="mt-2 text-sm font-semibold text-foreground">
                {searchQuery.trim() ? `Nenhum resultado para "${searchQuery.trim()}"` : "Nenhum cliente encontrado"}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {searchQuery.trim()
                  ? "Tente outro nome ou telefone."
                  : "Você ainda não tem clientes cadastrados."}
              </p>
              {searchQuery.trim() && (
                <Button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="mt-3 h-auto p-0 text-xs"
                  variant="link"
                >
                  Limpar busca
                </Button>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
