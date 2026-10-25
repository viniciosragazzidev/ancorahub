"use client";

/**
 * /guia no visual Lite (Onda 8): os mesmos temas (filtrados pelo papel do contexto), a mesma busca e as mesmas áreas,
 * um sumário de 44px no desktop e os passos numerados de cada tema. Sem caixa alta, sem segundo container.
 */
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Search } from "lucide-react";

import { LiteFilterChips } from "@/components/lite/controls";
import page from "@/components/lite/page/lite-page.module.css";
import { guideCategories, guideRoleLabels, guideSections, type GuideRole, type GuideSection } from "@/features/guide/guide-data";
import styles from "./system-guide-lite.module.css";

type Category = (typeof guideCategories)[number] | "Todas";

export function SystemGuideLite({ role }: { role: GuideRole }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("Todas");
  const [activeId, setActiveId] = useState(guideSections[0]?.id ?? "");

  const visibleSections = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    return guideSections.filter((section) => {
      const matchesRole = section.audience.includes(role);
      const matchesCategory = category === "Todas" || section.eyebrow === category;
      const searchable = [section.title, section.description, section.eyebrow, ...section.steps.flatMap((step) => [step.title, step.description])]
        .join(" ")
        .toLocaleLowerCase("pt-BR");
      return matchesRole && matchesCategory && (!normalized || searchable.includes(normalized));
    });
  }, [category, query, role]);

  function selectSection(id: string) {
    setActiveId(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const filtered = Boolean(query) || category !== "Todas";

  return (
    <>
      <section className={styles.intro} aria-labelledby="guide-intro-title">
        <div className={page.cardHead}>
          <h2 id="guide-intro-title" className={styles.introTitle}>Aprenda o sistema no seu ritmo</h2>
          <p className={page.cardDescription}>Um guia simples para saber onde começar, qual caminho seguir e como transformar cada tela em uma ação útil para sua corretora.</p>
        </div>
        <div className={page.toolbar}>
          <label className={page.search}>
            <Search aria-hidden="true" size={18} className={page.searchIcon} />
            <input type="search" className={page.searchInput} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquise: cotação, equipe, WhatsApp" aria-label="Pesquisar no guia" />
          </label>
          {filtered ? <button type="button" className={page.button} onClick={() => { setQuery(""); setCategory("Todas"); }}>Limpar filtros</button> : null}
        </div>
        <LiteFilterChips
          label="Área do guia"
          scroll
          chips={["Todas", ...guideCategories].map((item) => ({ id: item, label: item }))}
          active={[category]}
          onToggle={(id) => setCategory(id as Category)}
        />
      </section>

      <div className={styles.layout}>
        <aside className={styles.aside}>
          <nav className={styles.toc} aria-label="Sumário do guia">
            <h2 className={styles.tocTitle}>Sumário</h2>
            {visibleSections.map((section) => (
              <button key={section.id} type="button" className={styles.tocItem} aria-current={activeId === section.id ? "true" : undefined} onClick={() => selectSection(section.id)}>
                {section.title}
              </button>
            ))}
          </nav>
        </aside>

        <div className={styles.sections}>
          <p className={page.cellSub}>Mostrando {visibleSections.length} {visibleSections.length === 1 ? "tema" : "temas"} para {guideRoleLabels[role]}.</p>
          {!visibleSections.length ? (
            <div className={page.empty}>
              <p className={page.emptyTitle}>Não encontramos esse assunto</p>
              <p className={page.emptyText}>Tente buscar por uma palavra mais curta ou escolha outra área do guia.</p>
            </div>
          ) : visibleSections.map((section, index) => <GuideSectionLite key={section.id} section={section} index={index} onFocus={() => setActiveId(section.id)} />)}
        </div>
      </div>
    </>
  );
}

function GuideSectionLite({ section, index, onFocus }: { section: GuideSection; index: number; onFocus: () => void }) {
  return (
    <article id={section.id} onFocus={onFocus} className={`${page.card} ${styles.section}`} aria-labelledby={`${section.id}-title`}>
      <div className={styles.sectionHead}>
        <div className={page.cardHead}>
          <span className={page.cellSub}>{section.eyebrow} · tema {index + 1}</span>
          <h3 id={`${section.id}-title`} className={page.cardTitle}>{section.title}</h3>
          <p className={page.cardDescription}>{section.description}</p>
        </div>
      </div>
      <ol className={styles.steps}>
        {section.steps.map((step, stepIndex) => (
          <li key={step.title} className={styles.step}>
            <span className={styles.stepNumber} aria-hidden="true">{stepIndex + 1}</span>
            <span className={styles.stepText}>
              <span className={page.cellTitle}>{step.title}</span>
              <span className={page.cardDescription}>{step.description}</span>
            </span>
          </li>
        ))}
      </ol>
      {section.tip ? <p className={styles.tip}><span className={page.cellTitle}>Dica prática: </span>{section.tip}</p> : null}
      {section.links.length ? (
        <div className={styles.links}>
          {section.links.map((link) => (
            <Link key={link.href} href={link.href} className={page.button}>
              {link.label} <ArrowRight aria-hidden="true" size={16} />
            </Link>
          ))}
        </div>
      ) : null}
    </article>
  );
}
