"use client";

import { useState, type ReactNode } from "react";
import { MotionConfig } from "motion/react";

import { Button } from "@/components/ui/button";
import {
  LiteAttention,
  LiteCollapse,
  LiteDelta,
  LiteDrawLine,
  LiteHighlight,
  LiteListPresence,
  LiteNumber,
  LitePageEnter,
  LitePress,
  LiteProgress,
  LiteReveal,
  LiteSkeletonToContent,
  LiteStagger,
  LiteStaggerItem,
  LiteSuccess,
  LiteSwap,
} from "@/components/lite/motion";

const ROWS = ["Ana Souza", "Bruno Lima", "Carla Dias", "Diego Melo", "Elisa Rocha"];

/** Kit de movimento Lite e arquétipos da seção 5 do anexo, para QA visual. */
export function LiteMotionKit() {
  const [reduced, setReduced] = useState(false);
  const [tab, setTab] = useState<"resumo" | "lista">("resumo");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(1234);
  const [rows, setRows] = useState(ROWS.slice(0, 3));
  const [progress, setProgress] = useState(40);
  const [pulse, setPulse] = useState<number | undefined>(undefined);
  const [saved, setSaved] = useState(false);
  const [replay, setReplay] = useState(0);

  return (
    <MotionConfig reducedMotion={reduced ? "always" : "user"}>
      <section className="space-y-6 pb-10" aria-labelledby="kit-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="kit-title" className="text-lg font-semibold">Kit de movimento Lite</h2>
            <p className="text-sm text-muted-foreground">Cada peça com movimento normal e, quando ligado, com movimento reduzido simulado.</p>
          </div>
          <Button variant={reduced ? "default" : "outline"} aria-pressed={reduced} onClick={() => setReduced((value) => !value)}>
            Movimento reduzido: {reduced ? "ligado" : "desligado"}
          </Button>
        </div>

        <Demo title="LitePageEnter">
          <LitePageEnter key={replay}><p className="text-sm">Página entra com fade e subida de 8 px.</p></LitePageEnter>
          <Button size="sm" variant="outline" onClick={() => setReplay((value) => value + 1)}>Repetir entrada</Button>
        </Demo>

        <Demo title="LiteStagger e LiteStaggerItem">
          <LiteStagger className="grid gap-2">
            {ROWS.map((name) => <p key={name} className="rounded-md bg-muted px-3 py-2 text-sm">{name}</p>)}
          </LiteStagger>
          <LiteStaggerItem index={0}><p className="text-xs text-muted-foreground">Item avulso com atraso zero.</p></LiteStaggerItem>
        </Demo>

        <Demo title="LitePress">
          <LitePress kind="button"><Button size="sm">Toque para ver a escala de 0,97</Button></LitePress>
        </Demo>

        <Demo title="LiteReveal">
          <LiteReveal><p className="text-sm">Entra ao rolar até a vista, uma vez.</p></LiteReveal>
        </Demo>

        <Demo title="LiteSwap">
          <div className="flex gap-2">
            <Button size="sm" variant={tab === "resumo" ? "default" : "outline"} onClick={() => setTab("resumo")}>Resumo</Button>
            <Button size="sm" variant={tab === "lista" ? "default" : "outline"} onClick={() => setTab("lista")}>Lista</Button>
          </div>
          <LiteSwap swapKey={tab}><p className="text-sm">{tab === "resumo" ? "Conteúdo do resumo." : "Conteúdo da lista."}</p></LiteSwap>
        </Demo>

        <Demo title="LiteSkeletonToContent">
          <Button size="sm" variant="outline" onClick={() => setLoading((value) => !value)}>Alternar carregando</Button>
          <LiteSkeletonToContent loading={loading} minHeight={48} skeleton={<div className="h-10 rounded-md bg-muted" />}>
            <p className="rounded-md bg-muted px-3 py-2 text-sm">Lista pronta</p>
          </LiteSkeletonToContent>
        </Demo>

        <Demo title="LiteNumber">
          <div className="flex items-center gap-3">
            <Button size="sm" variant="outline" onClick={() => setCount((value) => value - 111)}>−</Button>
            <span className="text-2xl font-medium"><LiteNumber value={count} live /></span>
            <Button size="sm" variant="outline" onClick={() => setCount((value) => value + 111)}>+</Button>
          </div>
          <LiteNumber value={12850.4} format="currency" className="text-sm text-muted-foreground" />
        </Demo>

        <Demo title="LiteDelta">
          <LiteDelta value={12} />
          <LiteDelta value={-3} />
        </Demo>

        <Demo title="LiteHighlight">
          <div className="relative flex gap-2 rounded-full bg-muted p-1">
            {["Dia", "Semana", "Mês"].map((label, index) => (
              <button key={label} type="button" className="relative rounded-full px-3 py-1 text-sm" onClick={() => setTab(index === 0 ? "resumo" : "lista")}>
                <LiteHighlight layoutId="kit-highlight" active={(tab === "resumo") === (index === 0)} className="bg-background" />
                <span className="relative">{label}</span>
              </button>
            ))}
          </div>
        </Demo>

        <Demo title="LiteCollapse">
          <Button size="sm" variant="outline" onClick={() => setOpen((value) => !value)}>{open ? "Fechar detalhe" : "Abrir detalhe"}</Button>
          <LiteCollapse open={open}><p className="pt-2 text-sm">Detalhe que abre pela grade, sem animar a altura.</p></LiteCollapse>
        </Demo>

        <Demo title="LiteListPresence">
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setRows((current) => [...current, ROWS[current.length % ROWS.length]!])}>Adicionar</Button>
            <Button size="sm" variant="outline" onClick={() => setRows((current) => current.slice(0, -1))}>Remover</Button>
          </div>
          <LiteListPresence className="grid gap-2">
            {rows.map((name) => <p key={name} className="rounded-md bg-muted px-3 py-2 text-sm">{name}</p>)}
          </LiteListPresence>
        </Demo>

        <Demo title="LiteSuccess">
          <Button size="sm" variant="outline" onClick={() => setSaved((value) => !value)}>Alternar confirmação</Button>
          {saved ? <LiteSuccess label="Salvo" /> : null}
        </Demo>

        <Demo title="LiteProgress">
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setProgress((value) => Math.max(0, value - 20))}>−20</Button>
            <Button size="sm" variant="outline" onClick={() => setProgress((value) => Math.min(100, value + 20))}>+20</Button>
          </div>
          <LiteProgress value={progress} label="Progresso da importação" />
        </Demo>

        <Demo title="LiteDrawLine">
          <LiteDrawLine d="M0 30 L20 12 L40 22 L60 4 L80 14 L100 6" viewBox="0 0 100 32" label="Leads por semana" className="h-16 w-full" />
        </Demo>

        <Demo title="LiteAttention">
          <Button size="sm" variant="outline" onClick={() => setPulse((value) => (value ?? 0) + 1)}>Disparar pulso</Button>
          <LiteAttention pulseKey={pulse}><span className="rounded-full bg-muted px-3 py-1 text-sm">Sino de notificação</span></LiteAttention>
        </Demo>

        <div className="space-y-3">
          <h3 className="text-base font-semibold">Arquétipos de tela em miniatura (seção 5 do anexo)</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <Archetype name="Painel">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md bg-muted p-3"><LiteNumber value={58} className="text-xl" /><LiteDelta value={8} /></div>
                <div className="rounded-md bg-muted p-3"><LiteNumber value={1420} className="text-xl" /><LiteDelta value={-2} /></div>
              </div>
            </Archetype>
            <Archetype name="Lista com filtros">
              <div className="flex gap-2"><Button size="sm" variant="outline">Filtrar</Button></div>
              <LiteStagger className="grid gap-1">{ROWS.slice(0, 3).map((name) => <p key={name} className="rounded-md bg-muted px-3 py-1 text-sm">{name}</p>)}</LiteStagger>
            </Archetype>
            <Archetype name="Kanban">
              <div className="grid grid-cols-3 gap-2">
                {["Novo", "Contato", "Visita"].map((column) => (
                  <div key={column} className="rounded-md bg-muted p-2 text-xs">
                    <p className="font-medium">{column}</p>
                    <LiteStagger className="mt-2 grid gap-1">{[1, 2].map((item) => <p key={item} className="rounded bg-background px-2 py-1">Lead {item}</p>)}</LiteStagger>
                  </div>
                ))}
              </div>
            </Archetype>
            <Archetype name="Detalhe">
              <p className="font-medium">Cliente exemplo</p>
              <div className="flex gap-2 rounded-full bg-muted p-1 text-xs"><span className="rounded-full bg-background px-2 py-1">Resumo</span><span className="px-2 py-1">Histórico</span></div>
            </Archetype>
            <Archetype name="Formulário longo e configuração">
              <LiteReveal><p className="text-sm">Seção de configuração que entra ao rolar.</p></LiteReveal>
              <LiteSuccess label="Alterações salvas" />
            </Archetype>
            <Archetype name="Wizard">
              <p className="text-sm">Passo 2 de 3</p>
              <LiteSwap swapKey="passo-2"><p className="text-sm">Conteúdo do passo, na direção do avanço.</p></LiteSwap>
            </Archetype>
            <Archetype name="Editor e grade">
              <div className="grid grid-cols-4 gap-1">{Array.from({ length: 8 }, (_, index) => <span key={index} className="h-6 rounded bg-muted" />)}</div>
            </Archetype>
            <Archetype name="Conversa">
              <div className="grid gap-2"><p className="rounded-2xl bg-muted px-3 py-2 text-sm">Olá, tudo bem?</p><LiteReveal><p className="ml-auto w-fit rounded-2xl bg-primary px-3 py-2 text-sm text-primary-foreground">Tudo certo.</p></LiteReveal></div>
            </Archetype>
            <Archetype name="Público e auth">
              <LitePageEnter><div className="rounded-2xl border p-4 text-sm">Cartão central de entrada</div></LitePageEnter>
            </Archetype>
          </div>
        </div>
      </section>
    </MotionConfig>
  );
}

function Demo({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-3 rounded-2xl border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Archetype({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="space-y-3 rounded-2xl border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{name}</p>
      {children}
    </div>
  );
}
