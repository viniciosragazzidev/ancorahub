"use client";

/**
 * Topo e seção recolhível do Resumo da Distribuição (27/11/2026), cópia 1:1 do artifact "Distribuição · Resumo":
 * título, resumo, abas da área (mesmo cadastro e acesso da barra de abas, `nav-registry`) e "Leads aguardando corretor".
 */
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { useNavFlags, useNavUser } from "@/components/navigation/nav-access";
import { ScrollArea } from "@/components/ui/scroll-area";
import { navRowTabs, resolveNavLocation } from "@/shared/navigation/nav-registry";

import s from "./resumo-1a1.module.css";

export function DistributionHead1a1({ available, waiting }: { available: number; waiting: number }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { negotiationsEnabled, postSaleAuditEnabled, autoSaleEnabled, erpPaths, initialUser, previewPathname } = useNavFlags();
  const user = useNavUser(initialUser);
  const location = previewPathname ? resolveNavLocation(previewPathname) : resolveNavLocation(pathname, searchParams);
  const tabs = location && user
    ? navRowTabs(location.area, { ...user, negotiationsEnabled, postSaleAuditEnabled, autoSaleEnabled, erpPaths }, location.tab.id)
    : [];
  const n = (value: number) => value.toLocaleString("pt-BR");

  return (
    <header className={s.head}>
      <div className={s.headText}>
        <h1 className={s.title}>Distribuição</h1>
        <p className={s.summary}>
          <span className={s.summaryLong}>{n(available)} {available === 1 ? "corretor disponível" : "corretores disponíveis"} · {n(waiting)} {waiting === 1 ? "lead aguardando" : "leads aguardando"}</span>
          <span className={s.summaryShort}>{n(available)} {available === 1 ? "disponível" : "disponíveis"} · {n(waiting)} aguardando</span>
        </p>
      </div>
      {tabs.length > 1 && location ? (
        <ScrollArea orientation="horizontal" className={s.views}>
          <nav className={s.viewsRow} aria-label="Seções da distribuição">
            {tabs.map((tab) => (
              <Link key={tab.id} href={tab.href} className={s.viewbtn} aria-current={tab.id === location.tab.id ? "page" : undefined}>{tab.label}</Link>
            ))}
          </nav>
        </ScrollArea>
      ) : null}
    </header>
  );
}

/** Faixa ao vivo do artifact: uma linha com o estado e os atalhos Atribuir e Fila. */
export function LiveStrip1a1({ text, canAssign, showQueue }: { text: string; canAssign: boolean; showQueue: boolean }) {
  return (
    <div className={`${s.card} ${s.in} ${s.live}`} role="status">
      <span className={s.liveTag}><span className={s.dot} style={{ background: "var(--success)" }} aria-hidden="true" />Ao vivo</span>
      <span className={s.liveText}>{text}</span>
      <span className={s.grow} />
      {canAssign ? <Link className={`${s.pill} ${s.pillQuiet} ${s.pillSm}`} href="?atribuir=1" scroll={false}>Atribuir</Link> : null}
      {showQueue ? <Link className={`${s.pill} ${s.pillQuiet} ${s.pillSm}`} href="/distribuicao?view=filas">Fila</Link> : null}
    </div>
  );
}

/** "Leads aguardando corretor": aberta por padrão (como no artifact); `?atribuir=1` abre e rola até ela. */
export function AssignSection1a1({ count, children }: { count: number; children: ReactNode }) {
  const requested = useSearchParams()?.get("atribuir") === "1";
  const [open, setOpen] = useState(true);
  const ref = useRef<HTMLElement>(null);
  const bodyId = useId();
  const titleId = useId();

  // No celular (Celular.dc.html) a seção começa fechada, só com o total; no computador, aberta.
  useEffect(() => {
    if (!requested && window.matchMedia("(max-width: 720px)").matches) setOpen(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!requested) return;
    setOpen(true);
    ref.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [requested]);

  return (
    <section ref={ref} id="atribuir" className={`${s.card} ${s.in} ${s.assign}`} style={{ animationDelay: "80ms" }}
      data-open={open ? "true" : undefined} aria-labelledby={titleId}>
      <button type="button" className={s.assignHead} aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen((value) => !value)}>
        <span className={s.assignIcon} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6M19 8v6M22 11h-6" /></svg>
        </span>
        <span className={s.assignText}>
          <span id={titleId} className={s.assignTitle}>Leads aguardando corretor</span>
          <span className={s.assignHint}><span className={s.summaryLong}>Atribua à mão o que a distribuição automática não entregou.</span><span className={s.summaryShort}>Atribua o que a distribuição não entregou.</span></span>
        </span>
        <span className={s.countPill}>{count.toLocaleString("pt-BR")}</span>
        <svg className={s.chevron} width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open ? <div id={bodyId} className={s.assignBody}>{children}</div> : null}
    </section>
  );
}
