"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { OwnershipContext } from "@/components/ownership-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, WarningCircle, XCircle, ArrowRight, MagnifyingGlass } from "@/components/huge-icons";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type ChecklistItem = {
  label: string;
  ok: boolean;
  hint: string;
};

type LeadChecklist = {
  id: string;
  nome: string;
  status: string;
  corretorNome: string | null;
  branchName: string | null;
  stageEnteredAt: string;
  type: "pre" | "post";
  items: ChecklistItem[];
  checked: number;
  total: number;
  ready: boolean;
  docsPending: boolean;
};

export function ChecklistClient({
  preItems,
  postItems,
}: {
  preItems: LeadChecklist[];
  postItems: LeadChecklist[];
}) {
  const [search, setSearch] = useState("");

  const filteredPre = useMemo(() => {
    if (!search.trim()) return preItems;
    const q = search.toLocaleLowerCase("pt-BR");
    return preItems.filter((item) => item.nome.toLocaleLowerCase("pt-BR").includes(q));
  }, [preItems, search]);

  const filteredPost = useMemo(() => {
    if (!search.trim()) return postItems;
    const q = search.toLocaleLowerCase("pt-BR");
    return postItems.filter((item) => item.nome.toLocaleLowerCase("pt-BR").includes(q));
  }, [postItems, search]);

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative max-w-xs">
        <MagnifyingGlass className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Buscar lead"
          className="pl-8"
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome..."
          value={search}
        />
      </div>

      <Tabs defaultValue="pre">
        <TabsList>
          <TabsTrigger value="pre">
            Pré-conversão
            <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-[10px]">{preItems.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="post">
            Pós-conversão
            <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-[10px]">{postItems.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent className="space-y-3" value="pre">
          {filteredPre.length === 0 && (
            <p className="py-12 text-center text-sm text-muted-foreground">Nenhum lead encontrado para pré-conversão.</p>
          )}
          {filteredPre.map((lead) => (
            <ChecklistCard key={lead.id} lead={lead} />
          ))}
        </TabsContent>

        <TabsContent className="space-y-3" value="post">
          {filteredPost.length === 0 && (
            <p className="py-12 text-center text-sm text-muted-foreground">Nenhum lead encontrado para pós-conversão.</p>
          )}
          {filteredPost.map((lead) => (
            <ChecklistCard key={lead.id} lead={lead} />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ChecklistCard({ lead }: { lead: LeadChecklist }) {
  const pct = Math.round((lead.checked / lead.total) * 100);

  return (
    <Card className={cn("border-border bg-card shadow-none transition-colors hover:bg-muted/20", lead.ready && "border-emerald-500/20")}>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {lead.ready ? (
                <CheckCircle className="size-5 text-emerald-500" weight="fill" />
              ) : (
                <WarningCircle className="size-5 text-amber-500" weight="fill" />
              )}
              <CardTitle className="text-sm">{lead.nome}</CardTitle>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="text-[10px]">
                {lead.status === "negotiation" ? "Negociação" : lead.status === "documentation_pending" ? "Doc. Pendente" : lead.status === "under_analysis" ? "Em Análise" : "Convertido"}
              </Badge>
              <OwnershipContext brokerName={lead.corretorNome} branchName={lead.branchName} emptyLabel="Sem responsável" />
              <span>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(lead.stageEnteredAt))}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs tabular-nums text-muted-foreground">{lead.checked}/{lead.total}</span>
            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full transition-[width]", lead.ready ? "bg-emerald-500" : "bg-amber-500")}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
          {lead.items.map((item) => (
            <div
              key={item.label}
              className={cn(
                "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs",
                item.ok ? "bg-emerald-500/5 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/5 text-amber-600 dark:text-amber-400",
              )}
            >
              {item.ok ? (
                <CheckCircle className="size-3.5 shrink-0" weight="fill" />
              ) : (
                <XCircle className="size-3.5 shrink-0" weight="fill" />
              )}
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium">{item.label}</span>
                <span className="ml-1 text-muted-foreground">— {item.hint}</span>
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex justify-end">
          <Button
            render={<Link href={`/leads/${lead.id}`} />}
            size="sm"
            variant="ghost"
            className="text-xs"
          >
            Abrir lead <ArrowRight className="ml-1 size-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
