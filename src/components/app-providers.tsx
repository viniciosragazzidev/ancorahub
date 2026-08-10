"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";
import { KeyboardShortcutsProvider } from "@/components/keyboard-shortcuts-provider";
import { useRegisterDefaultShortcuts } from "@/components/keyboard-shortcuts";

function ShortcutRegistrar() {
  useRegisterDefaultShortcuts();
  return null;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: true,
        refetchOnReconnect: "always",
        networkMode: "online",
      },
      mutations: { networkMode: "online" },
    },
  }));

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // Emergency PWA recovery: a previously installed worker can keep an App
    // Router transition on its loading boundary even after a deployment.
    // The CRM must always prefer live operational pages over offline caching.
    void navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
      .catch(() => undefined);
  }, []);

  return (
    <ThemeProvider>
      <KeyboardShortcutsProvider>
        <ShortcutRegistrar />
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </KeyboardShortcutsProvider>
      <PwaInstallPrompt />
    </ThemeProvider>
  );
}
