import type { NextBestAction } from "./types";

export type NBAEventName =
  | "nba_displayed"
  | "nba_clicked"
  | "nba_completed"
  | "nba_dismissed"
  | "nba_changed";

export type NBAEventPayload = {
  eventName: NBAEventName;
  actionKey: string;
  ruleId: string;
  priority: string;
  entityType: string;
  entityId?: string;
  route?: string;
  timestamp?: number;
};

export function trackNBAEvent(payload: NBAEventPayload): void {
  if (typeof window === "undefined") return;

  const eventData = {
    ...payload,
    timestamp: payload.timestamp ?? Date.now(),
  };

  // Dispatch custom DOM event for analytics listeners
  window.dispatchEvent(
    new CustomEvent("nba-telemetry", { detail: eventData }),
  );

  // Debug log in non-production
  if (process.env.NODE_ENV !== "production") {
    console.log("[NBA Telemetry]", eventData.eventName, eventData);
  }
}

export function trackNBADisplayed(action: NextBestAction, route?: string): void {
  trackNBAEvent({
    eventName: "nba_displayed",
    actionKey: action.key,
    ruleId: action.ruleId,
    priority: action.priority,
    entityType: action.entityType,
    entityId: action.entityId,
    route,
  });
}

export function trackNBAClicked(action: NextBestAction, route?: string): void {
  trackNBAEvent({
    eventName: "nba_clicked",
    actionKey: action.key,
    ruleId: action.ruleId,
    priority: action.priority,
    entityType: action.entityType,
    entityId: action.entityId,
    route,
  });
}
