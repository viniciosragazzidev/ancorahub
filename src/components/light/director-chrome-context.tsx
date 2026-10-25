"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { UserDisplayInfo } from "@/shared/auth/actions";
import type { ViewAsState } from "@/features/super-admin/components/view-as";

export type DirectorShellUser = {
  name: string | null;
  email: string | null;
  role?: string;
  jobTitle?: string | null;
  isPlatformAdmin?: boolean;
};

type DirectorChromeValue = {
  shellUser?: DirectorShellUser;
  viewAs: ViewAsState;
  profile: UserDisplayInfo | null;
  setProfile: (profile: UserDisplayInfo) => void;
};

const DirectorChromeContext = createContext<DirectorChromeValue | null>(null);

export function DirectorChromeProvider({
  children,
  shellUser,
  viewAs,
}: {
  children: ReactNode;
  shellUser?: DirectorShellUser;
  viewAs: ViewAsState;
}) {
  const [profile, setProfile] = useState<UserDisplayInfo | null>(null);
  const value = useMemo(() => ({ shellUser, viewAs, profile, setProfile }), [shellUser, viewAs, profile]);
  return <DirectorChromeContext.Provider value={value}>{children}</DirectorChromeContext.Provider>;
}

export function useDirectorChrome() {
  return useContext(DirectorChromeContext);
}
