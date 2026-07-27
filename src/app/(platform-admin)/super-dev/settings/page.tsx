import { PlatformAdminHeader } from "@/components/platform-admin-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function SuperDevSettingsPage() {
  return (
    <>
      <PlatformAdminHeader breadcrumb="CorreTop / Admin" title="Configurações da Plataforma" />

      <main className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
        <section className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Parâmetros Globais</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Ajuste as configurações gerais da plataforma CorreTop.
            </p>
          </div>
        </section>

        <Card className="border-border bg-card shadow-none">
          <CardHeader>
            <CardTitle>Configuração do Servidor</CardTitle>
            <CardDescription>Parâmetros operacionais do ambiente ativo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div className="flex justify-between py-2 border-b">
              <span className="font-medium text-muted-foreground">Nome do sistema:</span>
              <span className="font-semibold">CorreTop CRM</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="font-medium text-muted-foreground">Banco de dados:</span>
              <Badge variant="outline" className="text-emerald-500 border-emerald-500/20 bg-emerald-500/10">PostgreSQL (Neon)</Badge>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="font-medium text-muted-foreground">Versão do sistema:</span>
              <span className="font-semibold">v2.10.0-prod</span>
            </div>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
