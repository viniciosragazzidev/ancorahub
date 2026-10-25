"use client";

import Link from "next/link";
import { LayoutDashboard, SearchX } from "lucide-react";

import { useArcScopeEnabled } from "@/components/arc/arc-scope-context";
import styles from "./route-state.module.css";

/** Página não encontrada no visual Lite para todo mundo (Onda 8): mesmo texto e o mesmo destino de volta. */
export function RouteNotFound({
  title = "Página não encontrada",
  description = "A página que você procura não existe, foi movida ou o endereço está incorreto.",
  backUrl = "/dashboard",
  backText = "Voltar para o Dashboard",
  standalone = false,
}: {
  title?: string;
  description?: string;
  /** Mantido por compatibilidade: o visual Lite não usa ilustração. */
  imageSrc?: string;
  backUrl?: string;
  backText?: string;
  /** Fora da moldura do app (rota inexistente na raiz): a tela ocupa a página inteira com o fundo Lite. */
  standalone?: boolean;
}) {
  const directorSkin = useArcScopeEnabled();
  return (
    <main
      className={[directorSkin ? "arc-venancor" : "", styles.state, standalone ? styles.page : ""].filter(Boolean).join(" ")}
      data-skin={directorSkin ? "diretor" : undefined}
      aria-labelledby="not-found-title"
    >
      <span className={styles.icon} aria-hidden="true"><SearchX size={20} strokeWidth={1.75} /></span>
      <div className={styles.copy}>
        <h1 id="not-found-title" className={styles.title}>{title}</h1>
        <p className={styles.description}>{description}</p>
      </div>
      <div className={styles.actions}>
        <Link href={backUrl} className={`${styles.link} ${styles.primary}`}>
          <LayoutDashboard size={16} aria-hidden="true" />
          {backText}
        </Link>
      </div>
    </main>
  );
}
