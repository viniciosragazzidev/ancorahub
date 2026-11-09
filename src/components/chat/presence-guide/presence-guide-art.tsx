"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { cn } from "@/utils/core/cn";

import type { GuidePlatform } from "./presence-guide-steps";
import styles from "./presence-guide.module.css";

/** Ilustrações do roteiro de presença (09/11): formas simples, sem texto miúdo; o verde do WhatsApp só aqui dentro. */
export const guideEase = [0.16, 1, 0.3, 1] as const;

export function Tiles({ code, ok = false, big = false, small = false }: { code: string; ok?: boolean; big?: boolean; small?: boolean }) {
  const reduce = useReducedMotion();
  const chars = code.replace(/[^A-Z0-9]/gi, "").toUpperCase().padEnd(8, "•").slice(0, 8).split("");
  const tile = (char: string, index: number) => (
    <motion.span
      key={index}
      className={styles.tile}
      data-ok={ok}
      style={small ? { width: 18, height: 26, fontSize: 12, borderRadius: 6 } : undefined}
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0, scale: ok && !reduce ? [1, 1.08, 1] : 1 }}
      transition={{ delay: reduce ? 0 : ok ? index * 0.03 : 0.05 + index * 0.05, duration: 0.24, ease: guideEase }}
    >
      {char}
    </motion.span>
  );
  return (
    <div className={cn(styles.tiles, big && styles.tilesBig)} role="img" aria-label={`Código ${chars.slice(0, 4).join("")} ${chars.slice(4).join("")}`} style={small ? { gap: 3 } : undefined}>
      {chars.slice(0, 4).map(tile)}
      <span className={styles.tileDash} aria-hidden="true" style={small ? { width: 4 } : undefined} />
      {chars.slice(4).map((char, index) => tile(char, index + 4))}
    </div>
  );
}

export function TilesSkeleton() {
  const reduce = useReducedMotion();
  return (
    <div className={styles.tiles} aria-hidden="true">
      {Array.from({ length: 8 }).map((_, index) => (
        <motion.span key={index} className={styles.skeletonTile} animate={reduce ? undefined : { opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.2, repeat: Infinity, delay: index * 0.08 }} />
      ))}
    </div>
  );
}

function Tap({ style, dot = true }: { style: React.CSSProperties; dot?: boolean }) {
  const reduce = useReducedMotion();
  return (
    <>
      {dot ? <span className={styles.tapDot} style={{ ...style, transform: "translate(7px, 7px)" }} /> : null}
      {reduce ? null : <motion.span className={styles.tap} style={style} initial={{ scale: 0.5, opacity: 1 }} animate={{ scale: 1.7, opacity: 0 }} transition={{ duration: 1, repeat: Infinity, ease: "easeOut" }} />}
    </>
  );
}

/**
 * "Garanta que está na tela inicial": alterna entre uma conversa aberta (com o toque na seta ←) e a lista
 * Conversas. Android mostra a seta; iPhone, o "‹" de voltar.
 */
export function HomeScreenArt({ platform }: { platform: GuidePlatform }) {
  const reduce = useReducedMotion();
  const [frame, setFrame] = React.useState<"chat" | "list">("chat");
  React.useEffect(() => {
    if (reduce) return;
    const timer = window.setInterval(() => setFrame((current) => (current === "chat" ? "list" : "chat")), 1_900);
    return () => window.clearInterval(timer);
  }, [reduce]);
  const shown = reduce ? "chat" : frame;
  return (
    <div className={styles.mock} aria-hidden="true">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={shown} initial={reduce ? false : { opacity: 0, x: shown === "list" ? -16 : 16 }} animate={{ opacity: 1, x: 0 }} exit={reduce ? undefined : { opacity: 0 }} transition={{ duration: 0.26, ease: guideEase }}>
          {shown === "chat" ? (
            <>
              <div className={styles.chatHead}>
                <span className={styles.chatBack}>
                  {platform === "iphone" ? "‹" : "←"}
                  {/* Só o anel: o ponto cobriria a seta que o corretor precisa reconhecer. */}
                  <Tap style={{ left: 1, top: 1 }} dot={false} />
                </span>
                <span className={styles.chatAvatar} />
                <span className={styles.chatName} />
              </div>
              <div className={styles.bubbleIn} />
              <div className={styles.bubbleOut} />
              <div className={styles.bubbleIn} style={{ width: "54%" }} />
              <div className={styles.bubbleOut} style={{ width: "40%" }} />
            </>
          ) : (
            <>
              <div className={styles.mockTop}><span className={styles.mockBrand}><WaIcon /> WhatsApp</span></div>
              <div className={styles.listTitle}>Conversas</div>
              {[0, 1, 2, 3].map((index) => (
                <div key={index} className={styles.convRow} style={{ opacity: 1 - index * 0.14 }}><span className={styles.convAvatar} /><span className={styles.convLine} /></div>
              ))}
              <span className={styles.homeOk}><CheckIcon size={12} /> Tela inicial</span>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/** Aviso antes de abrir: a tela inicial (Conversas) com o toque nos 3 pontinhos (no iPhone, em Configurações). */
export function BeforeOpenArt({ platform }: { platform: GuidePlatform }) {
  return (
    <div className={styles.mock} style={{ width: 150, height: 170, borderRadius: 24 }} aria-hidden="true">
      <div className={styles.mockTop}>
        <span className={styles.mockBrand}><WaIcon /> WhatsApp</span>
        <span className={styles.mockDots} style={platform === "android" ? { background: "var(--wa-soft)", color: "var(--wa-ink)", outline: "2px solid var(--wa)" } : undefined}>
          ⋮{platform === "android" ? <Tap style={{ left: 1, top: 1 }} dot={false} /> : null}
        </span>
      </div>
      <div className={styles.listTitle} style={{ fontSize: 12 }}>Conversas</div>
      {[0, 1].map((index) => <div key={index} className={styles.convRow} style={{ marginTop: 6 }}><span className={styles.convAvatar} style={{ width: 20, height: 20 }} /><span className={styles.convLine} /></div>)}
      {platform === "iphone" ? (
        <div style={{ position: "absolute", left: 8, right: 8, bottom: 8, display: "flex", justifyContent: "space-around", alignItems: "center", height: 30, borderTop: "1px solid var(--border)" }}>
          {[0, 1, 2, 3].map((index) => (
            <span key={index} style={{ position: "relative", width: 18, height: 18, borderRadius: 9999, background: index === 3 ? "var(--wa-soft)" : "var(--surface-muted)", outline: index === 3 ? "2px solid var(--wa)" : undefined }}>
              {index === 3 ? <Tap style={{ left: -4, top: -4 }} dot={false} /> : null}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** O caminho dentro do WhatsApp: um toque por cena, avançando pelo corretor (não por tempo). */
export function PhoneMock({ platform, scene }: { platform: GuidePlatform; scene: number }) {
  const reduce = useReducedMotion();
  return (
    <div className={styles.mock} aria-hidden="true">
      <div className={styles.mockTop}>
        <span className={styles.mockBrand}><WaIcon /> WhatsApp</span>
        <span className={styles.mockDots}>⋮{scene === 0 && platform === "android" ? <Tap style={{ left: 1, top: 1 }} /> : null}</span>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={`${platform}-${scene}`} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? undefined : { opacity: 0, y: -8 }} transition={{ duration: 0.22, ease: guideEase }}>
          {scene === 0 ? (
            <>
              {[0, 1, 2, 3, 4].map((index) => <div key={index} className={styles.mockLine} style={{ opacity: 1 - index * 0.12 }} />)}
              {platform === "iphone" ? (
                <div style={{ position: "absolute", left: 10, right: 10, bottom: 10, display: "flex", justifyContent: "space-around", alignItems: "center", height: 40, borderTop: "1px solid var(--border)" }}>
                  {[0, 1, 2, 3].map((index) => (
                    <span key={index} style={{ position: "relative", width: 22, height: 22, borderRadius: 9999, background: index === 3 ? "var(--wa-soft)" : "var(--surface-muted)", outline: index === 3 ? "2px solid var(--wa)" : undefined }}>
                      {index === 3 ? <Tap style={{ left: -2, top: -2 }} /> : null}
                    </span>
                  ))}
                </div>
              ) : null}
            </>
          ) : scene === 1 ? (
            <>
              <div className={styles.mockRow}>Novo grupo</div>
              <div className={styles.mockRow} data-hot="true">Dispositivos conectados<Tap style={{ right: 6, top: 4 }} /></div>
              <div className={styles.mockRow}>Configurações</div>
              <div className={styles.mockRow}>Favoritas</div>
            </>
          ) : scene === 2 ? (
            <div className={styles.mockCenter}>
              <div className={styles.mockQr} style={{ width: 64, height: 64, borderStyle: "solid", margin: "24px auto 16px" }} />
              <div className={styles.mockRow} data-hot="true" style={{ justifyContent: "center" }}>Conectar dispositivo<Tap style={{ right: 6, top: 4 }} /></div>
            </div>
          ) : (
            <div className={styles.mockCenter}>
              <div className={styles.mockQr} />
              <div className={styles.mockRow} data-hot="true" style={{ justifyContent: "center" }}>Conectar com número<Tap style={{ right: 4, top: 4 }} /></div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export function WaitingMock({ code }: { code: string | null }) {
  return (
    <div className={styles.mock} aria-hidden="true">
      <div className={styles.mockTop}><span className={styles.mockBrand}><WaIcon /> WhatsApp</span></div>
      <div style={{ height: 40 }} />
      <Tiles code={code ?? ""} small />
    </div>
  );
}

export function WaitDots() {
  const reduce = useReducedMotion();
  return (
    <span className={styles.waitDots} aria-hidden="true">
      {[0, 1, 2].map((index) => <motion.span key={index} className={styles.waitDot} animate={reduce ? undefined : { opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: index * 0.15 }} />)}
    </span>
  );
}

export function BigCheck() {
  const reduce = useReducedMotion();
  return (
    <motion.span className={styles.checkBig} initial={reduce ? false : { scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", visualDuration: 0.4, bounce: 0.3 }} aria-hidden="true">
      <svg viewBox="0 0 24 24" width="48" height="48">
        <motion.path d="M5 12.5 10 17.5 19 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.45, ease: guideEase, delay: 0.15 }} />
      </svg>
    </motion.span>
  );
}

export function AttentionArt() {
  return (
    <span className={styles.checkBig} style={{ background: "var(--att-soft)", color: "var(--att-ink)" }} aria-hidden="true">
      <svg viewBox="0 0 24 24" width="44" height="44"><path d="M12 7v6M12 16.5v.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
    </span>
  );
}

export function WelcomeArt() {
  const reduce = useReducedMotion();
  return (
    <div style={{ position: "relative", display: "grid", placeItems: "center", width: 160, height: 120 }} aria-hidden="true">
      <motion.span style={{ position: "absolute", width: 120, height: 120, borderRadius: 9999, background: "var(--wa-soft)" }} animate={reduce ? undefined : { scale: [1, 1.06, 1] }} transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }} />
      <span style={{ position: "relative", width: 64, height: 104, borderRadius: 16, border: "2px solid var(--foreground)", background: "var(--surface)", display: "grid", placeItems: "center" }}>
        <span style={{ width: 36, height: 36, borderRadius: 9999, background: "var(--wa)", display: "grid", placeItems: "center" }}><WaIcon light size={20} /></span>
      </span>
    </div>
  );
}

export function CheckIcon({ size = 16 }: { size?: number }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true"><path d="M5 12.5 10 17.5 19 7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
export function LockIcon() {
  return <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>;
}
export function CopyIcon() {
  return <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>;
}
export function CameraIcon() {
  return <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true"><path d="M2.5 5.5A1.5 1.5 0 0 1 4 4h1.4l1-1.5h3.2l1 1.5H12a1.5 1.5 0 0 1 1.5 1.5v6A1.5 1.5 0 0 1 12 13H4a1.5 1.5 0 0 1-1.5-1.5Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><circle cx="8" cy="8.5" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>;
}
export function CloseIcon() {
  return <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
}
export function WaIcon({ light = false, size = 16 }: { light?: boolean; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" style={{ color: light ? "white" : "var(--wa)" }}>
      <path d="M12 3.5a8.5 8.5 0 0 0-7.3 12.8L3.5 20.5l4.3-1.1A8.5 8.5 0 1 0 12 3.5Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 8.5c0 3.5 2.6 6.5 6.5 6.5l.8-1.6-1.8-.9-.9.9c-1-.4-2-1.4-2.4-2.4l.9-.9-.9-1.8L9.6 8z" fill="currentColor" />
    </svg>
  );
}
