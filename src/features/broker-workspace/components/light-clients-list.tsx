"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, MagnifyingGlass, UserCheck, WhatsappLogo } from "@/components/huge-icons";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ExperienceModeToggle } from "@/components/experience-mode-toggle";
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
    <div className="mx-auto w-full max-w-4xl space-y-5 px-4 py-6 sm:px-6">
      {/* Top Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">Meus Clientes</span>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Clientes Conquistados ({clients.length})
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <ExperienceModeToggle variant="badge" />
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <MagnifyingGlass className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar cliente por nome ou telefone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-xl border border-border bg-card py-2 pl-9 pr-4 text-xs shadow-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Clients List */}
      <div className="space-y-3">
        {filteredClients.length > 0 ? (
          filteredClients.map((client) => {
            const rawPhone = client.phone?.replace(/\D/g, "");
            const convertedDateStr = new Date(client.convertedAt).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            });

            return (
              <Card key={client.id} variant="subtle" className="p-4 bg-card/95 hover:border-primary/30 transition-colors">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1 min-w-0 flex-1">
                    <h3 className="text-base font-semibold text-foreground truncate">{client.name}</h3>
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
                          "h-9 px-3 text-xs font-semibold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white flex items-center"
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
                        "h-9 px-3 text-xs font-semibold gap-1"
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
            <h3 className="mt-2 text-sm font-semibold text-foreground">Nenhum cliente encontrado</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Você ainda não tem clientes cadastrados ou nenhum resultado para a busca.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
