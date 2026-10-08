"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  const id = window.setInterval(onChange, 30_000);
  return () => window.clearInterval(id);
}

// Rounded to the minute so the snapshot is stable between reads.
const getSnapshot = () => Math.floor(Date.now() / 60_000) * 60_000;
// The server has no clock to show: 0 means "not mounted yet", so first render matches the client.
const getServerSnapshot = () => 0;

/** The current time, ticking every 30 seconds; null during server render and hydration. */
export function useMinuteClock() {
  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return value ? new Date(value) : null;
}
