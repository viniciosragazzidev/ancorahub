import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { InterfaceMotionProvider } from "@/components/motion/interface-motion-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { ShimmerSkeleton } from "@/components/unlumen-ui/shimmer-skeleton";
import {
  Dialog,
  DialogTrigger,
  DialogPopup,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
  SheetHeader,
  SheetBody,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DsTabs, DsTabsList, DsTabsTrigger, DsTabsPanel } from "@/components/ui/ds-tabs";
import { StatefulButton, type ButtonState } from "@/components/ui/stateful-button";

function Preview() {
  const [enabled, setEnabled] = useState(true);
  const [side, setSide] = useState<"left" | "right" | "top" | "bottom">("right");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [buttonState, setButtonState] = useState<ButtonState>("idle");
  return (
    <InterfaceMotionProvider enabled={enabled}>
      <main className="mx-auto grid max-w-4xl gap-6 p-5 sm:p-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">BIBLIOTECA COMPARTILHADA · QA SINTÉTICO</p>
            <h1 className="text-2xl font-semibold">Interações e feedback</h1>
          </div>
          <Button variant="outline" onClick={() => setEnabled(!enabled)} data-testid="governance">
            {enabled ? "Desativar movimento" : "Ativar movimento"}
          </Button>
        </header>
        <div className="grid gap-5 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Ações e seleção</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="flex flex-wrap gap-2">
                <Button data-testid="press">Continuar</Button>
                <Button disabled>Indisponível</Button>
              </div>
              <div className="flex items-center gap-3">
                <Checkbox aria-label="Selecionar lead" />
                <span>Selecionar lead</span>
              </div>
              <div className="flex items-center gap-3">
                <Switch aria-label="Disponível" />
                <span>Disponível</span>
              </div>
              <Input placeholder="Buscar na lista" aria-label="Buscar na lista" />
              <Select defaultValue="all">
                <SelectTrigger aria-label="Fila">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as filas</SelectItem>
                  <SelectItem value="pme">PME</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Detalhes sob demanda</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Dialog>
                <DialogTrigger render={<Button variant="outline" />}>Abrir diálogo</DialogTrigger>
                <DialogPopup>
                  <DialogTitle>Confirmar ação</DialogTitle>
                  <DialogDescription>Exemplo sintético de foco e abertura.</DialogDescription>
                  <Input aria-label="Observação" />
                  <DialogClose render={<Button />}>Concluir</DialogClose>
                </DialogPopup>
              </Dialog>
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="outline" />}>
                  Mais ações
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem>Consultar detalhes</DropdownMenuItem>
                  <DropdownMenuItem>Exportar seleção</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Popover>
                <PopoverTrigger render={<Button variant="outline" />}>
                  Filtros rápidos
                </PopoverTrigger>
                <PopoverContent>
                  <Input aria-label="Cidade" placeholder="Cidade" />
                </PopoverContent>
              </Popover>
              <div className="flex flex-wrap gap-2">
                {(["left", "right", "top", "bottom"] as const).map((value) => (
                  <Button
                    key={value}
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setSide(value);
                      setSheetOpen(true);
                    }}
                  >
                    Painel {value}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Estado e contexto</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5">
            <DsTabs defaultValue="summary">
              <DsTabsList>
                <DsTabsTrigger value="summary">Resumo</DsTabsTrigger>
                <DsTabsTrigger value="details">Detalhes</DsTabsTrigger>
              </DsTabsList>
              <DsTabsPanel value="summary">
                A informação aparece de forma imediata e legível.
              </DsTabsPanel>
              <DsTabsPanel value="details">
                O indicador identifica o contexto selecionado.
              </DsTabsPanel>
            </DsTabs>
            <div className="flex flex-wrap gap-3">
              <StatefulButton state={buttonState} onClick={() => setButtonState("loading")}>
                Salvar exemplo
              </StatefulButton>
              <Button variant="ghost" onClick={() => setButtonState("success")}>
                Simular confirmação
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Skeleton className="h-5 w-full" />
              <ShimmerSkeleton className="h-5 w-full" />
            </div>
          </CardContent>
        </Card>
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent side={side}>
            <SheetHeader>
              <SheetTitle>Detalhes do exemplo</SheetTitle>
              <SheetDescription>Painel compartilhado com foco preservado.</SheetDescription>
            </SheetHeader>
            <SheetBody>
              <Input aria-label="Nome no painel" placeholder="Nome" />
            </SheetBody>
          </SheetContent>
        </Sheet>
      </main>
    </InterfaceMotionProvider>
  );
}
createRoot(document.getElementById("root")!).render(<Preview />);
