"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  ArrowRight,
  Bell,
  Buildings,
  ChatCircleText,
  ClipboardText,
  Handshake,
  ListChecks,
  MagnifyingGlass,
  Note,
  RocketLaunch,
  SlidersHorizontal,
  Target,
  Users,
} from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  guideCategories,
  guideRoleLabels,
  guideSections,
  type GuideRole,
  type GuideSection,
} from "@/features/guide/guide-data";

const iconMap = {
  ArrowRight,
  Bell,
  Buildings,
  ChatCircleText,
  ClipboardText,
  Handshake,
  ListChecks,
  Note,
  RocketLaunch,
  SlidersHorizontal,
  Target,
  Users,
} as const;

export function SystemGuide({ role }: { role: GuideRole }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<(typeof guideCategories)[number] | "Todas">("Todas");
  const [activeId, setActiveId] = useState(guideSections[0]?.id ?? "");

  const visibleSections = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    return guideSections.filter((section) => {
      const matchesRole = section.audience.includes(role);
      const matchesCategory = category === "Todas" || section.eyebrow === category;
      const searchable = [section.title, section.description, section.eyebrow, ...section.steps.flatMap((step) => [step.title, step.description])]
        .join(" ")
        .toLocaleLowerCase("pt-BR");
      return matchesRole && matchesCategory && (!normalized || searchable.includes(normalized));
    });
  }, [category, query, role]);

  function selectSection(id: string) {
    setActiveId(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <main className="min-h-full bg-background">
      <section className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8 lg:py-12">
          <div className="max-w-3xl">
            <Badge variant="outline" className="mb-4 gap-1.5 border-primary/20 bg-primary/[0.05] text-primary">
              <BookMarkIcon /> Guia CorreTop
            </Badge>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Aprenda o sistema no seu ritmo.</h2>
            <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
              Um guia simples para saber onde começar, qual caminho seguir e como transformar cada tela em uma ação útil para sua corretora.
            </p>
          </div>
          <div className="mt-7 max-w-2xl">
            <label className="sr-only" htmlFor="guide-search">Pesquisar no guia</label>
            <div className="relative">
              <MagnifyingGlass aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="guide-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquise por exemplo: cotação, equipe, WhatsApp..." className="h-11 bg-background pl-9" />
            </div>
          </div>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {["Todas", ...guideCategories].map((item) => (
              <button key={item} type="button" onClick={() => setCategory(item as typeof category)} className={cn("shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-[var(--duration-quick)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", category === item ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground")}>
                {item}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:px-8 lg:py-8">
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <p className="px-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Sumário</p>
            <nav className="mt-3 space-y-1" aria-label="Sumário do guia">
              {visibleSections.map((section) => <GuideNavItem key={section.id} section={section} active={activeId === section.id} onClick={() => selectSection(section.id)} />)}
            </nav>
          </div>
        </aside>

        <div className="min-w-0">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Seu guia de trabalho</p>
              <p className="mt-1 text-xs text-muted-foreground">Mostrando {visibleSections.length} {visibleSections.length === 1 ? "tema" : "temas"} para {guideRoleLabels[role]}.</p>
            </div>
            {query || category !== "Todas" ? <Button variant="ghost" size="sm" onClick={() => { setQuery(""); setCategory("Todas"); }}>Limpar filtros</Button> : null}
          </div>

          {!visibleSections.length ? (
            <Card className="border-dashed shadow-none">
              <CardContent className="flex flex-col items-center gap-2 px-6 py-14 text-center">
                <MagnifyingGlass className="size-6 text-muted-foreground" />
                <p className="font-medium">Não encontramos esse assunto</p>
                <p className="max-w-sm text-sm text-muted-foreground">Tente buscar por uma palavra mais curta ou escolha outra área do guia.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {visibleSections.map((section, index) => <GuideSectionCard key={section.id} section={section} index={index} onFocus={() => setActiveId(section.id)} />)}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function GuideNavItem({ section, active, onClick }: { section: GuideSection; active: boolean; onClick: () => void }) {
  const Icon = iconMap[section.icon as keyof typeof iconMap] ?? Note;
  return <button type="button" onClick={onClick} className={cn("flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors duration-[var(--duration-quick)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", active ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}><Icon className="size-4 shrink-0" /><span className="truncate">{section.title}</span></button>;
}

function GuideSectionCard({ section, index, onFocus }: { section: GuideSection; index: number; onFocus: () => void }) {
  const Icon = iconMap[section.icon as keyof typeof iconMap] ?? Note;
  return (
    <article id={section.id} onFocus={onFocus} className="scroll-mt-24">
      <Card className="overflow-hidden border-border bg-card shadow-none">
        <CardHeader className="border-b border-border/80 bg-muted/20 px-5 py-5 sm:px-6">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-primary/15 bg-primary/[0.07] text-primary"><Icon className="size-5" /></span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">{section.eyebrow}</p>
              <CardTitle className="mt-1 text-xl tracking-tight">{section.title}</CardTitle>
              <CardDescription className="mt-1 max-w-2xl leading-6">{section.description}</CardDescription>
            </div>
            <span className="ml-auto hidden shrink-0 font-mono text-xs text-muted-foreground sm:block">{String(index + 1).padStart(2, "0")}</span>
          </div>
        </CardHeader>
        <CardContent className="px-5 py-5 sm:px-6">
          <ol className="space-y-0">
            {section.steps.map((step, stepIndex) => (
              <li key={step.title} className="relative flex gap-3 pb-5 last:pb-0">
                {stepIndex < section.steps.length - 1 ? <span aria-hidden="true" className="absolute left-3.5 top-8 h-[calc(100%-1.25rem)] w-px bg-border" /> : null}
                <span className="relative z-10 grid size-7 shrink-0 place-items-center rounded-full border border-border bg-background text-xs font-semibold tabular-nums text-muted-foreground">{stepIndex + 1}</span>
                <div className="min-w-0 pt-0.5"><p className="font-medium">{step.title}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{step.description}</p></div>
              </li>
            ))}
          </ol>
          {section.tip ? <div className="mt-5 rounded-xl border border-primary/15 bg-primary/[0.05] px-4 py-3 text-sm leading-6 text-muted-foreground"><span className="font-medium text-foreground">Dica prática: </span>{section.tip}</div> : null}
          {section.links.length ? <><Separator className="my-5" /><div className="flex flex-wrap gap-2">{section.links.map((link) => <Button key={link.href} render={<Link href={link.href} />} size="sm" variant="outline">{link.label}<ArrowRight /></Button>)}</div></> : null}
        </CardContent>
      </Card>
    </article>
  );
}

function BookMarkIcon() {
  return <Note aria-hidden="true" className="size-3.5" />;
}
