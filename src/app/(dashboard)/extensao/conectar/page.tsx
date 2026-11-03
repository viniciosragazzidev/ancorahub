import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { conexaoParamsSchema } from "@/features/browser-extension/conexao-schemas";

import { ConectarExtensao } from "./conectar-extensao";

export default async function ExtensaoConectarPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const context = await getRequiredTenantContext();
  // A conexão é para o corretor. Gestor e diretor usam a configuração da empresa.
  if (context.role !== "broker") redirect("/dashboard");
  const params = await searchParams;
  const parsed = conexaoParamsSchema.safeParse({
    ext: Array.isArray(params.ext) ? params.ext[0] : params.ext,
    device: Array.isArray(params.device) ? params.device[0] : params.device,
  });
  const db = getDatabase();
  const [usuario] = await db.select({ name: schema.user.name }).from(schema.user).where(eq(schema.user.id, context.userId)).limit(1);
  const [unidade] = context.branchId
    ? await db.select({ name: schema.branches.name }).from(schema.branches).where(eq(schema.branches.id, context.branchId)).limit(1)
    : [];
  return (
    <div>
      <ConectarExtensao nome={usuario?.name ?? "Corretor"} unidade={unidade?.name ?? "Sem unidade"} params={parsed.success ? parsed.data : null} />
    </div>
  );
}
