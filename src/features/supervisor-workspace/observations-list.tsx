"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTransition } from "react";

import { Badge } from "@/components/arc/badge/badge";
import { LiteSelect, type LiteOption } from "@/components/lite/controls/select";
import { PeopleEmpty, PeoplePage, PeopleSection } from "@/components/light/people-list/people-list";
import { Button } from "@/components/ui/button";

import type { SupervisorObservationStage } from "./observation-queries";

const STAGE_LABELS: Record<SupervisorObservationStage, string> = {
  new: "Novo", distributed: "Distribuído", in_contact: "Em atendimento", contacted: "Entrei em contato",
  quote_sent: "Cotação enviada", negotiation: "Negociação", documentation_pending: "Documentação",
  under_analysis: "Em análise", awaiting_reply: "Aguardando retorno", converted: "Convertido", lost: "Perdido",
};

export type SupervisorObservationsPageData = {
  brokers: Array<{ id: string; name: string }>;
  observations: Array<{ id: string; leadId: string; leadName: string; brokerId: string; brokerName: string; stage: string | null; text: string; createdAt: string }>;
  hasMore: boolean;
  next: { beforeAt: string; beforeId: string } | null;
};

function makeHref(pathname: string, params: URLSearchParams) {
  return `${pathname}${params.toString() ? `?${params.toString()}` : ""}`;
}

export function SupervisorObservationsList({ data, brokerId, stage }: { data: SupervisorObservationsPageData; brokerId: string; stage: string }) {
  const router = useRouter();
  const pathname = usePathname() ?? "/equipe/observacoes";
  const search = useSearchParams();
  const [, startTransition] = useTransition();
  const brokerOptions: LiteOption[] = [{ value: "", label: "Toda a equipe" }, ...data.brokers.map((broker) => ({ value: broker.id, label: broker.name }))];
  const stageOptions: LiteOption[] = [{ value: "", label: "Todas as etapas" }, ...Object.entries(STAGE_LABELS).map(([value, label]) => ({ value, label }))];
  const navigateFilter = (key: "corretor" | "etapa", value: string) => {
    const params = new URLSearchParams(search.toString());
    if (value) params.set(key, value); else params.delete(key);
    params.delete("beforeAt");
    params.delete("beforeId");
    startTransition(() => router.push(makeHref(pathname, params), { scroll: false }));
  };
  const nextHref = data.next ? (() => {
    const params = new URLSearchParams(search.toString());
    params.set("beforeAt", data.next!.beforeAt);
    params.set("beforeId", data.next!.beforeId);
    return makeHref(pathname, params);
  })() : null;
  const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Sao_Paulo" });

  return (
    <PeoplePage title="Observações da equipe" subtitle="Relatos dos corretores nos leads da sua unidade e equipe." action={<Button variant="outline" size="sm" render={<Link href="/equipe/controle" />}>Voltar ao controle</Button>}>
      <div className="grid gap-3 rounded-2xl border border-(--border) bg-(--surface) p-4 sm:grid-cols-2" aria-label="Filtros das observações">
        <LiteSelect label="Corretor" value={brokerId} options={brokerOptions} onChange={(value) => navigateFilter("corretor", value)} />
        <LiteSelect label="Etapa" value={stage} options={stageOptions} onChange={(value) => navigateFilter("etapa", value)} />
      </div>
      <PeopleSection title="Mais recentes" count={data.observations.length} label="Observações dos corretores">
        {data.observations.map((item) => (
          <li key={item.id} className="grid gap-2 border-b border-(--border) px-3 py-4 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/leads/${encodeURIComponent(item.leadId)}`} className="font-medium text-(--foreground) underline-offset-4 hover:underline">{item.leadName}</Link>
                {item.stage && STAGE_LABELS[item.stage as SupervisorObservationStage] ? <Badge size="sm" tone="neutral">{STAGE_LABELS[item.stage as SupervisorObservationStage]}</Badge> : null}
              </div>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-(--text-secondary)">{item.text}</p>
              <p className="mt-2 text-xs text-(--text-muted)">{item.brokerName}</p>
            </div>
            <time className="text-xs text-(--text-muted) sm:text-right" dateTime={item.createdAt}>{dateTime.format(new Date(item.createdAt))}</time>
          </li>
        ))}
      </PeopleSection>
      {!data.observations.length ? <PeopleEmpty title="Nenhuma observação neste recorte" description="As observações registradas pelos corretores aparecem aqui, da mais recente para a mais antiga." /> : null}
      {data.hasMore && nextHref ? <div className="flex justify-center"><Button variant="outline" size="sm" render={<Link href={nextHref} />}>Ver observações anteriores</Button></div> : null}
      <span className="sr-only" aria-live="polite">{data.observations.length} observações carregadas.</span>
    </PeoplePage>
  );
}
