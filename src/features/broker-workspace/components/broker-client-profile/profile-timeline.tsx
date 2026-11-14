"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { Avatar } from "@/components/arc/avatar/avatar";
import { ChipGroup } from "@/components/arc/chip-group/chip-group";
import { motionTokens } from "@/components/arc/motion-tokens";
import {
  countByFilter,
  filterTimeline,
  type ProfileHistory,
  type TimelineEntry,
  type TimelineFilter,
} from "@/features/broker-workspace/client-profile/profile-core";

import styles from "./broker-client-profile.module.css";

const FILTER_LABELS: Record<TimelineFilter, string> = {
  tudo: "Tudo",
  atendimentos: "Atendimentos",
  observacoes: "Observações",
  contratos: "Contratos",
  documentos: "Documentos",
};

const EMPTY_BY_FILTER: Record<TimelineFilter, string> = {
  tudo: "Nenhum registro no histórico deste cliente ainda.",
  atendimentos: "Nenhum atendimento registrado.",
  observacoes: "Nenhuma observação registrada.",
  contratos: "Nenhuma venda ou contrato registrado.",
  documentos: "Nenhum documento no histórico.",
};

const dateTimeFormat = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

function EntryContent({ entry }: { entry: TimelineEntry }) {
  const [expanded, setExpanded] = useState(false);
  if (!entry.content) return null;
  if (!entry.summary) return <p className={styles.entryText}>{entry.content}</p>;
  return (
    <div className={styles.entryLong}>
      <p className={styles.entryText}>{expanded ? entry.content : entry.summary}</p>
      <button type="button" className={styles.linkButton} aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>
        {expanded ? "Mostrar resumo" : "Ver tudo"}
      </button>
    </div>
  );
}

/**
 * Histórico do cliente como linha do tempo: cada registro com autor, data, tipo e conteúdo. Eventos automáticos
 * ficam numa linha discreta; textos longos aparecem resumidos. Filtros por tipo, com contagem real.
 */
export function ProfileTimeline({ history, filter, onFilterChange }: {
  history: ProfileHistory;
  filter: TimelineFilter;
  onFilterChange: (filter: TimelineFilter) => void;
}) {
  const reduce = useReducedMotion();

  if (history.status === "forbidden") {
    return <p className={styles.stateNote} role="note">Você não tem permissão para ver o histórico deste cliente. Ele segue com o corretor responsável.</p>;
  }
  if (history.status === "error") {
    return (
      <div className={styles.stateNote} role="alert">
        <p>Não foi possível carregar o histórico agora.</p>
        <button type="button" className={styles.linkButton} onClick={() => window.location.reload()}>Tentar de novo</button>
      </div>
    );
  }

  const counts = countByFilter(history.entries);
  const entries = filterTimeline(history.entries, filter);
  const options = (Object.keys(FILTER_LABELS) as TimelineFilter[]).map((value) => ({ value, label: `${FILTER_LABELS[value]} ${counts[value]}` }));
  const itemMotion = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -4 } };

  return (
    <div className={styles.timelineWrap}>
      <ChipGroup
        label="Filtrar histórico"
        multiple={false}
        options={options}
        value={[filter]}
        onValueChange={(value) => onFilterChange((value[0] as TimelineFilter | undefined) ?? "tudo")}
      />
      {entries.length === 0 ? (
        <p className={styles.stateNote}>{EMPTY_BY_FILTER[filter]}</p>
      ) : (
        <ol className={styles.timeline} aria-label={`Histórico: ${FILTER_LABELS[filter]}`}>
          <AnimatePresence initial={false} mode="popLayout">
            {entries.map((entry) => (
              <motion.li
                key={entry.id}
                layout={reduce ? false : "position"}
                className={entry.automatic ? styles.entryAuto : styles.entry}
                data-kind={entry.kind}
                transition={{ duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] }}
                {...itemMotion}
              >
                {entry.automatic ? (
                  <>
                    <span className={styles.autoDot} aria-hidden="true" />
                    <p className={styles.autoText}>
                      <span className={styles.entryType}>{entry.label}</span>
                      {entry.content ? <span> · {entry.content}</span> : null}
                      <small> · {[entry.author, dateTimeFormat.format(new Date(entry.at))].filter(Boolean).join(" · ")}</small>
                    </p>
                  </>
                ) : (
                  <>
                    <Avatar name={entry.author ?? "Sistema"} size="sm" className={styles.entryAvatar} />
                    <div className={styles.entryBody}>
                      <p className={styles.entryMeta}>
                        <strong>{entry.author ?? "Registro sem autor"}</strong>
                        <span className={styles.entryType}>{entry.label}</span>
                      </p>
                      <EntryContent entry={entry} />
                      <time className={styles.entryTime} dateTime={entry.at}>{dateTimeFormat.format(new Date(entry.at))}</time>
                    </div>
                  </>
                )}
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
      )}
    </div>
  );
}
