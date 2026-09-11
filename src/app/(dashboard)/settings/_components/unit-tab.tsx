"use client";

import Link from "next/link";
import { Buildings, WifiHigh } from "@/components/huge-icons";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { TenantRole } from "@/shared/db/schema";

type BranchInfo = {
  id: string;
  name: string;
  status: "active" | "inactive";
  acceptingLeads: boolean;
  autoDistribute: boolean;
  createdAt: Date;
};

export function UnitTab({
  branch,
  currentRole,
}: {
  branch: BranchInfo | null;
  currentRole: TenantRole;
}) {
  void currentRole;
  // Director without a specific branch selected — show overview
  if (!branch) {
    return (
      <Card className="border-border bg-card shadow-none">
        <CardHeader>
          <CardTitle>Unidades</CardTitle>
          <CardDescription>
            Gerencie as unidades da sua corretora. A identidade visual é configurada em Empresa.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <p className="text-xs text-muted-foreground">Escopo atual</p>
            <p className="mt-1 text-sm font-medium">Todas as unidades da corretora</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              A identidade da unidade continua em Filiais. Recebimento, auto-distribuição,
              filas, regras e elegibilidade são definidos em um único lugar: {" "}
              <Link href="/distribuicao?view=filas" className="text-primary underline underline-offset-2 hover:text-primary/80">
                Central de Distribuição
              </Link>.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Branch identity header */}
      <Card className="border-border bg-card shadow-none">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">
              <Buildings aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle>{branch.name}</CardTitle>
                <Badge
                  variant={branch.status === "active" ? "success" : "secondary"}
                  className="text-xs"
                >
                  {branch.status === "active" ? "Ativa" : "Inativa"}
                </Badge>
                {branch.acceptingLeads ? (
                  <Badge variant="outline" className="gap-1 text-xs">
                    <WifiHigh className="h-3 w-3" aria-hidden="true" />
                    Recebendo leads
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1 text-xs text-muted-foreground">
                    <WifiHigh className="h-3 w-3" aria-hidden="true" />
                    Pausada para leads
                  </Badge>
                )}
              </div>
              <CardDescription className="mt-1">
                Criada em{" "}
                {new Intl.DateTimeFormat("pt-BR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                }).format(new Date(branch.createdAt))}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card className="border-border bg-card shadow-none">
        <CardHeader>
          <CardTitle>Configuração de distribuição</CardTitle>
          <CardDescription>
            Esta tela mostra o estado da unidade; todas as alterações de recebimento e distribuição ficam na Central de Distribuição.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant={branch.acceptingLeads ? "success" : "secondary"}>{branch.acceptingLeads ? "Recebendo leads" : "Recebimento pausado"}</Badge>
            <Badge variant={branch.autoDistribute ? "success" : "secondary"}>{branch.autoDistribute ? "Auto-distribuição ativa" : "Auto-distribuição pausada"}</Badge>
          </div>
          <Button render={<Link href="/distribuicao?view=filas" />} size="sm">Abrir Central de Distribuição</Button>
        </CardContent>
      </Card>
    </div>
  );
}
