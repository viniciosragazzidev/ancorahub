"use client";

import { useEffect } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";
import { KeyboardShortcutsProvider } from "@/components/keyboard-shortcuts-provider";
import { useRegisterDefaultShortcuts } from "@/components/keyboard-shortcuts";
import { PerformanceMonitor } from "@/components/providers/performance-monitor";

import { NuqsAdapter } from "nuqs/adapters/next/app";

function ShortcutRegistrar() {
  useRegisterDefaultShortcuts();
  return null;
}

export function AppProviders({ children, forceLightTheme = false, directorLiteEnabled = false }: { children: React.ReactNode; forceLightTheme?: boolean; directorLiteEnabled?: boolean }) {
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
    <NuqsAdapter>
      <ThemeProvider forceLightTheme={forceLightTheme}>
        <KeyboardShortcutsProvider directorLiteEnabled={directorLiteEnabled}>
          <ShortcutRegistrar />
          {children}
        </KeyboardShortcutsProvider>
        <PerformanceMonitor />
        <PwaInstallPrompt directorLiteEnabled={directorLiteEnabled} />
      </ThemeProvider>
    </NuqsAdapter>
  );
}
