import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";
import { OnboardingWizard } from "../primeiro-acesso/onboarding-wizard";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token) {
    return <ErrorMessage title="Acesso inválido" message="O token de convite não foi fornecido na URL de acesso." />;
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const db = getDatabase();
  const [invitation] = await db
    .select({
      id: schema.brokerInvitations.id,
      email: schema.brokerInvitations.email,
      status: schema.brokerInvitations.status,
      expiresAt: schema.brokerInvitations.expiresAt,
      brokerProfileId: schema.brokerInvitations.brokerProfileId,
      tenantId: schema.brokerInvitations.tenantId,
      branchId: schema.brokerInvitations.branchId,
      tenantName: schema.tenants.name,
      branchName: schema.branches.name,
    })
    .from(schema.brokerInvitations)
    .innerJoin(schema.tenants, eq(schema.brokerInvitations.tenantId, schema.tenants.id))
    .innerJoin(schema.branches, eq(schema.brokerInvitations.branchId, schema.branches.id))
    .where(and(eq(schema.brokerInvitations.tokenHash, tokenHash), eq(schema.brokerInvitations.status, "PENDING")))
    .limit(1);

  if (!invitation || new Date() > invitation.expiresAt) {
    return <ErrorMessage title="Convite inválido ou expirado" message="Este link de ativação é de uso único, expirou ou foi revogado pelo gestor." />;
  }

  const [profile] = await db
    .select()
    .from(schema.brokerProfiles)
    .where(eq(schema.brokerProfiles.id, invitation.brokerProfileId))
    .limit(1);

  if (!profile) {
    return <ErrorMessage title="Perfil não encontrado" message="Não foi possível localizar o perfil profissional associado." />;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/20 p-4">
      <OnboardingWizard invitation={invitation} profile={profile} />
    </div>
  );
}

function ErrorMessage({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-center">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-bold text-destructive">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
