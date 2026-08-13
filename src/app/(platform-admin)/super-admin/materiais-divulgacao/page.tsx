import { PlatformAdminHeader } from "@/components/platform-admin-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listAllMaterialsGlobally } from "@/features/promotional-materials/queries-global";
import { getRequiredPlatformAdmin } from "@/shared/auth/platform-admin";

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

function formatDate(val: unknown): string {
  if (!val) return "—";
  try {
    const d = new Date(val as Date | string | number);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("pt-BR");
  } catch {
    return "—";
  }
}

export default async function SuperAdminMaterialsPage() {
  await getRequiredPlatformAdmin();

  let materials: Awaited<ReturnType<typeof listAllMaterialsGlobally>> = [];
  try {
    materials = await listAllMaterialsGlobally();
  } catch (err) {
    console.error("[super-admin-materials] Erro ao buscar materiais globais:", err);
  }

  const safeMaterials = Array.isArray(materials) ? materials : [];

  const tenantGroups = safeMaterials.reduce(
    (acc, m) => {
      const key = m?.tenantId ?? "unknown";
      if (!acc[key]) acc[key] = { name: m?.tenantName ?? "Desconhecido", items: [] };
      acc[key].items.push(m);
      return acc;
    },
    {} as Record<string, { name: string; items: typeof safeMaterials }>,
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

        <Card className="border-transparent bg-transparent shadow-none">
          <CardHeader>
            <CardTitle>Materiais por empresa</CardTitle>
            <CardDescription>
              {safeMaterials.length} material(is) no total em {Object.keys(tenantGroups).length} empresa(s).
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
                {safeMaterials.map((material) => (
                  <TableRow key={material.id}>
                    <TableCell className="pl-5 font-medium">
                      {material.tenantName ?? "—"}
                    </TableCell>
                    <TableCell className="max-w-[240px] truncate">
                      {material.title ?? "Sem título"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {material.category ? (CATEGORY_LABELS[material.category] ?? material.category) : "Geral"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={material.active ? "success" : "secondary"}>
                        {material.active ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="pr-5 text-right text-sm text-muted-foreground">
                      {formatDate(material.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
                {safeMaterials.length === 0 && (
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
          {safeMaterials.length} material(is) cadastrado(s) ·{" "}
          {Object.keys(tenantGroups).length} empresa(s) com materiais
          <Badge className="ml-2" variant="outline">Somente leitura</Badge>
        </p>
      </main>
    </>
  );
}
