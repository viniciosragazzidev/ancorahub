"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { NoticeCardBody, noticeLink, noticeRowClass } from "@/components/notifications/notice-card";

import styles from "./chat.module.css";
import type { ChatBlock, ChatChoice, ChatLeadRow, ChatListItem } from "./types";
import { LiveBlockView } from "./live-blocks";
import { ConsentCard } from "./consent-card";
import { PausedHero } from "./paused-hero";
import { PresenceCallout } from "./presence-callout";

const LETTERS = "ABCDEFGHIJ";
const enter = { duration: 0.18, ease: [0.16, 1, 0.3, 1] as const };

function Chevron() {
  return <svg viewBox="0 0 16 16" className={styles.choiceChevron} aria-hidden="true"><path d="m6 3.5 4.5 4.5L6 12.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function CopyIcon() {
  return <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="5" y="5" width="8.5" height="8.5" rx="2" fill="none" stroke="currentColor" strokeWidth="1.3" /><path d="M10.5 5V3.5a1.5 1.5 0 0 0-1.5-1.5H3.5A1.5 1.5 0 0 0 2 3.5V9a1.5 1.5 0 0 0 1.5 1.5H5" fill="none" stroke="currentColor" strokeWidth="1.3" /></svg>;
}

/** Three dots while the assistant "writes" the next message. */
export function TypingIndicator({ label }: { label?: string }) {
  const reduce = useReducedMotion();
  return (
    <div className={styles.typing} role="status" aria-label={label ?? "Escrevendo"}>
      <span className={styles.typingDots}>
        {[0, 1, 2].map((dot) => (
          <motion.span
            key={dot}
            className={styles.typingDot}
            animate={reduce ? undefined : { opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
            transition={reduce ? undefined : { duration: 1, repeat: Infinity, delay: dot * 0.15 }}
          />
        ))}
      </span>
      {label ? <span>{label}</span> : null}
    </div>
  );
}

/** A question with lettered suggested replies (A, B, C...). Letters on the keyboard choose too. */
export function ChoiceList({
  block,
  chosenId,
  disabled,
  onChoose,
}: {
  block: Extract<ChatBlock, { type: "question" }>;
  chosenId?: string | null;
  disabled?: boolean;
  onChoose: (choice: ChatChoice) => void;
}) {
  const reduce = useReducedMotion();
  const answered = Boolean(chosenId);

  useEffect(() => {
    if (answered || disabled) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      const index = LETTERS.indexOf(event.key.toUpperCase());
      if (index >= 0 && index < block.choices.length && event.key.length === 1) onChoose(block.choices[index]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [answered, block.choices, disabled, onChoose]);

  return (
    <div className={styles.question} role="group" aria-label={block.prompt}>
      <p className={styles.prompt}>{block.prompt}</p>
      <ul className={styles.choices}>
        <AnimatePresence initial={!reduce}>
          {block.choices.map((choice, index) => {
            const chosen = chosenId === choice.id;
            if (answered && !chosen) return null;
            return (
              <motion.li
                key={choice.id}
                layout={!reduce}
                initial={reduce ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, transition: { duration: 0.12 } }}
                transition={{ ...enter, delay: reduce ? 0 : 0.05 + index * 0.04 }}
              >
                <button
                  type="button"
                  className={`${styles.choice} ${chosen ? styles.choiceChosen : ""}`}
                  disabled={disabled || answered}
                  aria-pressed={chosen}
                  onClick={() => onChoose(choice)}
                >
                  <span className={styles.choiceLetter} aria-hidden="true">{LETTERS[index]}</span>
                  <span>
                    <span className={styles.choiceLabel}>{choice.label}</span>
                    {choice.hint ? <span className={styles.choiceHint}>{choice.hint}</span> : null}
                  </span>
                  <Chevron />
                </button>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </div>
  );
}

function AssistantText({ block }: { block: Extract<ChatBlock, { type: "assistant" }> }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <p className={styles.assistant} style={{ margin: 0 }}>{block.text}</p>
      {block.at ? (
        <div className={styles.messageFooter}>
          <button type="button" aria-label={copied ? "Copiado" : "Copiar mensagem"} onClick={() => { void navigator.clipboard?.writeText(block.text).then(() => setCopied(true)); }}><CopyIcon /></button>
          <span>{block.at}</span>
        </div>
      ) : null}
    </div>
  );
}

/** Renders one block of a conversation. Questions are rendered by the screen (they need state). */
function WhatsAppGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
      <path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.5-.3Z" />
    </svg>
  );
}

const SWIPE_DISTANCE = 96;

/**
 * A list row that can be swiped to the left to run its action (Agenda: cancel a
 * return). Past the line it goes; short of it, it springs back. The same action
 * is a real button for keyboards and screen readers, revealed on focus.
 */
function SwipeRow({ item, disabled, onSwipe, children }: { item: ChatListItem & { swipe: NonNullable<ChatListItem["swipe"]> }; disabled?: boolean; onSwipe: (item: ChatListItem) => void; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  const [armed, setArmed] = useState(false);
  const dragged = useRef(false);
  return (
    // The row is a link: the browser's own link dragging would steal the gesture.
    <div className={styles.swipe} data-armed={armed || undefined} onDragStart={(event) => event.preventDefault()}>
      <motion.div
        className={styles.swipeFront}
        drag={disabled ? false : "x"}
        dragDirectionLock
        dragConstraints={{ left: -220, right: 0 }}
        dragElastic={{ left: 0.15, right: 0 }}
        dragSnapToOrigin
        transition={reduce ? { duration: 0 } : undefined}
        onDragStart={() => { dragged.current = true; }}
        onDrag={(_, info) => setArmed(info.offset.x < -SWIPE_DISTANCE)}
        onDragEnd={(_, info) => {
          setArmed(false);
          if (info.offset.x < -SWIPE_DISTANCE || (info.offset.x < -40 && info.velocity.x < -700)) onSwipe(item);
          // The click that ends a drag must not open the lead.
          window.setTimeout(() => { dragged.current = false; }, 0);
        }}
        onClickCapture={(event) => { if (dragged.current) { event.preventDefault(); event.stopPropagation(); } }}
      >
        {children}
      </motion.div>
      <button type="button" className={styles.swipeAction} disabled={disabled} onClick={() => onSwipe(item)} aria-label={`${item.swipe.label}: ${[item.primary, item.secondary].filter(Boolean).join(", ")}`}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        <span>{item.swipe.label}</span>
      </button>
    </div>
  );
}

export function ChatBlockView({ block, onSystemAction, onButtonOpen, onItemSwipe, swipeDisabled, onLeadOpen, onConsent }: { block: Exclude<ChatBlock, { type: "question" }>; onSystemAction?: (block: Extract<ChatBlock, { type: "system" }>) => void; onButtonOpen?: (block: Extract<ChatBlock, { type: "button" }>, event: React.MouseEvent<HTMLAnchorElement>) => void; onItemSwipe?: (item: ChatListItem) => void; swipeDisabled?: boolean; onLeadOpen?: (row: ChatLeadRow) => void; onConsent?: (block: Extract<ChatBlock, { type: "consent" }>, allow: boolean) => Promise<boolean> }) {
  const reduce = useReducedMotion();
  switch (block.type) {
    case "leads":
    case "stats":
    case "leadcard":
      return <LiveBlockView block={block} onLeadOpen={onLeadOpen} />;
    case "consent":
      return <ConsentCard block={block} onDecide={onConsent} />;
    case "paused":
      return <PausedHero block={block} />;
    case "presence":
      return <PresenceCallout ask={block.ask} variant="chat" />;
    case "button": {
      const external = /^https?:/.test(block.href);
      return (
        <div className={styles.buttonBlock}>
          {block.text ? <p className={styles.assistant}>{block.text}</p> : null}
          <a
            href={block.href}
            target={external ? "_blank" : undefined}
            rel={external ? "noopener noreferrer" : undefined}
            className={`${styles.linkButton} ${block.tone === "whatsapp" ? styles.linkButtonWhatsapp : ""}`}
            onClick={(event) => onButtonOpen?.(block, event)}
          >
            {block.tone === "whatsapp" ? <WhatsAppGlyph /> : null}
            {block.label}
          </a>
        </div>
      );
    }
    case "date":
      return <p className={styles.date}>{block.label}</p>;
    case "system":
      return (
        <p className={styles.system}>
          {block.strong ? <><strong>{block.strong}</strong> </> : null}{block.text}
          {block.action ? <>{" · "}<button type="button" className={styles.systemAction} onClick={() => onSystemAction?.(block)}>{block.action.label}</button></> : null}
        </p>
      );
    case "assistant":
      return <AssistantText block={block} />;
    case "notice": {
      const link = noticeLink({ type: block.noticeType, leadId: block.leadId });
      const body = <NoticeCardBody type={block.noticeType} leadId={block.leadId} title={block.title} message={block.message} time={block.at} timeIso={block.atIso} unread={block.unread} linkLabel={link?.label} />;
      return link
        ? <Link href={link.href} className={`${noticeRowClass} ${styles.notice}`}>{body}</Link>
        : <div className={`${noticeRowClass} ${styles.notice} ${styles.noticeStatic}`}>{body}</div>;
    }
    case "user":
      return <p className={styles.user}>{block.text}</p>;
    case "whatsapp": {
      const label = block.from === "client" ? "Cliente" : block.from === "qualification" ? "Qualificação" : "Você";
      const tone = block.from === "client" ? styles.bubbleClient : block.from === "qualification" ? styles.bubbleQualification : styles.bubbleBroker;
      return (
        <div className={`${styles.bubble} ${tone}`}>
          <span className={styles.bubbleLabel}>{label}{block.at ? ` · ${block.at}` : ""}</span>
          <p className={styles.bubbleText}>{block.text}</p>
        </div>
      );
    }
    case "facts":
      return (
        <section className={styles.card} aria-label={block.title}>
          <header className={styles.cardHeader}>
            <span>
              <span className={styles.cardTitle} style={{ display: "block" }}>{block.title}</span>
              {block.subtitle ? <span className={styles.cardSubtitle}>{block.subtitle}</span> : null}
            </span>
            {block.href ? <Link href={block.href} className={styles.cardLink}>{block.hrefLabel ?? "Ver ficha"}</Link> : null}
          </header>
          <dl className={styles.facts}>
            {block.rows.map((row) => (
              <div key={row.label} style={{ display: "contents" }}>
                <dt>{row.label}</dt>
                <dd>{row.value}{row.badge ? <span className={styles.factBadge}>{row.badge}</span> : null}</dd>
              </div>
            ))}
          </dl>
        </section>
      );
    case "list":
      return (
        <section className={styles.card} aria-label={block.title}>
          <header className={styles.cardHeader}>
            <span>
              <span className={styles.cardTitle} style={{ display: "block" }}>{block.title}</span>
              {block.subtitle ? <span className={styles.cardSubtitle}>{block.subtitle}</span> : null}
            </span>
          </header>
          {block.items.length ? (
            <ul className={styles.listRows}>
              {block.items.map((item) => {
                const content = (
                  <>
                    {item.lead ? <span className={styles.listLead}>{item.lead}</span> : <span />}
                    <span style={{ minWidth: 0 }}>
                      <span className={styles.listPrimary} style={{ display: "block" }}>{item.primary}</span>
                      {item.secondary ? <span className={styles.listSecondary}>{item.secondary}</span> : null}
                    </span>
                    {item.trailing ? <span className={styles.listTrailing}>{item.trailing}</span> : <span />}
                  </>
                );
                const row = item.href ? <Link href={item.href} className={styles.listRow}>{content}</Link> : <div className={styles.listRow}>{content}</div>;
                return <li key={item.id}>{item.swipe && onItemSwipe ? <SwipeRow item={{ ...item, swipe: item.swipe }} disabled={swipeDisabled} onSwipe={onItemSwipe}>{row}</SwipeRow> : row}</li>;
              })}
            </ul>
          ) : <p className={styles.cardSubtitle} style={{ padding: "0 16px 16px", margin: 0 }}>{block.emptyText ?? "Nada por aqui ainda."}</p>}
        </section>
      );
    case "bars": {
      const max = Math.max(1, ...block.values.map((item) => item.value));
      return (
        <section className={styles.card} aria-label={block.title}>
          <header className={styles.cardHeader}>
            <span>
              <span className={styles.cardTitle} style={{ display: "block" }}>{block.title}</span>
              {block.subtitle ? <span className={styles.cardSubtitle}>{block.subtitle}</span> : null}
            </span>
          </header>
          <div className={styles.bars} role="img" aria-label={block.values.map((item) => `${item.label}: ${item.value}`).join(", ")}>
            {block.values.map((item, index) => (
              <motion.span
                key={item.label}
                className={`${styles.bar} ${item.highlight ? styles.barHighlight : ""}`}
                style={{ height: `${Math.max(4, (item.value / max) * 100)}%` }}
                initial={reduce ? false : { scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ type: "spring", visualDuration: 0.4, bounce: 0, delay: reduce ? 0 : index * 0.03 }}
                title={`${item.label}: ${item.value}`}
              />
            ))}
          </div>
        </section>
      );
    }
    case "steps":
      return (
        <section aria-label={block.title}>
          <p className={styles.cardSubtitle} style={{ margin: "0 0 8px" }}>{block.title}</p>
          <ul className={styles.steps} style={{ padding: 0 }}>
            {block.steps.map((step) => (
              <li key={step.id} className={`${styles.step} ${step.done ? styles.stepDone : ""}`}>
                <span aria-hidden="true">{step.done ? "✓" : "·"}</span>{step.text}
              </li>
            ))}
          </ul>
        </section>
      );
  }
}

/** Wraps a block so it enters like a new message (rises 8px and fades in). */
export function MessageEnter({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...enter, delay: reduce ? 0 : delay }}>
      {children}
    </motion.div>
  );
}
