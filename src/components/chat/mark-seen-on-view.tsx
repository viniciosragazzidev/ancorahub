"use client";

import { useEffect } from "react";

import { markAllNotificationsReadAction } from "@/app/(dashboard)/notificacoes/actions";
import { markJourneyCelebrationsSeenAction } from "@/features/journey/actions";

import { CHAT_RAIL_REFRESH_EVENT } from "./chat-events";


/**
 * Opening the Âncora (or the Jornada) and staying on it counts as seeing it:
 * after a moment the unread notices (or the new celebrations) are marked as seen
 * and the blue dot leaves the list. A failure (e.g. "Ver como", which refuses
 * writes) changes nothing on screen.
 */
export function MarkSeenOnView({ kind, ids = [] }: { kind: "ancora" | "jornada"; ids?: string[] }) {
  const key = ids.join(",");
  useEffect(() => {
    if (kind === "jornada" && !key) return;
    const timer = window.setTimeout(() => {
      const done = kind === "ancora" ? markAllNotificationsReadAction() : markJourneyCelebrationsSeenAction(key.split(",").slice(0, 20));
      void Promise.resolve(done)
        .then(() => window.dispatchEvent(new Event(CHAT_RAIL_REFRESH_EVENT)))
        .catch(() => undefined);
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [kind, key]);
  return null;
}
