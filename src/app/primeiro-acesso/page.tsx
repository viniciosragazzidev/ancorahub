import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDatabase, schema } from "@/shared/db";
import { normalizeInvitationToken } from "@/features/team/invitation-token";
import { OnboardingNotice } from "./onboarding-notice";
import { OnboardingWizard } from "./onboarding-wizard";

export default async function PrimeiroAcessoPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token: rawToken } = await searchParams;
  const token = normalizeInvitationToken(rawToken);
  if (!token) {
    return <OnboardingNotice title="Acesso inválido" description="O token de convite não foi fornecido na URL de acesso." />;
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
    .where(eq(schema.brokerInvitations.tokenHash, tokenHash))
    .limit(1);

  if (!invitation) {
    redirect("/login");
  }

  if (invitation.status === "EXPIRED" || new Date() >= invitation.expiresAt) {
    redirect("/login");
  }

  if (invitation.status !== "PENDING") {
    return (
      <OnboardingNotice
        title="Convite inválido ou expirado"
        description="Este link de ativação é de uso único, expirou ou foi revogado pelo gestor."
      />
    );
  }

  const [profile] = await db
    .select()
    .from(schema.brokerProfiles)
    .where(eq(schema.brokerProfiles.id, invitation.brokerProfileId))
    .limit(1);

  if (!profile) {
    return (
      <OnboardingNotice
        title="Perfil não encontrado"
        description="Não foi possível localizar o cadastro de perfil profissional associado."
      />
    );
  }

  return <OnboardingWizard invitation={invitation} profile={profile} />;
}
