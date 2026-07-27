"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useShortcuts } from "./keyboard-shortcuts-provider";

export function useRegisterDefaultShortcuts() {
  const router = useRouter();
  const { register } = useShortcuts();

  useEffect(() => {
    const unregisters: (() => void)[] = [];

    unregisters.push(
      register({
        id: "shortcut_new_lead",
        label: "Novo lead",
        keys: "Ctrl+N",
        category: "Navegação",
        handler: () => {
          // Try to click the "Novo lead" button if visible
          const btn = document.querySelector<HTMLAnchorElement>(
            'a[href*="/leads/new"], a[href*="/leads/cadastrar"]',
          );
          if (btn) {
            btn.click();
          } else {
            router.push("/leads/cadastrar");
          }
        },
      }),
    );

    unregisters.push(
      register({
        id: "shortcut_tasks",
        label: "Tarefas",
        keys: "Ctrl+T",
        category: "Navegação",
        handler: () => router.push("/tarefas"),
      }),
    );

    unregisters.push(
      register({
        id: "shortcut_conversations",
        label: "Conversas",
        keys: "Ctrl+Shift+C",
        category: "Navegação",
        handler: () => router.push("/conversas"),
      }),
    );

    unregisters.push(
      register({
        id: "shortcut_dashboard",
        label: "Dashboard",
        keys: "g d",
        category: "Navegação",
        handler: () => router.push("/dashboard"),
      }),
    );

    unregisters.push(
      register({
        id: "shortcut_leads",
        label: "Leads",
        keys: "g l",
        category: "Navegação",
        handler: () => router.push("/leads"),
      }),
    );

    unregisters.push(
      register({
        id: "shortcut_clients",
        label: "Clientes",
        keys: "g c",
        category: "Navegação",
        handler: () => router.push("/clientes"),
      }),
    );

    unregisters.push(
      register({
        id: "shortcut_team",
        label: "Equipe",
        keys: "g e",
        category: "Navegação",
        handler: () => router.push("/equipe"),
      }),
    );

    unregisters.push(
      register({
        id: "shortcut_notifications",
        label: "Notificações",
        keys: "g n",
        category: "Navegação",
        handler: () => router.push("/notificacoes"),
      }),
    );

    unregisters.push(
      register({
        id: "shortcut_settings",
        label: "Configurações",
        keys: "Ctrl+,",
        category: "Navegação",
        handler: () => router.push("/settings"),
      }),
    );

    unregisters.push(
      register({
        id: "shortcut_queue",
        label: "Minha fila",
        keys: "g f",
        category: "Navegação",
        handler: () => router.push("/minha-fila"),
      }),
    );

    return () => unregisters.forEach((unreg) => unreg());
  }, [router, register]);
}
