"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { LEAD_OFFER_STATE_EVENT } from "@/components/providers/realtime-sync-provider";
import type { JourneyCelebration } from "@/features/engagement/journey-types";

import { markJourneyCelebrationsSeenAction } from "../actions";
import { CelebrationLayer } from "./celebration-layer";

const POLL_MS = 30_000;
/** Breathing room after an offer leaves, so a celebration never lands on top of the broker's next tap. */
const AFTER_OFFER_MS = 1_500;

/**
 * Mounted once in the Lite chrome (journey flag on). Reads only the broker's
 * unseen celebrations (cheap index), every 30 s and when the window regains
 * focus; never while the tab is hidden. Holds everything while a lead offer is
 * on screen.
 */
export function CelebrationHost() {
  const [items, setItems] = useState<JourneyCelebration[]>([]);
  const [offerActive, setOfferActive] = useState(false);
  const [cooling, setCooling] = useState(false);
  const seen = useRef(new Set<string>());

  const load = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    try {
      const response = await fetch("/api/journey/celebrations", { cache: "no-store" });
      if (!response.ok) return;
      const body = (await response.json()) as { items?: JourneyCelebration[] };
      setItems((body.items ?? []).filter((item) => !seen.current.has(item.id)));
    } catch { /* offline: try again on the next tick */ }
  }, []);

  useEffect(() => {
    const first = window.setTimeout(load, 2_000);
    const timer = window.setInterval(load, POLL_MS);
    const onFocus = () => { void load(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => { window.clearTimeout(first); window.clearInterval(timer); window.removeEventListener("focus", onFocus); document.removeEventListener("visibilitychange", onFocus); };
  }, [load]);

  useEffect(() => {
    setOfferActive(document.documentElement.dataset.leadOffer === "1");
    let timer = 0;
    const onOffer = (event: Event) => {
      const active = Boolean((event as CustomEvent<{ active: boolean }>).detail?.active);
      setOfferActive(active);
      window.clearTimeout(timer);
      if (!active) {
        setCooling(true);
        timer = window.setTimeout(() => setCooling(false), AFTER_OFFER_MS);
      }
    };
    window.addEventListener(LEAD_OFFER_STATE_EVENT, onOffer);
    return () => { window.removeEventListener(LEAD_OFFER_STATE_EVENT, onOffer); window.clearTimeout(timer); };
  }, []);

  // The screen tour holds the celebrations until it closes (one overlay at a time).
  const [tourActive, setTourActive] = useState(false);
  useEffect(() => {
    const read = () => setTourActive(document.documentElement.dataset.liteTour === "1");
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-lite-tour"] });
    return () => observer.disconnect();
  }, []);

  const onSeen = useCallback((ids: string[]) => {
    ids.forEach((id) => seen.current.add(id));
    setItems((current) => current.filter((item) => !ids.includes(item.id)));
    void markJourneyCelebrationsSeenAction(ids).catch(() => undefined);
  }, []);

  if (!items.length) return null;
  return <CelebrationLayer items={items} blocked={offerActive || cooling || tourActive} onSeen={onSeen} />;
}
