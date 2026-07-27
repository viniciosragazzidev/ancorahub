import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";
import { OnboardingWizard } from "./onboarding-wizard";

export default async function PrimeiroAcessoPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center bg-background">
        <div className="max-w-md w-full rounded-xl border border-border p-6 shadow-sm bg-card">
          <h1 className="text-xl font-bold text-destructive">Acesso Inválido</h1>
          <p className="mt-2 text-sm text-muted-foreground">O token de convite não foi fornecido na URL de acesso.</p>
        </div>
      </div>
    );
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
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center bg-background">
        <div className="max-w-md w-full rounded-xl border border-border p-6 shadow-sm bg-card">
          <h1 className="text-xl font-bold text-destructive font-semibold">Convite Inválido ou Expirado</h1>
          <p className="mt-2 text-sm text-muted-foreground">Este link de ativação é de uso único, expirou ou foi revogado pelo gestor.</p>
        </div>
      </div>
    );
  }

  const [profile] = await db
    .select()
    .from(schema.brokerProfiles)
    .where(eq(schema.brokerProfiles.id, invitation.brokerProfileId))
    .limit(1);

  if (!profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center bg-background">
        <div className="max-w-md w-full rounded-xl border border-border p-6 shadow-sm bg-card">
          <h1 className="text-xl font-bold text-destructive font-semibold">Perfil não encontrado</h1>
          <p className="mt-2 text-sm text-muted-foreground">Não foi possível localizar o cadastro de perfil profissional associado.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/20 p-4">
      <OnboardingWizard
        invitation={invitation}
        profile={profile}
      />
    </div>
  );
}
