"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AppSelect } from "@/components/ui/select";
import { AppCombobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkle, CheckCircle, Warning, XCircle, UserList, Buildings } from "@/components/huge-icons";

export default function DesignSystemCatalogPage() {
  const [selectVal, setSelectVal] = useState("bradesco");
  const [comboVal, setComboVal] = useState("sp");

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-2 border-b border-border pb-4">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1 text-primary border-primary/30">
            <Sparkle className="size-3.5" />
            Catálogo Interno do Design System
          </Badge>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Âncora CRM — Guia Vivo de Componentes & Tokens
        </h1>
        <p className="text-xs text-muted-foreground">
          Referência oficial de componentes reutilizáveis, variantes de estilo, estados interativos e microinterações.
        </p>
      </div>

      <Tabs defaultValue="controles" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="controles">Controles & Formulários</TabsTrigger>
          <TabsTrigger value="badges">Badges & Status</TabsTrigger>
          <TabsTrigger value="cards">Cards & Bento</TabsTrigger>
        </TabsList>

        <TabsContent value="controles" className="space-y-6">
          <Card variant="subtle">
            <CardHeader>
              <CardTitle>AppSelect & AppCombobox</CardTitle>
              <CardDescription>Substitutos oficiais para elementos select nativos.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">AppSelect (Controlado)</p>
                <AppSelect
                  value={selectVal}
                  onValueChange={setSelectVal}
                  options={[
                    { value: "bradesco", label: "Bradesco Saúde" },
                    { value: "sulamerica", label: "SulAmérica" },
                    { value: "amil", label: "Amil" },
                    { value: "hapvida", label: "Hapvida" },
                  ]}
                  placeholder="Selecione uma operadora..."
                />
                <p className="text-[11px] text-muted-foreground">Valor selecionado: {selectVal}</p>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">AppCombobox (Pesquisável)</p>
                <AppCombobox
                  value={comboVal}
                  onValueChange={setComboVal}
                  options={[
                    { value: "sp", label: "São Paulo - Matriz" },
                    { value: "rj", label: "Rio de Janeiro - Filial" },
                    { value: "mg", label: "Belo Horizonte - Filial" },
                    { value: "pr", label: "Curitiba - Filial" },
                  ]}
                  placeholder="Selecione uma unidade..."
                />
                <p className="text-[11px] text-muted-foreground">Unidade selecionada: {comboVal}</p>
              </div>
            </CardContent>
          </Card>

          <Card variant="subtle">
            <CardHeader>
              <CardTitle>Button (Variantes & Tamanhos)</CardTitle>
              <CardDescription>Botões padronizados do sistema.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3">
              <Button variant="default">Primary CTA</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destructive</Button>
              <Button size="sm">Small (sm)</Button>
              <Button size="icon"><Sparkle className="size-4" /></Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="badges" className="space-y-6">
          <Card variant="subtle">
            <CardHeader>
              <CardTitle>Badges Semânticos</CardTitle>
              <CardDescription>Etiquetas de classificação para status de leads e filiais.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3">
              <Badge variant="default">Padrão</Badge>
              <Badge variant="secondary">Secundário</Badge>
              <Badge variant="success" className="gap-1"><CheckCircle className="size-3" /> Sucesso</Badge>
              <Badge variant="warning" className="gap-1"><Warning className="size-3" /> Atenção</Badge>
              <Badge variant="destructive" className="gap-1"><XCircle className="size-3" /> Erro</Badge>
              <Badge variant="outline">Outline</Badge>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cards" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card variant="subtle">
              <CardHeader className="flex-row items-center justify-between">
                <div>
                  <CardTitle>Card Padrão Bento</CardTitle>
                  <CardDescription>Estrutura flexível para dashboards.</CardDescription>
                </div>
                <UserList className="size-5 text-primary" />
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Alinhado a Geist typography, cores HSL semânticas e sombras sutis.
                </p>
              </CardContent>
            </Card>

            <Card variant="subtle">
              <CardHeader className="flex-row items-center justify-between">
                <div>
                  <CardTitle>Indicador de Filial</CardTitle>
                  <CardDescription>Desempenho operacional</CardDescription>
                </div>
                <Buildings className="size-5 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold tabular-nums">R$ 148.500,00</p>
                <p className="text-xs text-muted-foreground mt-1">+14% em relação ao mês anterior</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
