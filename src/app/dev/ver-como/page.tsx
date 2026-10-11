"use client";

import "@/components/arc/venancor-scope.css";

import { notFound, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { ViewAsBanner, ViewAsButton } from "@/features/super-admin/components/view-as";

/** Dev-only showcase of the super admin "Ver como". /dev/ver-como?viewing=1 */
function Showcase() {
  const viewing = useSearchParams().get("viewing") === "1";
  const state = { canViewAs: true, viewingAs: viewing ? { name: "Ana Lima", role: "broker" } : null };
  return (
    <>
      <ViewAsBanner viewingAs={state.viewingAs} />
      <div className="arc-venancor mx-auto grid max-w-md gap-3 bg-[var(--surface)] p-4">
        <p className="text-sm text-[var(--text-muted)]">Fim do menu Mais:</p>
        <button type="button" className="h-12 rounded-full bg-[var(--surface-muted)] text-sm">Sair da conta</button>
        <ViewAsButton state={state} />
        <p className="mt-6 text-sm text-[var(--text-muted)]">Barra lateral do modo normal:</p>
        <div className="w-64"><ViewAsButton state={{ canViewAs: true, viewingAs: null }} variant="sidebar" /></div>
      </div>
    </>
  );
}

export default function ViewAsShowcasePage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <main><Suspense fallback={null}><Showcase /></Suspense></main>;
}
