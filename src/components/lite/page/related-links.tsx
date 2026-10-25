/**
 * Atalhos relacionados no visual Lite (troca o RelatedActions dentro das telas do diretor): título em sentence case,
 * descrição curta e os mesmos links, cada um com alvo de 44px.
 */
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import styles from "./related-links.module.css";

export type LiteRelatedLink = { label: string; href: string; description?: string };

export function LiteRelatedLinks({ title, description, links }: { title: string; description?: string; links: LiteRelatedLink[] }) {
  if (!links.length) return null;
  return (
    <section className={styles.root} aria-label={title}>
      <header className={styles.head}>
        <h2 className={styles.title}>{title}</h2>
        {description ? <p className={styles.description}>{description}</p> : null}
      </header>
      <ul className={styles.links}>
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className={styles.link}>
              <span className={styles.linkText}>
                <span className={styles.linkLabel}>{link.label}</span>
                {link.description ? <span className={styles.linkDescription}>{link.description}</span> : null}
              </span>
              <ArrowRight aria-hidden="true" size={16} className={styles.arrow} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
