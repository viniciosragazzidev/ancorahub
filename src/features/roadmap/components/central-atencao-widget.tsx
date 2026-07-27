import Link from "next/link";

import {
  ArrowRight,
  ClipboardText,
  Clock,
  FileText,
  LinkSimple,
  TriangleAlertIcon,
  UserList,
} from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AttentionCenterData } from "@/features/roadmap/attention-center";

const iconByType = {
  lead: UserList,
  stalled: Clock,
  task: ClipboardText,
  document: FileText,
  integration: LinkSimple,
} as const;

function formatAge(oldestAt: string | null) {
  if (!oldestAt) return "Sem pendências";
  const timestamp = Date.parse(oldestAt);
  if (Number.isNaN(timestamp)) return "Data indisponível";
  const hours = Math.max(1, Math.floor((Date.now() - timestamp) / (60 * 60 * 1000)));
  if (hours < 24) return `Há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Há ${days} ${days === 1 ? "dia" : "dias"}`;
}

export function CentralAtencaoWidget({ data }: { data: AttentionCenterData }) {
  const { enabled, stagnantDays, items } = data;
  const pendingCount = items.reduce((total, item) => total + item.count, 0);

  return (
    <Card className="border-border bg-card shadow-none">
      <CardHeader className="gap-2 border-b border-border">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <TriangleAlertIcon className="size-4 text-amber-500" />
              <CardTitle className="text-base">Central Atenção agora</CardTitle>
            </div>
            <CardDescription className="mt-1 max-w-2xl">{enabled ? `Pendências reais do seu escopo, com atalho direto para resolver cada uma. Estagnação configurada em ${stagnantDays} dias.` : "Esta central foi desativada pelo Super-admin."}</CardDescription>
          </div>
          <Badge variant={!enabled ? "outline" : pendingCount ? "destructive" : "secondary"}>
            {!enabled ? "Desativada" : pendingCount ? `${pendingCount} pendência${pendingCount === 1 ? "" : "s"}` : "Tudo em ordem"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
        {enabled ? items.map((item) => {
          const Icon = iconByType[item.icon];
          return (
            <Link
              key={item.id}
              href={item.href}
              className="group rounded-xl border border-border bg-background p-3 outline-none transition-colors hover:border-primary/40 hover:bg-muted/30 focus-visible:ring-3 focus-visible:ring-ring/40"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="grid size-8 place-items-center rounded-lg bg-muted text-muted-foreground group-hover:text-foreground">
                  <Icon className="size-4" />
                </span>
                <span className="font-mono text-xl font-semibold tabular-nums text-foreground">{item.count}</span>
              </div>
              <p className="mt-3 text-sm font-medium">{item.title}</p>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{item.description}</p>
              <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                <span>{formatAge(item.oldestAt)}</span>
                <span className="inline-flex items-center gap-1 font-medium text-foreground">
                  Resolver <ArrowRight className="size-3" />
                </span>
              </div>
            </Link>
          );
        }) : <p className="text-sm text-muted-foreground">Nenhum alerta é calculado enquanto a capacidade estiver desativada.</p>}
      </CardContent>
    </Card>
  );
}
