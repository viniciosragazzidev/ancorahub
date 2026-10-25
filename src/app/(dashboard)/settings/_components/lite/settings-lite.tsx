"use client";

/**
 * /settings no visual Lite (Onda 6). As mesmas seções que a tela atual monta para o papel de quem abre (a lista vem
 * pronta do servidor, com as mesmas regras de acesso), no padrão do LightSettings: no desktop, a lista de seções à
 * esquerda e a seção aberta ao lado; no celular, a lista primeiro e a seção em tela própria com "Voltar". A seção
 * ativa segue o ?tab= (tab=passkey abre Segurança e rola até as chaves de acesso), como hoje.
 */
import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import styles from "./settings-lite.module.css";

export type SettingsLiteSection = {
  id: string;
  title: string;
  description: string;
  node: ReactNode;
};

function resolveTab(requested: string | null, sections: SettingsLiteSection[]) {
  const id = requested === "passkey" ? "seguranca" : requested;
  return sections.some((section) => section.id === id) ? id : null;
}

export function SettingsLite({ sections }: { sections: SettingsLiteSection[] }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const requested = searchParams.get("tab");
  const [chosen, setChosen] = useState<string | null>(() => resolveTab(requested, sections));
  const wantsPasskey = requested === "passkey";

  // O ?tab= mudou por fora (link, voltar do navegador): a seção acompanha.
  useEffect(() => {
    const next = resolveTab(requested, sections);
    if (next) setChosen(next);
  }, [requested, sections]);

  useEffect(() => {
    if (!wantsPasskey) return;
    const timer = window.setTimeout(() => document.getElementById("passkey-section")?.scrollIntoView({ behavior: "smooth" }), 100);
    return () => window.clearTimeout(timer);
  }, [wantsPasskey]);

  const activeId = chosen ?? sections[0]?.id ?? null;
  const active = sections.find((section) => section.id === activeId) ?? null;

  function writeUrl(tab: string | null) {
    try {
      const params = new URLSearchParams(searchParams.toString());
      if (tab) params.set("tab", tab);
      else params.delete("tab");
      const query = params.toString();
      window.history.replaceState(null, "", query ? `${pathname}?${query}` : pathname);
    } catch {
      // Sem histórico (ambiente de teste): a seção troca do mesmo jeito.
    }
  }

  function select(id: string) {
    setChosen(id);
    writeUrl(id);
  }

  function back() {
    setChosen(null);
    writeUrl(null);
  }

  return (
    <div className={styles.layout} data-open={chosen ? "true" : undefined}>
      <nav aria-label="Seções das configurações" className={styles.nav}>
        <ul className={styles.navList}>
          {sections.map((section) => {
            const current = section.id === activeId;
            return (
              <li key={section.id}>
                <button type="button" className={styles.navItem} aria-current={current ? "page" : undefined} onClick={() => select(section.id)}>
                  <span className={styles.navText}>
                    <span className={styles.navTitle}>{section.title}</span>
                    <span className={styles.navDescription}>{section.description}</span>
                  </span>
                  <ChevronRight aria-hidden="true" size={18} className={styles.navChevron} />
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      {active ? (
        <section className={styles.content} aria-labelledby={`settings-${active.id}-title`}>
          <button type="button" className={styles.back} onClick={back}>
            <ChevronLeft aria-hidden="true" size={18} />
            Todas as configurações
          </button>
          <header className={styles.head}>
            <h2 id={`settings-${active.id}-title`} className={styles.title}>{active.title}</h2>
            <p className={styles.description}>{active.description}</p>
          </header>
          <div key={active.id} className={styles.body}>{active.node}</div>
        </section>
      ) : null}
    </div>
  );
}
