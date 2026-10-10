"use client";

import { useEffect, useState } from "react";

import RadioCards from "@/components/arc/radio-cards/radio-cards";
import { Switch } from "@/components/arc/switch/switch";

import { A11Y_DEFAULTS, readA11yPrefs, saveA11yPrefs, type A11yPrefs } from "../a11y-prefs";
import styles from "./assist.module.css";

const SIZES: { value: string; label: string; description: string }[] = [
  { value: "100", label: "Normal", description: "O tamanho padrão do app." },
  { value: "115", label: "Maior", description: "Um pouco maior, bom para o dia a dia." },
  { value: "130", label: "Bem maior", description: "Para ler sem esforço." },
];

/** Configurações, "Acessibilidade": text size, less motion and high contrast, applied right away. */
export function AccessibilityPreferences() {
  const [prefs, setPrefs] = useState<A11yPrefs>(A11Y_DEFAULTS);
  const [ready, setReady] = useState(false);
  useEffect(() => { setPrefs(readA11yPrefs()); setReady(true); }, []);

  function update(next: Partial<A11yPrefs>) {
    const merged = { ...prefs, ...next };
    setPrefs(merged);
    saveA11yPrefs(merged);
  }

  return (
    <div className={styles.prefs} aria-busy={!ready}>
      <section className={styles.prefGroup} aria-labelledby="a11y-size">
        <h2 id="a11y-size">Tamanho do texto</h2>
        <RadioCards aria-labelledby="a11y-size" layout="list" options={SIZES} value={String(prefs.textScale)} onValueChange={(value) => update({ textScale: Number(value) as A11yPrefs["textScale"] })} />
        <p className={styles.preview} aria-live="polite">Prévia: assim fica o texto do app.</p>
      </section>
      <section className={styles.prefGroup} aria-label="Movimento e contraste">
        <div className={styles.switchRow}>
          <span><strong id="a11y-motion">Menos animação</strong><small>Troca efeitos e confetes por mudanças simples.</small></span>
          <Switch aria-labelledby="a11y-motion" checked={prefs.reduceMotion} onCheckedChange={(checked) => update({ reduceMotion: checked })} />
        </div>
        <div className={styles.switchRow}>
          <span><strong id="a11y-contrast">Alto contraste</strong><small>Textos e bordas mais escuros.</small></span>
          <Switch aria-labelledby="a11y-contrast" checked={prefs.highContrast} onCheckedChange={(checked) => update({ highContrast: checked })} />
        </div>
      </section>
      <p className={styles.prefNote}>Vale para este aparelho. O app também segue as opções de acessibilidade do seu celular.</p>
    </div>
  );
}
