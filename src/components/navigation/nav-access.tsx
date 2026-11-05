"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import type { UserDisplayInfo } from "@/shared/auth/actions";

/** Uma busca do usuário por carregamento de página, dividida entre o menu lateral e as abas da área. */
let pendingUser: Promise<UserDisplayInfo | null> | null = null;

export function loadNavUser() {
  // Import tardio: a ação de servidor só entra quando alguém pede o usuário (e testes de tela não a carregam).
  pendingUser ??= import("@/shared/auth/actions").then(({ getUserDisplayInfo }) => getUserDisplayInfo()).catch(() => {
    pendingUser = null;
    return null;
  });
  return pendingUser;
}

export function useNavUser(initialUser?: UserDisplayInfo | null) {
  const [user, setUser] = useState<UserDisplayInfo | null>(initialUser ?? null);
  useEffect(() => {
    if (initialUser) return;
    let active = true;
    void loadNavUser().then((value) => {
      if (active) setUser(value);
    });
    return () => {
      active = false;
    };
  }, [initialUser]);
  return user;
}

type NavFlags = {
  negotiationsEnabled: boolean;
  /** Usuário e caminho já conhecidos (só nas prévias de desenvolvimento, como no menu lateral). */
  initialUser?: UserDisplayInfo | null;
  previewPathname?: string;
};

const NavFlagsContext = createContext<NavFlags>({ negotiationsEnabled: false });

export function NavFlagsProvider({ negotiationsEnabled, initialUser, previewPathname, children }: NavFlags & { children: ReactNode }) {
  return <NavFlagsContext.Provider value={{ negotiationsEnabled, initialUser, previewPathname }}>{children}</NavFlagsContext.Provider>;
}

export function useNavFlags() {
  return useContext(NavFlagsContext);
}
