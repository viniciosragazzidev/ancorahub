"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { ChevronDownIcon, Gear, Plus } from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DsSegmentedControl } from "@/components/ui/ds-segmented-control";
import { SectionCardHeader } from "@/components/ui/section-card-header";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

import type { CarrierOverview, MaterialRow, ReviewQueue } from "../queries";
import { BrokerQuotesSheet } from "./broker-quotes-sheet";
import { AreasList, CatalogPanel } from "./catalog-panel";
import type { AreaInfo } from "./labels";
import { MaterialsPanel } from "./materials-panel";
import { ReviewPanel } from "./review-panel";

type Tab = "materials" | "review" | "catalog";
type UploadItem = { name: string; state: "waiting" | "sending" | "done" | "error"; message?: string };

const ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";

function UploadSheet({ open, onOpenChange, onFinished }: { open: boolean; onOpenChange: (open: boolean) => void; onFinished: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  const send = async (files: File[]) => {
    if (!files.length || busy) return;
    setBusy(true);
    setItems(files.map((file) => ({ name: file.name, state: "waiting" })));
    // One at a time: each file gets its own answer and the AI budget is not burst.
    for (const [index, file] of files.entries()) {
      setItems((current) => current.map((item, position) => (position === index ? { ...item, state: "sending" } : item)));
      const body = new FormData();
      body.set("file", file);
      const response = await fetch("/api/operator-materials/upload", { method: "POST", body }).catch(() => null);
      const result = (await response?.json().catch(() => null)) as { status?: string; message?: string; error?: string } | null;
      const ok = Boolean(response?.ok);
      setItems((current) => current.map((item, position) => (position === index
        ? { ...item, state: ok ? "done" : "error", message: result?.message ?? result?.error ?? "Não foi possível enviar." }
        : item)));
    }
    setBusy(false);
    onFinished();
  };

  return (
    <Sheet open={open} onOpenChange={(next) => { if (!busy) { onOpenChange(next); if (!next) setItems([]); } }}>
      <SheetContent className="data-[side=right]:w-[min(100vw-1rem,36rem)]">
        <SheetHeader>
          <SheetTitle>Importar materiais</SheetTitle>
          <SheetDescription>Tabelas, manuais, redes, promoções e cotações em PDF ou imagem. O sistema identifica a operadora, os planos e cada informação, e atualiza só o que mudou.</SheetDescription>
        </SheetHeader>
        <SheetBody contentClassName="grid gap-4">
          <button
            type="button"
            disabled={busy}
            onClick={() => input.current?.click()}
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => { event.preventDefault(); setDragging(false); void send([...event.dataTransfer.files]); }}
            className={cn(
              "grid place-items-center gap-1 rounded-[var(--radius-card)] border border-dashed border-border p-8 text-center transition-colors",
              dragging ? "bg-muted/60" : "bg-muted/20 hover:bg-muted/40",
            )}
          >
            <span className="text-sm font-medium">Arraste os arquivos ou clique para escolher</span>
            <span className="text-xs text-muted-foreground">PDF até 20 MB, imagem até 8 MB. Pode enviar vários de uma vez.</span>
          </button>
          <input ref={input} type="file" accept={ACCEPT} multiple hidden onChange={(event) => { void send([...(event.target.files ?? [])]); event.target.value = ""; }} />
          {items.length ? (
            <ul className="grid divide-y divide-border rounded-[var(--radius-card)] border border-border">
              {items.map((item, index) => (
                <li key={`${item.name}-${index}`} className="grid gap-0.5 px-3 py-2">
                  <span className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate">{item.name}</span>
                    <Badge variant={item.state === "done" ? "success" : item.state === "error" ? "destructive" : item.state === "sending" ? "info" : "secondary"}>
                      {item.state === "done" ? "Recebido" : item.state === "error" ? "Não importado" : item.state === "sending" ? "Lendo" : "Na fila"}
                    </Badge>
                  </span>
                  {item.message ? <span className="text-xs text-muted-foreground">{item.message}</span> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </SheetBody>
        <SheetFooter>
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>Fechar</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Operator material: every file imported or captured from the WhatsApp groups,
 * what the director still has to decide, and the catalog per operator. One
 * primary action (import); the catalog's areas live in "Configurações".
 */
export function MaterialsWorkspace({ materials, queue, carriers, areas, carrierOptions, semanticSearch }: {
  materials: MaterialRow[];
  queue: ReviewQueue;
  carriers: CarrierOverview[];
  areas: AreaInfo[];
  carrierOptions: Array<{ id: string; name: string }>;
  semanticSearch: boolean;
}) {
  const router = useRouter();
  const reviewCount = queue.pendingFacts.length + queue.draftPlans.length + queue.missingFacts.length + queue.suggestions.length;
  const [tab, setTab] = useState<Tab>(reviewCount ? "review" : "materials");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [areasOpen, setAreasOpen] = useState(false);
  const [quotesOpen, setQuotesOpen] = useState(false);
  const waiting = materials.filter((material) => material.status === "pending" || material.status === "processing").length;

  return (
    <Card variant="overview">
      <SectionCardHeader
        title="Materiais das operadoras"
        badge={<Badge variant="secondary">{materials.length} arquivos · {carriers.length} operadoras{waiting ? ` · ${waiting} na fila` : ""}</Badge>}
        description={`Tudo o que chega das operadoras vira catálogo: operadora, plano, área e cada informação com fonte e vigência. A Cotação Express responde a partir daqui.${semanticSearch ? "" : " Busca por significado desligada: falta a chave da OpenAI."}`}
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button size="sm" variant="outline" />}>
                <Gear className="size-3.5" />
                Configurações
                <ChevronDownIcon className="size-3 opacity-60" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuItem onClick={() => setAreasOpen(true)}>Áreas e campos do catálogo</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setQuotesOpen(true)}>Importar cotações enviadas aos leads</DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.refresh()}>Atualizar status</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" onClick={() => setUploadOpen(true)}>
              <Plus className="size-3.5" />
              Importar materiais
            </Button>
          </>
        }
      />
      <div className="grid gap-3 p-4">
        <DsSegmentedControl<Tab>
          aria-label="Visão"
          value={tab}
          onValueChange={setTab}
          options={[
            { value: "materials", label: `Materiais (${materials.length})` },
            { value: "review", label: `Revisão (${reviewCount})` },
            { value: "catalog", label: `Catálogo (${carriers.length})` },
          ]}
          className="max-w-full overflow-x-auto"
        />
        {tab === "materials" ? <MaterialsPanel materials={materials} areas={areas} carriers={carrierOptions} /> : null}
        {tab === "review" ? <ReviewPanel queue={queue} areas={areas} /> : null}
        {tab === "catalog" ? <CatalogPanel carriers={carriers} areas={areas} /> : null}
      </div>

      <BrokerQuotesSheet open={quotesOpen} onOpenChange={setQuotesOpen} />

      <UploadSheet open={uploadOpen} onOpenChange={setUploadOpen} onFinished={() => router.refresh()} />

      <Sheet open={areasOpen} onOpenChange={setAreasOpen}>
        <SheetContent className="data-[side=right]:w-[min(100vw-1rem,40rem)]">
          <SheetHeader>
            <SheetTitle>Áreas e campos do catálogo</SheetTitle>
            <SheetDescription>A mesma estrutura para todas as operadoras. Áreas e campos novos chegam como sugestão na Revisão.</SheetDescription>
          </SheetHeader>
          <SheetBody>
            <AreasList areas={areas} />
          </SheetBody>
        </SheetContent>
      </Sheet>
    </Card>
  );
}
