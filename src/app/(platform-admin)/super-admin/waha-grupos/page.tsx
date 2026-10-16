import { and, asc, eq } from "drizzle-orm";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listWahaGroupsAction, setWahaGroupActiveAction } from "@/features/waha-group-capture/admin-actions";
import { getRequiredPlatformAdmin } from "@/shared/auth/platform-admin";
import { getDatabase, schema } from "@/shared/db";

export const metadata = {
  title: "Grupos de operadoras — Super Admin",
};

type SearchParams = Promise<{ numero?: string; tenant?: string; todos?: string }>;

export default async function WahaGruposPage({ searchParams }: { searchParams: SearchParams }) {
  await getRequiredPlatformAdmin();
  const params = await searchParams;
  const db = getDatabase();

  const numbers = await db
    .select({
      id: schema.wahaNumbers.id,
      displayPhoneNumber: schema.wahaNumbers.displayPhoneNumber,
      label: schema.wahaNumbers.label,
    })
    .from(schema.wahaNumbers)
    .orderBy(asc(schema.wahaNumbers.displayPhoneNumber));

  const tenants = await db
    .select({ id: schema.tenants.id, name: schema.tenants.name })
    .from(schema.tenants)
    .orderBy(asc(schema.tenants.name))
    .limit(300);

  const selectedNumber = params.numero ?? "";
  const selectedTenant = params.tenant ?? "";
  const showAll = params.todos === "1";

  const groups =
    selectedNumber && selectedTenant
      ? await db
          .select({
            id: schema.wahaGroupSources.id,
            groupId: schema.wahaGroupSources.groupId,
            groupName: schema.wahaGroupSources.groupName,
            active: schema.wahaGroupSources.active,
          })
          .from(schema.wahaGroupSources)
          .where(
            and(
              eq(schema.wahaGroupSources.wahaNumberId, selectedNumber),
              eq(schema.wahaGroupSources.tenantId, selectedTenant),
              // "Só ativos" by default; the full list is one click away.
              showAll ? undefined : eq(schema.wahaGroupSources.active, true),
            ),
          )
          .orderBy(asc(schema.wahaGroupSources.groupName))
      : [];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Grupos de operadoras</h1>
        <p className="text-sm text-muted-foreground">
          Escolha quais grupos o número de empresa lê para o material de cotação. Só grupos ativos são capturados.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Número e tenant</CardTitle>
          <CardDescription>Selecione o número e o tenant que recebe o material.</CardDescription>
        </CardHeader>
        <CardContent>
          <form method="get" className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm">
              Número
              <select name="numero" defaultValue={selectedNumber} className="rounded-md border border-black px-3 py-2">
                <option value="">Selecione</option>
                {numbers.map((number) => (
                  <option key={number.id} value={number.id}>
                    {number.label ?? number.displayPhoneNumber}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Tenant
              <select name="tenant" defaultValue={selectedTenant} className="rounded-md border border-black px-3 py-2">
                <option value="">Selecione</option>
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" variant="outline">Ver grupos</Button>
          </form>
        </CardContent>
      </Card>

      {selectedNumber && selectedTenant ? (
        <Card>
          <CardHeader>
            <CardTitle>Grupos</CardTitle>
            <CardDescription>
              {showAll ? "Todos os grupos listados." : "Somente ativos."}{" "}
              <a
                className="text-[#2563eb] underline"
                href={`?numero=${selectedNumber}&tenant=${selectedTenant}${showAll ? "" : "&todos=1"}`}
              >
                {showAll ? "Mostrar só ativos" : "Mostrar todos"}
              </a>
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <form
              action={async () => {
                "use server";
                await listWahaGroupsAction({ wahaNumberId: selectedNumber, tenantId: selectedTenant });
              }}
            >
              <Button type="submit" variant="outline">Atualizar lista de grupos do WhatsApp</Button>
            </form>

            {groups.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum grupo {showAll ? "listado" : "ativo"} ainda. Atualize a lista para buscar os grupos do número.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Grupo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groups.map((group) => (
                    <TableRow key={group.id}>
                      <TableCell>{group.groupName ?? group.groupId}</TableCell>
                      <TableCell>
                        <Badge variant={group.active ? "default" : "outline"}>{group.active ? "Ativo" : "Inativo"}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <form
                          action={async () => {
                            "use server";
                            await setWahaGroupActiveAction({ id: group.id, active: !group.active });
                          }}
                        >
                          <Button type="submit" variant="outline" size="sm">
                            {group.active ? "Desativar" : "Ativar"}
                          </Button>
                        </form>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
