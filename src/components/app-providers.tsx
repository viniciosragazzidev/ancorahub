"use client";

import { useEffect } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";
import { KeyboardShortcutsProvider } from "@/components/keyboard-shortcuts-provider";
import { useRegisterDefaultShortcuts } from "@/components/keyboard-shortcuts";
import { PerformanceMonitor } from "@/components/providers/performance-monitor";

function ShortcutRegistrar() {
  useRegisterDefaultShortcuts();
  return null;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // The worker deliberately bypasses App Router navigations and RSC requests
    // (see public/sw.js). Keep it registered: browser push depends on a ready
    // Service Worker and unregistering it leaves the activation card loading.
    void navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => registration.update())
      .catch(() => undefined);
  }, []);

  return (
    <ThemeProvider>
      <KeyboardShortcutsProvider>
        <ShortcutRegistrar />
        {children}
      </KeyboardShortcutsProvider>      <PerformanceMonitor />
      <PwaInstallPrompt />
    </ThemeProvider>);
}
