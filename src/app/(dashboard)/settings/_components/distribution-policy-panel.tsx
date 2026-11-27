"use client";

/**
 * Distribuição inteligente no Lite (27/11/2026): o interruptor do ranking, os três pesos lado a lado, os corretores
 * excluídos com busca e lista que rola, e o salvar no rodapé. A prioridade do plantão (só do Diretor) segue abaixo.
 */
import { useMemo, useState } from "react";

import { LiteActionButton } from "@/components/lite/controls";
import { ScrollArea } from "@/components/ui/scroll-area";
import { saveDistributionPolicyAction } from "@/features/lead-distribution/actions";
import { cn } from "@/lib/utils";
import { PlField, PlSection, SearchIcon, pl } from "@/app/(dashboard)/leads/distribuicao/plantao/_components/plantoes-1a1-kit";
import { Foot1a1, Panel1a1, ToggleRow1a1, pn } from "@/app/(dashboard)/leads/distribuicao/_components/panels-1a1";
import { PlantaoPrioritySection, type PlantaoPrioritySectionData } from "./plantao-priority-section";

type Policy = {
  excludedBrokerIds?: string[];
  ranking?: {
    enabled?: boolean;
    conversionWeight?: number;
    slaWeight?: number;
    manualPriorityWeight?: number;
  };
};

const WEIGHTS = [
  ["conversionWeight", "Conversão"],
  ["slaWeight", "SLA"],
  ["manualPriorityWeight", "Prioridade manual"],
] as const;

export function DistributionPolicyPanel({
  canEdit,
  brokers,
  policy,
  plantaoPriority,
}: {
  canEdit: boolean;
  brokers: { id: string; name: string }[];
  policy: unknown;
  /** Só o Diretor recebe estes dados (o servidor manda null para os demais). */
  plantaoPriority?: PlantaoPrioritySectionData | null;
}) {
  const current = (policy ?? {}) as Policy;
  const [excludedBrokerIds, setExcludedBrokerIds] = useState(current.excludedBrokerIds ?? []);
  const [ranking, setRanking] = useState({
    enabled: current.ranking?.enabled ?? true,
    conversionWeight: current.ranking?.conversionWeight ?? 45,
    slaWeight: current.ranking?.slaWeight ?? 35,
    manualPriorityWeight: current.ranking?.manualPriorityWeight ?? 20,
  });
  const [query, setQuery] = useState("");
  const visibleBrokers = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("pt-BR");
    const list = needle ? brokers.filter((broker) => broker.name.toLocaleLowerCase("pt-BR").includes(needle)) : brokers;
    // Os excluídos primeiro: ficam à vista sem precisar procurar.
    return [...list].sort((a, b) => Number(excludedBrokerIds.includes(b.id)) - Number(excludedBrokerIds.includes(a.id)));
  }, [brokers, query, excludedBrokerIds]);

  async function save() {
    const result = await saveDistributionPolicyAction({ excludedBrokerIds, excludedBranchIds: [], ranking });
    return result.success ? { ok: true as const } : { ok: false as const, error: result.error ?? "Não foi possível salvar a política." };
  }

  return (
    <Panel1a1 lead="Leads qualificados vão primeiro ao plantão ativo; depois o ranking considera conversão, SLA, carga e tempo sem novo lead.">
      <ToggleRow1a1
        title="Usar ranking depois do plantão"
        checked={ranking.enabled}
        onChange={(checked) => setRanking({ ...ranking, enabled: checked })}
        disabled={!canEdit}
        ariaLabel="Usar ranking depois do plantão"
        status={{ on: "Ranking ligado", off: "Ordem da fila" }}
      />

      <PlSection title="Pesos do ranking" hint="De 0 a 100 cada um.">
        <div className={pn.grid3}>
          {WEIGHTS.map(([key, label]) => (
            <PlField key={key} label={label} htmlFor={`policy-${key}`}>
              <input id={`policy-${key}`} className={pl.input} type="number" min={0} max={100} disabled={!canEdit} value={ranking[key]} onChange={(event) => setRanking({ ...ranking, [key]: Number(event.target.value) })} />
            </PlField>
          ))}
        </div>
      </PlSection>

      <PlSection title={<>Corretores excluídos{excludedBrokerIds.length ? <span className={cn(pl.badge, pl.num)} style={{ marginLeft: 8 }}>{excludedBrokerIds.length}</span> : null}</>} hint="Não recebem leads pelo ranking.">
        <label className={pl.searchField}>
          <SearchIcon />
          <span className={pl.srOnly}>Buscar corretor</span>
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar corretor" />
        </label>
        {visibleBrokers.length ? (
          <ScrollArea className={pn.scrollList}>
            <ul className={pn.list}>
              {visibleBrokers.map((broker) => {
                const checked = excludedBrokerIds.includes(broker.id);
                return (
                  <li key={broker.id}>
                    <label className={pl.checkRow}>
                      <input type="checkbox" className={pl.checkBox} checked={checked} disabled={!canEdit}
                        onChange={(event) => setExcludedBrokerIds(event.target.checked ? [...excludedBrokerIds, broker.id] : excludedBrokerIds.filter((id) => id !== broker.id))} />
                      <span className={pn.rowTitle}>{broker.name}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        ) : <p className={pl.emptyBox}>Nenhum corretor com esse nome.</p>}
      </PlSection>

      {canEdit && plantaoPriority ? <PlantaoPrioritySection data={plantaoPriority} /> : null}

      {canEdit ? (
        <Foot1a1 note="Vale para os próximos leads distribuídos.">
          <LiteActionButton busyLabel="Salvando…" doneLabel="Distribuição salva" keeps="A política anterior continua valendo." onAction={save}>
            Salvar distribuição
          </LiteActionButton>
        </Foot1a1>
      ) : null}
    </Panel1a1>
  );
}
