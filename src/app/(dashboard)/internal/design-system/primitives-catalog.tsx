"use client";

import { useState } from "react";
import { ArcScopeProvider } from "@/components/arc/arc-scope-context";
import { Button } from "@/components/ui/button";
import ArcEmptyState from "@/components/arc/empty-state/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AppSelect } from "@/components/ui/select";
import { AppCombobox } from "@/components/ui/combobox";
import { Dialog, DialogPopup, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { StatCard } from "@/components/dashboard/metric-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Toaster, toast } from "@/components/ui/sonner";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={title.toLowerCase().replaceAll(" ", "-")}>
      <h2 id={title.toLowerCase().replaceAll(" ", "-")} className="mb-3 text-lg font-semibold">{title}</h2>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

export default function PrimitivesCatalog() {
  const [directorSkin, setDirectorSkin] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [checked, setChecked] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [plan, setPlan] = useState("individual");
  const [unit, setUnit] = useState("matriz");
  const [tab, setTab] = useState("hoje");

  return (
    <ArcScopeProvider enabled={directorSkin}>
      <main
        className={directorSkin ? "arc-venancor min-h-screen" : "min-h-screen bg-background text-foreground"}
        data-skin={directorSkin ? "diretor" : "off"}
      >
        {directorSkin ? <div id="director-lite-portal-root" className="arc-venancor" data-skin="diretor" style={{ display: "contents" }} /> : null}
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">
          <header className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold">Catálogo das primitivas</h1>
              <p className="text-sm text-muted-foreground">Estados e interações usados no modo Diretor Lite.</p>
            </div>
            <Button variant={directorSkin ? "secondary" : "default"} onClick={() => setDirectorSkin((value) => !value)}>
              {directorSkin ? "Desligar prévia Lite" : "Ativar prévia Lite"}
            </Button>
          </header>

          <div className="grid gap-5 lg:grid-cols-2">
            <Section title="Button">
              <div className="flex flex-wrap gap-2">
                <Button>Principal</Button><Button variant="secondary">Secundário</Button>
                <Button variant="outline" autoFocus>Foco visível</Button><Button variant="ghost">Discreto</Button>
                <Button variant="destructive">Excluir</Button><Button disabled>Desabilitado</Button><Button loading>Salvando</Button>
                <Button size="icon-lg" aria-label="Ação rápida">+</Button>
              </div>
            </Section>
            <Section title="Badge">
              <div className="flex flex-wrap gap-2">
                <Badge>Neutro</Badge><Badge variant="info">Informação</Badge>
                <Badge variant="success">Concluído</Badge><Badge variant="warning">Atenção</Badge>
                <Badge variant="destructive">Falha</Badge><Badge variant="outline">Pendente</Badge><Badge status="loading">Carregando</Badge>
              </div>
            </Section>
            <Section title="Sonner">
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => toast.success("Alterações salvas")}>Sucesso</Button>
                <Button variant="outline" onClick={() => toast.error("Não foi possível concluir")}>Erro</Button>
                <Button variant="ghost" onClick={() => toast.info("Atualização disponível")}>Informação</Button>
              </div>
            </Section>
            <Section title="Card">
              <Card><CardHeader><CardTitle>Resumo do dia</CardTitle><CardDescription>Visão geral da unidade</CardDescription></CardHeader><CardContent>12 leads em atendimento</CardContent></Card>
            </Section>
            <Section title="Input e Label">
              <div className="grid gap-2">
                <Label htmlFor="catalog-name">Nome do cliente</Label>
                <Input id="catalog-name" placeholder="Digite um nome" />
                <Input aria-invalid="true" placeholder="Campo com erro" />
                <Input disabled placeholder="Campo desabilitado" />
              </div>
            </Section>
            <Section title="Select e combobox">
              <div className="grid gap-3 sm:grid-cols-2">
                <AppSelect aria-label="Plano" value={plan} onValueChange={setPlan} options={[{ value: "individual", label: "Individual" }, { value: "familiar", label: "Familiar" }, { value: "empresarial", label: "Empresarial" }, { value: "indisponivel", label: "Indisponível", disabled: true }]} />
                <AppCombobox aria-label="Unidade" value={unit} onValueChange={setUnit} options={[{ value: "matriz", label: "Matriz" }, { value: "centro", label: "Unidade Centro" }, { value: "sul", label: "Unidade Sul" }]} />
                <AppSelect aria-label="Plano desabilitado" disabled options={[{ value: "indisponivel", label: "Indisponível" }]} />
                <AppCombobox aria-label="Unidade desabilitada" disabled options={[{ value: "indisponivel", label: "Indisponível" }]} />
              </div>
            </Section>
            <Section title="Dialog">
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger render={<Button variant="secondary" />}>Abrir diálogo</DialogTrigger>
                <DialogPopup><DialogTitle>Confirmar ação</DialogTitle><DialogDescription>Revise antes de continuar.</DialogDescription><Button onClick={() => setDialogOpen(false)}>Entendi</Button></DialogPopup>
              </Dialog>
            </Section>
            <Section title="Table">
              <Table><TableHeader><TableRow><TableHead>Corretor</TableHead><TableHead>Status</TableHead><TableHead>Leads</TableHead></TableRow></TableHeader><TableBody><TableRow><TableCell>Ana Lima</TableCell><TableCell>Ativo</TableCell><TableCell>8</TableCell></TableRow><TableRow><TableCell>Caio Nunes</TableCell><TableCell>Pendente</TableCell><TableCell>3</TableCell></TableRow></TableBody></Table>
            </Section>
            <Section title="Sheet">
              <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetTrigger render={<Button variant="outline" />}>Abrir painel</SheetTrigger>
                <SheetContent><SheetTitle>Detalhes da unidade</SheetTitle><SheetDescription>Informações e ações do painel.</SheetDescription></SheetContent>
              </Sheet>
            </Section>
            <Section title="Dropdown">
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="secondary" />}>Mais ações</DropdownMenuTrigger>
                <DropdownMenuContent><DropdownMenuItem>Editar</DropdownMenuItem><DropdownMenuItem>Duplicar</DropdownMenuItem><DropdownMenuItem disabled>Indisponível</DropdownMenuItem></DropdownMenuContent>
              </DropdownMenu>
            </Section>
            <Section title="StatCard">
              <div className="grid max-w-2xl gap-3 sm:grid-cols-2"><StatCard label="Leads novos" value={128} sublabel="Neste mês" change="+12%" trend="up" /><StatCard label="Leads perdidos" value={7} sublabel="Neste mês" change="-3%" trend="down" /></div>
            </Section>
            <Section title="Tabs">
              <Tabs value={tab} onValueChange={setTab} variant="pill"><TabsList variant="pill"><TabsTrigger value="hoje">Hoje</TabsTrigger><TabsTrigger value="semana">Semana</TabsTrigger><TabsTrigger value="mes">Mês</TabsTrigger></TabsList><TabsContent value={tab}>Resumo de {tab}</TabsContent></Tabs>
            </Section>
            <Section title="Popover e Tooltip">
              <div className="flex items-center gap-3">
                <Popover open={popoverOpen} onOpenChange={setPopoverOpen}><PopoverTrigger render={<Button variant="outline" />}>Abrir opções</PopoverTrigger><PopoverContent>Conteúdo próximo ao gatilho</PopoverContent></Popover>
                <TooltipProvider delay={400} timeout={600}><Tooltip><TooltipTrigger render={<Button variant="ghost" />}>Passe o cursor</TooltipTrigger><TooltipContent>Dica contextual</TooltipContent></Tooltip></TooltipProvider>
              </div>
            </Section>
            <Section title="Skeleton">
              <div className="grid gap-3"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-4 w-full" /><Skeleton className="h-10 w-10 rounded-full" /></div>
            </Section>
            <Section title="Estado vazio">
              <ArcEmptyState title="Nenhum resultado" description="Ajuste os filtros ou tente novamente." action={<Button variant="secondary">Limpar filtros</Button>} />
            </Section>
            <Section title="Checkbox e Switch">
              <div className="flex flex-wrap items-center gap-6">
                <label className="flex items-center gap-2"><Checkbox checked={checked} onCheckedChange={(value) => setChecked(Boolean(value))} />Selecionar linha</label>
                <label className="flex items-center gap-2"><Checkbox aria-label="Desmarcado" />Desmarcado</label>
                <label className="flex items-center gap-2"><Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Ativar distribuição" />Distribuição ativa</label>
                <Switch disabled aria-label="Distribuição desabilitada" />
              </div>
            </Section>
            <Section title="Progress">
              <div className="grid gap-3"><div className="grid gap-2"><Progress value={64} /><p className="text-sm text-muted-foreground">64% da meta mensal</p></div><Progress value={0} aria-label="Sem progresso" /><Progress value={100} aria-label="Concluído" /></div>
            </Section>
            <Section title="Separator">
              <div className="grid gap-3"><p>Informações do corretor</p><Separator /><p className="text-sm text-muted-foreground">Última atualização há 5 minutos</p></div>
            </Section>
            <Section title="ScrollArea">
              <ScrollArea className="h-36 bg-[var(--surface-muted)] p-3" style={{ borderRadius: "var(--radius-control)" }}>
                <div className="grid gap-2">{Array.from({ length: 8 }, (_, index) => <p key={index} className="bg-[var(--surface)] p-3" style={{ borderRadius: "var(--radius-control)" }}>Linha de atividade {index + 1}</p>)}</div>
              </ScrollArea>
            </Section>
          </div>
        </div>
        <Toaster directorLiteEnabled={directorSkin} />
      </main>
    </ArcScopeProvider>
  );
}
