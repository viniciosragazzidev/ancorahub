import type { PluginLifecycleEvent } from "./types";

export type PluginLifecycleListener = (event: PluginLifecycleEvent) => void;

export function createPluginLifecycle() {
  const listeners = new Set<PluginLifecycleListener>();

  return {
    subscribe(listener: PluginLifecycleListener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    emit(event: PluginLifecycleEvent) {
      for (const listener of listeners) listener(event);
    },
  };
}
