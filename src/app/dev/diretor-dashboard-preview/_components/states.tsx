"use client";

/** Loading and error states of the preview: a skeleton with the shape of each tab, and the error with "Tentar de novo". */
import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CloudOff, LoaderCircle } from "lucide-react";

import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { motionTokens as m } from "@/components/arc/motion-tokens";

import styles from "../preview.module.css";
import { fadeT, useReduce } from "./motion";

function Line({ width, height = 12 }: { width: string; height?: number }) {
  return <span className={styles.skeleton} style={{ width, height }} />;
}

function CardSkeleton({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={`${styles.card} ${className ?? ""}`}>
      <div className={styles.cardHeader}><div className={styles.skeletonStack}><Line width="40%" height={16} /><Line width="70%" /></div></div>
      <div className={styles.cardBody}>
        {Array.from({ length: rows }, (_, index) => <Line key={index} width={`${88 - index * 9}%`} height={20} />)}
      </div>
    </div>
  );
}

/** Same blocks and heights as the tab it stands for, so nothing jumps when the content arrives. */
export function TabSkeleton({ tab }: { tab: "overview" | "quality" | "funnel" }) {
  return (
    <div className={styles.stack} aria-busy="true" aria-label="Carregando o painel">
      {tab === "overview" ? <div className={styles.searchRow}><span className={`${styles.skeleton} ${styles.skeletonPill}`} /><span className={`${styles.skeleton} ${styles.skeletonButton}`} /></div> : null}
      {tab === "quality" ? <div className={styles.toolbar}><span className={`${styles.skeleton} ${styles.skeletonButton}`} /><span className={`${styles.skeleton} ${styles.skeletonButton}`} /></div> : null}
      <div className={styles.kpis}>
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className={styles.stat}><Line width="60%" /><Line width="40%" height={32} /><Line width="50%" /></div>
        ))}
      </div>
      {tab === "overview" ? (
        <div className={styles.overviewGrid}>
          <CardSkeleton className={styles.areaQueues} rows={5} />
          <CardSkeleton className={styles.areaRecent} rows={6} />
          <CardSkeleton className={styles.areaAttention} rows={3} />
          <CardSkeleton className={styles.areaDuties} rows={3} />
          <CardSkeleton className={styles.areaReadiness} rows={3} />
        </div>
      ) : (
        <div className={styles.split32}>
          <CardSkeleton rows={7} />
          <CardSkeleton rows={6} />
        </div>
      )}
    </div>
  );
}

/** Crossfade from skeleton to content in the same grid cell: the height is held while one leaves and the other enters. */
export function SkeletonToContent({ loading, skeleton, children, id }: { loading: boolean; skeleton: ReactNode; children: ReactNode; id: string }) {
  const reduce = useReduce();
  return (
    <div className={styles.swapArea}>
      <AnimatePresence initial={false}>
        {loading ? (
          <motion.div key={`sk-${id}`} className={styles.swapLayer} initial={{ opacity: 0 }} animate={{ opacity: 1, transition: fadeT }} exit={{ opacity: 0, transition: { duration: m.duration.exit } }}>
            {skeleton}
          </motion.div>
        ) : (
          <motion.div key={`ct-${id}`} className={styles.swapLayer} initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0, transition: reduce ? fadeT : { duration: m.duration.standard, ease: [...m.ease.enter] } }} exit={{ opacity: 0, transition: fadeT }}>
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  const [busy, setBusy] = useState(false);
  const reduce = useReduce();
  return (
    <div className={styles.card} role="alert">
      <div className={styles.cardEmpty}>
        <EmptyState
          icon={<CloudOff aria-hidden="true" />}
          title="Não deu para carregar o painel"
          description="Confira a conexão e tente de novo. Os números voltam assim que a conexão responder."
          action={
            <button type="button" className={styles.primaryButton} disabled={busy} aria-busy={busy} onClick={() => { setBusy(true); window.setTimeout(onRetry, 900); }}>
              {busy ? (
                <>
                  <motion.span className={styles.spinner} animate={reduce ? undefined : { rotate: 360 }} transition={{ repeat: Infinity, ease: "linear", duration: m.duration.considered * 2 }}>
                    <LoaderCircle aria-hidden="true" size={18} />
                  </motion.span>
                  Tentando
                </>
              ) : "Tentar de novo"}
            </button>
          }
        />
      </div>
    </div>
  );
}
