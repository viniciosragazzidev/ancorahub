"use client";

import React, { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getUserDisplayInfo, type UserDisplayInfo } from "@/shared/auth/actions";
import { ROLE_SHORTCUTS_MAP, type RoleShortcut } from "@/features/agent-drawer/prompt-builder";
import type { TenantContext } from "@/shared/auth/types";

type AgentDrawerContextType = {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  toggleOpen: () => void;
  user: UserDisplayInfo | null;
  shortcuts: RoleShortcut[];
  activePrompt: string | null;
  setActivePrompt: (prompt: string | null) => void;
};

const AgentDrawerContext = createContext<AgentDrawerContextType | undefined>(undefined);

export function AgentDrawerProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<UserDisplayInfo | null>(null);
  const [activePrompt, setActivePrompt] = useState<string | null>(null);

  useEffect(() => {
    getUserDisplayInfo().then(setUser);

    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+J or Ctrl+J to toggle drawer
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }

      // If drawer is open, handle Ctrl+1, Ctrl+2, Ctrl+3
      if (isOpen && e.ctrlKey && !e.metaKey && ["1", "2", "3"].includes(e.key)) {
        e.preventDefault();
        const role = (user?.role as TenantContext["role"]) ?? "broker";
        const roleShortcuts = ROLE_SHORTCUTS_MAP[role] ?? ROLE_SHORTCUTS_MAP.broker;
        const index = parseInt(e.key, 10) - 1;
        const targetShortcut = roleShortcuts[index];
        if (targetShortcut) {
          setActivePrompt(targetShortcut.prompt);
        }
      }
    };

    const handleCustomOpen = () => setIsOpen(true);

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("open-agent-drawer", handleCustomOpen);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("open-agent-drawer", handleCustomOpen);
    };
  }, [isOpen, user]);

  const role = (user?.role as TenantContext["role"]) ?? "broker";
  const shortcuts = ROLE_SHORTCUTS_MAP[role] ?? ROLE_SHORTCUTS_MAP.broker;

  const toggleOpen = () => setIsOpen((prev) => !prev);

  return (
    <AgentDrawerContext.Provider
      value={{
        isOpen,
        setIsOpen,
        toggleOpen,
        user,
        shortcuts,
        activePrompt,
        setActivePrompt,
      }}
    >
      {children}
    </AgentDrawerContext.Provider>
  );
}

export function useAgentDrawer() {
  const context = useContext(AgentDrawerContext);
  if (!context) {
    throw new Error("useAgentDrawer must be used within an AgentDrawerProvider");
  }
  return context;
}
