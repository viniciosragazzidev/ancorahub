"use client";

/**
 * Vitrine de movimento do laboratório (plano 2026-11-18, etapa 0). Mostra os componentes reais
 * compartilhados lado a lado para conferir entrada, troca e saída com os três sinais de movimento:
 * sistema (emular no DevTools › Rendering), "Menos animação" e kill switch (interruptores do painel).
 * As próximas etapas trocam estas peças pelas canônicas; a vitrine continua a mesma.
 */
import { useEffect, useMemo, useState } from "react";
import { getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { CalendarCheck, ChartLineUp, Clock, CurrencyCircleDollar, DotsThreeVertical, MagnifyingGlass, UsersThree } from "@phosphor-icons/react";

import { DataTable } from "@/components/data-table/data-table";
import { AI_INSIGHT_LABEL, InsightStrip, InsightValue } from "@/components/dashboard/insight-strip";
import { MetricGrid, StatCard } from "@/components/dashboard/metric-card";
import { EmptyState } from "@/components/empty-state";
import { useMotionAllowed } from "@/components/motion/use-motion-allowed";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SectionCardHeader } from "@/components/ui/section-card-header";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton, SkeletonReveal } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Person = { id: string; name: string; role: string; leads: number };

const PEOPLE: Person[] = [
  { id: "p1", name: "Ana Paula", role: "Corretora", leads: 12 },
  { id: "p2", name: "Bruno Lima", role: "Corretor", leads: 9 },
  { id: "p3", name: "Carla Dias", role: "Supervisora", leads: 4 },
  { id: "p4", name: "Débora Nunes", role: "Corretora", leads: 15 },
  { id: "p5", name: "Eduardo Reis", role: "Corretor", leads: 7 },
];

const COLUMNS: ColumnDef<Person>[] = [
  { accessorKey: "name", header: "Nome" },
  { accessorKey: "role", header: "Cargo" },
  { accessorKey: "leads", header: "Leads hoje", cell: ({ getValue }) => <span className="tabular-nums">{String(getValue())}</span> },
];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function MotionShowcase({ delay, failing }: { delay: number; failing: boolean }) {
  const allowed = useMotionAllowed();
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"todos" | "corretores">("todos");
  const [selected, setSelected] = useState<Person | null>(null);

  useEffect(() => {
    let alive = true;
    void wait(delay).then(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [delay]);

  const rows = useMemo(
    () => (failing ? [] : filter === "todos" ? PEOPLE : PEOPLE.filter((person) => person.role.startsWith("Corretor"))),
    [failing, filter],
  );
  const table = useReactTable({ data: rows, columns: COLUMNS, getCoreRowModel: getCoreRowModel() });

  return (
    <main className="ct-enter-seq mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Movimento</h1>
        <p className="text-sm text-muted-foreground">
          Pode animar agora: <strong data-testid="motion-allowed">{allowed ? "sim" : "não"}</strong>. Use “Recomeçar” para rever a entrada.
        </p>
      </header>

      <SkeletonReveal loading={loading} fallback={<Skeleton className="h-40 w-full" />}>
        <div className="flex flex-col gap-3">
          <MetricGrid label="Números de hoje" className="ct-enter-seq-tight">
            <StatCard variant="overview" icon={CalendarCheck} label="Leads hoje" value={47} sublabel="12 em atendimento" info="Leads que entraram desde 00:00." />
            <StatCard variant="overview" icon={UsersThree} label="Corretores no plantão" value={9} sublabel="2 em pausa" />
            <StatCard variant="overview" icon={ChartLineUp} label="Conversão" value="18%" sublabel="+3 pp vs outubro" trend="up" change="+3 pp" />
            <StatCard variant="overview" icon={Clock} tone="warning" label="SLA vencido" value={3} sublabel="sem primeiro contato" />
          </MetricGrid>
          <div className="ct-enter-seq-tight grid grid-cols-1 gap-3 sm:grid-cols-2">
            <StatCard icon={CurrencyCircleDollar} label="Vendas no mês" value="R$ 38.450,00" sublabel="14 aguardam implantação" />
            <InsightStrip label={AI_INSIGHT_LABEL}>
              <p>Conversão de <InsightValue>18%</InsightValue> em novembro, <InsightValue>3 pontos</InsightValue> acima de outubro. Hoje são <InsightValue>3</InsightValue> leads com SLA vencido: vale redistribuir antes do almoço.</p>
            </InsightStrip>
          </div>
        </div>
      </SkeletonReveal>

      <Card variant="overview">
        <SectionCardHeader
          icon={<UsersThree />}
          title="Equipe"
          description="Clique numa linha para abrir o drawer; troque o filtro para ver a troca do corpo da tabela."
          actions={
            <>
              <Button size="sm" variant="outline" onClick={() => setFilter((value) => (value === "todos" ? "corretores" : "todos"))}>
                {filter === "todos" ? "Só corretores" : "Todos"}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button aria-label="Mais ações" size="icon-sm" variant="ghost"><DotsThreeVertical size={15} /></Button>} />
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem>Exportar</DropdownMenuItem>
                  <DropdownMenuItem>Configurações</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          }
        />
        <SkeletonReveal loading={loading} fallback={<div className="flex flex-col gap-2 p-4">{PEOPLE.map((person) => <Skeleton key={person.id} className="h-8 w-full" />)}</div>}>
          {rows.length ? (
            <DataTable table={table} onRowClick={setSelected} className="p-4" />
          ) : (
            <div className="p-4">
              <EmptyState icon={MagnifyingGlass} title="Ninguém por aqui" description="A resposta simulada veio vazia (servidor em Falha)." variant="inline" animated />
            </div>
          )}
        </SkeletonReveal>
      </Card>

      <Card>
        <Tabs defaultValue="resumo">
          <TabsList>
            <TabsTrigger value="resumo">Resumo</TabsTrigger>
            <TabsTrigger value="atividade">Atividade</TabsTrigger>
            <TabsTrigger value="ajustes">Ajustes</TabsTrigger>
          </TabsList>
          <TabsContent value="resumo"><p className="text-sm">Conteúdo curto.</p></TabsContent>
          <TabsContent value="atividade"><p className="text-sm">Conteúdo mais alto.<br />Segunda linha.<br />Terceira linha.</p></TabsContent>
          <TabsContent value="ajustes"><p className="text-sm">Ajustes.</p></TabsContent>
        </Tabs>
      </Card>

      <Sheet open={selected !== null} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{selected?.name}</SheetTitle>
            <SheetDescription>{selected?.role} · {selected?.leads} leads hoje</SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>
    </main>
  );
}
