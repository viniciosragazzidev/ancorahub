"use client";

import "@/components/arc/venancor-scope.css";

import { notFound, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { A11yPrefsProvider } from "@/features/assist/a11y-prefs";
import { AccessibilityPreferences } from "@/features/assist/components/accessibility-preferences";
import { AssistSearch } from "@/features/assist/components/assist-search";
import { HelpButton, HelpSheet } from "@/features/assist/components/help-sheet";

/** Dev-only showcase of the broker assistance. /dev/assistencia?open=search|help&q=pausar&route=/jornada */
function Showcase() {
  const params = useSearchParams();
  const [search, setSearch] = useState(params.get("open") === "search");
  const [help, setHelp] = useState(params.get("open") === "help");
  return (
    <div className="arc-venancor min-h-dvh bg-[var(--surface)] p-4">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-medium">Vitrine de assistência</h1>
        <HelpButton onClick={() => setHelp(true)} />
        <button type="button" className="h-11 rounded-full bg-[var(--surface-muted)] px-4 text-sm" onClick={() => setSearch(true)}>Onde fica?</button>
      </div>
      {params.get("open") === "prefs" ? <div className="mx-auto mt-6 max-w-[640px]"><AccessibilityPreferences /></div> : null}
      <AssistSearch open={search} onOpenChange={setSearch} capabilities={{ journey: true, dutyCalendar: true, quoteSimulator: true, relationshipCenter: true }} />
      <HelpSheet pathname={params.get("route") ?? "/jornada"} open={help} onOpenChange={setHelp} onSearch={() => setSearch(true)} />
    </div>
  );
}

export default function AssistShowcasePage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <main><A11yPrefsProvider><Suspense fallback={null}><Showcase /></Suspense></A11yPrefsProvider></main>;
}
