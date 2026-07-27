import Image from "next/image";
import { PlatformAdminHeader } from "@/components/platform-admin-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  createGlobalCarrierAction,
  setGlobalCatalogCapabilityAction,
} from "@/features/global-catalog/actions";
import { CatalogActionForm } from "@/features/global-catalog/components/catalog-action-form";
import { CatalogStatusBadge } from "@/features/global-catalog/components/catalog-status-badge";
import { getGlobalCatalogAdminData } from "@/features/global-catalog/queries";

export default async function SuperAdminCatalogPage() {
  const { enabled, privateEnabled, carriers } = await getGlobalCatalogAdminData();

  return (
    <>
      <PlatformAdminHeader breadcrumb="CorreTop / Admin" title="Catálogo global" />
      <main className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
        <section className="flex flex-col gap-2">
          <p className="text-xs font-medium text-primary">GOVERNANÇA COMERCIAL</p>
          <h1 className="text-2xl font-semibold tracking-tight">Operadoras oficiais</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Cadastre as operadoras parceiras da plataforma. Cada operadora pode conter nome, descrição e logotipo.
          </p>
        </section>

        <Card className="border-border bg-card shadow-none">
          <CardHeader>
            <CardTitle>Capacidades do domínio</CardTitle>
            <CardDescription>Controles globais e reversíveis. Desativar bloqueia novas consultas sem apagar o histórico.</CardDescription>
          </CardHeader>
          <CardContent>
            <CatalogActionForm action={setGlobalCatalogCapabilityAction} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between" submitLabel="Salvar capacidades">
              <div className="flex flex-col gap-3 sm:flex-row sm:gap-6">
                <label className="flex items-start gap-2 text-sm"><input className="mt-0.5 size-4" defaultChecked={enabled} name="globalEnabled" type="checkbox" value="true" /><span><span className="font-medium">Catálogo oficial ativo</span><span className="block text-xs text-muted-foreground">Permite consultar planos globais publicados e autorizados.</span></span></label>
                <label className="flex items-start gap-2 text-sm"><input className="mt-0.5 size-4" defaultChecked={privateEnabled} name="privateEnabled" type="checkbox" value="true" /><span><span className="font-medium">Extensões privadas ativas</span><span className="block text-xs text-muted-foreground">Mantém acordos exclusivos isolados por corretora.</span></span></label>
              </div>
            </CatalogActionForm>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-none">
          <CardHeader>
            <CardTitle>Nova operadora</CardTitle>
            <CardDescription>Cadastre uma operadora com nome, descrição e logotipo.</CardDescription>
          </CardHeader>
          <CardContent>
            <CatalogActionForm action={createGlobalCarrierAction} className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:items-start" submitLabel="Criar operadora">
              <label className="grid gap-1.5 text-sm">
                <span>Nome da operadora <span className="text-destructive">*</span></span>
                <Input name="name" placeholder="Ex.: Operadora Nacional" required />
              </label>
              <label className="grid gap-1.5 text-sm">
                <span>URL do logotipo <span className="text-muted-foreground">(opcional)</span></span>
                <Input name="logoUrl" placeholder="https://exemplo.com/logo.png" type="url" />
              </label>
              <label className="col-span-full grid gap-1.5 text-sm">
                <span>Descrição <span className="text-muted-foreground">(opcional)</span></span>
                <Input name="description" placeholder="Breve descrição da operadora, especialidades e diferenciais..." />
              </label>
            </CatalogActionForm>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-none">
          <CardHeader>
            <CardTitle>Operadoras cadastradas</CardTitle>
            <CardDescription>{carriers.length} operadora(s) registrada(s) na plataforma.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {carriers.length > 0 ? (
              <ul className="divide-y divide-border">
                {carriers.map((carrier) => (
                  <li key={carrier.id} className="flex items-center gap-4 px-5 py-4">
                    {carrier.logoUrl ? (
                      <div className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                        <Image
                          alt={`Logo ${carrier.name}`}
                          className="object-contain"
                          fill
                          sizes="40px"
                          src={carrier.logoUrl}
                        />
                      </div>
                    ) : (
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-semibold text-muted-foreground">
                        {carrier.name.charAt(0)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{carrier.name}</span>
                        <CatalogStatusBadge status={carrier.status} />
                      </div>
                      {carrier.description && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{carrier.description}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-5 py-6 text-center text-sm text-muted-foreground">
                Nenhuma operadora cadastrada ainda. Crie a primeira operadora acima.
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          {carriers.length} operadora(s) oficial(is)
          <Badge className="ml-2" variant="outline">Auditável</Badge>
        </p>
      </main>
    </>
  );
}
