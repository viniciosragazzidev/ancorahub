import { PlatformAdminHeader } from "@/components/platform-admin-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listAllMaterialsGlobally } from "@/features/promotional-materials/queries-global";

const CATEGORY_LABELS: Record<string, string> = {
  todos: "Todos",
  avisos: "Avisos",
  eventos: "Eventos",
  informativos: "Informativos",
  premiacoes: "Premiações",
  promocoes: "Promoções",
  treinamentos: "Treinamentos",
  materiais_divulgacao: "Materiais de Divulgação",
};

export default async function SuperAdminMaterialsPage() {
  const materials = await listAllMaterialsGlobally();

  const tenantGroups = materials.reduce(
    (acc, m) => {
      const key = m.tenantId ?? "unknown";
      if (!acc[key]) acc[key] = { name: m.tenantName ?? "Desconhecido", items: [] };
      acc[key].items.push(m);
      return acc;
    },
    {} as Record<string, { name: string; items: typeof materials }>,
  );

  return (
    <>
      <PlatformAdminHeader breadcrumb="CorreTop / Admin" title="Materiais de Divulgação" />
      <main className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
        <section className="flex flex-col gap-2">
          <p className="text-xs font-medium text-primary">GOVERNANÇA DE CONTEÚDO</p>
          <h1 className="text-2xl font-semibold tracking-tight">Materiais de Divulgação</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Visão global de todos os materiais de divulgação cadastrados nas empresas da plataforma. Cada empresa gerencia seus próprios materiais pela área administrativa.
          </p>
        </section>

        <Card className="border-border bg-card shadow-none">
          <CardHeader>
            <CardTitle>Materiais por empresa</CardTitle>
            <CardDescription>
              {materials.length} material(is) no total em {Object.keys(tenantGroups).length} empresa(s).
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Empresa</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="pr-5 text-right">Criado em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {materials.map((material) => (
                  <TableRow key={material.id}>
                    <TableCell className="pl-5 font-medium">
                      {material.tenantName ?? "—"}
                    </TableCell>
                    <TableCell className="max-w-[240px] truncate">
                      {material.title}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {CATEGORY_LABELS[material.category] ?? material.category}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={material.active ? "success" : "secondary"}>
                        {material.active ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="pr-5 text-right text-sm text-muted-foreground">
                      {new Date(material.createdAt).toLocaleDateString("pt-BR")}
                    </TableCell>
                  </TableRow>
                ))}
                {materials.length === 0 && (
                  <TableRow>
                    <TableCell className="p-6 text-center text-sm text-muted-foreground" colSpan={5}>
                      Nenhum material de divulgação cadastrado na plataforma.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          {materials.length} material(is) cadastrado(s) ·{" "}
          {Object.keys(tenantGroups).length} empresa(s) com materiais
          <Badge className="ml-2" variant="outline">Somente leitura</Badge>
        </p>
      </main>
    </>
  );
}
