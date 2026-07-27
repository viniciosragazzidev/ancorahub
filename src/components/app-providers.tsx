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
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      }).then(
        (reg) => console.log("SW registrado com sucesso:", reg.scope),
        (err) => console.error("Falha no SW:", err)
      );
    }
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
