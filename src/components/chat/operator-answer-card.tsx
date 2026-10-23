"use client";

import { useState } from "react";

import styles from "./chat.module.css";
import type { OperatorAnswerView } from "./types";

/** Rows shown per section before "Ver mais". */
const ROWS_VISIBLE = 6;
/** Sections open at first; the others open with a tap on the title. */
const SECTIONS_OPEN = 3;

function isTotal(label: string) {
  return /^total\b/i.test(label.trim());
}

/** Clean text to paste for the client: titles and rows, no internal notes. */
function cardText(card: OperatorAnswerView) {
  const parts = card.intro ? [card.intro] : [];
  for (const section of card.sections) {
    parts.push([section.title ? `*${section.title}*` : null, ...section.rows.map((row) => `• ${row.label}${row.value ? `: ${row.value}` : ""}`)].filter(Boolean).join("\n"));
  }
  return parts.join("\n\n").trim();
}

function Section({ section, initiallyOpen }: { section: OperatorAnswerView["sections"][number]; initiallyOpen: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  const [all, setAll] = useState(false);
  const rows = all ? section.rows : section.rows.slice(0, ROWS_VISIBLE);
  const hidden = section.rows.length - rows.length;
  return (
    <div className={styles.operatorSection}>
      {section.title ? (
        <button type="button" className={styles.operatorSectionTitle} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          <span>{section.title}</span>
          <span className={styles.operatorCount}>{section.rows.length}</span>
          <svg viewBox="0 0 16 16" className={styles.operatorChevron} data-open={open} aria-hidden="true"><path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      ) : null}
      {open ? (
        <>
          <dl className={styles.operatorRows}>
            {rows.map((row, index) => (
              <div key={`${row.label}-${index}`} className={styles.operatorRow} data-total={isTotal(row.label) || undefined}>
                <dt>{row.label}</dt>
                {row.value ? <dd>{row.value}</dd> : <dd aria-hidden="true" />}
              </div>
            ))}
          </dl>
          {hidden > 0 ? <button type="button" className={styles.operatorMore} onClick={() => setAll(true)}>Ver mais {hidden}</button> : null}
        </>
      ) : null}
    </div>
  );
}

/** The answer from the operator material: sections of plans or groups, notes, and a copy for the client. */
export function OperatorAnswerCard({ card, at }: { card: OperatorAnswerView; at?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <section className={`${styles.card} ${styles.operatorCard}`} aria-label="Resposta do material das operadoras">
      {card.intro ? <p className={styles.operatorIntro}>{card.intro}</p> : null}
      {card.sections.map((section, index) => (
        <Section key={`${section.title}-${index}`} section={section} initiallyOpen={index < SECTIONS_OPEN} />
      ))}
      {card.notes.length || card.missing ? (
        <ul className={styles.operatorNotes}>
          {card.notes.map((note) => <li key={note}>{note}</li>)}
          {card.missing ? <li>Não está no material: {card.missing}</li> : null}
        </ul>
      ) : null}
      <footer className={styles.operatorFooter}>
        <button type="button" className={styles.operatorCopy} onClick={() => { void navigator.clipboard?.writeText(cardText(card)).then(() => setCopied(true)); }}>
          {copied ? "Copiado" : "Copiar para o cliente"}
        </button>
        {at ? <span>{at}</span> : null}
      </footer>
    </section>
  );
}
