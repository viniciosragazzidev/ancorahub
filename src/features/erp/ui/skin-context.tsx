"use client";
import { createContext, useContext, type ReactNode } from "react";
import type { ErpSkin } from "./skin";

const ErpSkinContext = createContext<ErpSkin>("standard");
export function ErpSkinProvider({ skin, children }: { skin: ErpSkin; children: ReactNode }) {
  return <ErpSkinContext.Provider value={skin}>{children}</ErpSkinContext.Provider>;
}
export function useErpSkin() { return useContext(ErpSkinContext); }
