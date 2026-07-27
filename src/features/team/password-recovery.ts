import "server-only";

import { randomBytes, randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { enqueueMetaTemplateMessage } from "@/features/communication-channels/outbound-service";

/**
 * Cria uma solicitação de recuperação de senha.
 * Notifica os diretores do tenant para aprovação.
 */
export async function requestPasswordReset(email: string) {
  const db = getDatabase();

  const [user] = await db
    .select({ id: schema.user.id, name: schema.user.name, email: schema.user.email })
    .from(schema.user)
    .where(eq(schema.user.email, email.toLowerCase()))
    .limit(1);

  if (!user) {
    // Não revelar se o email existe ou não
    return { success: true };
  }

  const [membership] = await db
    .select({ tenantId: schema.tenantMemberships.tenantId })
    .from(schema.tenantMemberships)
    .where(eq(schema.tenantMemberships.userId, user.id))
    .limit(1);

  if (!membership) return { success: true };

  // Verificar se já existe uma solicitação pendente para este usuário
  const [existing] = await db
    .select({ id: schema.passwordResetRequests.id })
    .from(schema.passwordResetRequests)
    .where(
      and(
        eq(schema.passwordResetRequests.userId, user.id),
        eq(schema.passwordResetRequests.status, "requested"),
      ),
    )
    .limit(1);

  if (existing) return { success: true };

  const id = randomUUID();
  await db.insert(schema.passwordResetRequests).values({
    id,
    tenantId: membership.tenantId,
    userId: user.id,
    userEmail: user.email,
    status: "requested",
  });

  // Notificar diretores
  await notifyDirectorsOfResetRequest(membership.tenantId, user.name, user.email);

  return { success: true };
}

async function notifyDirectorsOfResetRequest(tenantId: string, userName: string, userEmail: string) {
  const db = getDatabase();
  const directors = await db
    .select({ userId: schema.tenantMemberships.userId })
    .from(schema.tenantMemberships)
    .where(
      and(
        eq(schema.tenantMemberships.tenantId, tenantId),
        eq(schema.tenantMemberships.role, "director"),
        eq(schema.tenantMemberships.status, "active"),
      ),
    );

  for (const director of directors) {
    await db.insert(schema.notifications).values({
      id: randomUUID(),
      tenantId,
      recipientUserId: director.userId,
      type: "password_reset_request",
      title: "Solicitação de recuperação de senha",
      message: `${userName} (${userEmail}) solicitou recuperação de senha.`,
    });
  }
}

/**
 * Lista as solicitações de reset pendentes para o tenant do diretor.
 */
export async function getPendingResetRequests() {
  const context = await getRequiredTenantContext();
  if (context.role !== "director") throw new Error("Apenas diretores podem gerenciar solicitações de recuperação.");

  const db = getDatabase();
  return db
    .select({
      id: schema.passwordResetRequests.id,
      userId: schema.passwordResetRequests.userId,
      userEmail: schema.passwordResetRequests.userEmail,
      status: schema.passwordResetRequests.status,
      createdAt: schema.passwordResetRequests.createdAt,
      userName: schema.user.name,
    })
    .from(schema.passwordResetRequests)
    .innerJoin(schema.user, eq(schema.passwordResetRequests.userId, schema.user.id))
    .where(
      and(
        eq(schema.passwordResetRequests.tenantId, context.tenantId),
        eq(schema.passwordResetRequests.status, "requested"),
      ),
    )
    .orderBy(schema.passwordResetRequests.createdAt);
}

/**
 * Diretor aprova a solicitação: gera token, envia link via WhatsApp e revoga sessões.
 */
export async function approvePasswordReset(requestId: string) {
  const context = await getRequiredTenantContext();
  if (context.role !== "director") throw new Error("Apenas diretores podem aprovar recuperações.");

  const db = getDatabase();
  const [request] = await db
    .select()
    .from(schema.passwordResetRequests)
    .where(
      and(
        eq(schema.passwordResetRequests.id, requestId),
        eq(schema.passwordResetRequests.tenantId, context.tenantId),
        eq(schema.passwordResetRequests.status, "requested"),
      ),
    )
    .limit(1);

  if (!request) throw new Error("Solicitação não encontrada ou já processada.");

  const token = randomBytes(32).toString("hex");
  const tokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

  await db
    .update(schema.passwordResetRequests)
    .set({
      status: "approved",
      token,
      tokenExpiresAt,
      reviewedBy: context.userId,
      reviewedAt: new Date(),
    })
    .where(eq(schema.passwordResetRequests.id, requestId));

  // Revogar sessões atuais do usuário
  await db.delete(schema.session).where(eq(schema.session.userId, request.userId));

  // Buscar telefone do usuário para enviar WhatsApp
  const [profile] = await db
    .select({ phone: schema.brokerProfiles.phone })
    .from(schema.brokerProfiles)
    .where(eq(schema.brokerProfiles.userId, request.userId))
    .limit(1);

  const [tenant] = await db
    .select({ name: schema.tenants.name })
    .from(schema.tenants)
    .where(eq(schema.tenants.id, context.tenantId))
    .limit(1);

  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL || "").replace(/\/$/, "");
  const resetUrl = `${baseUrl}/recuperar-senha?token=${encodeURIComponent(token)}`;

  // Tentar enviar WhatsApp via Meta Cloud
  if (profile?.phone) {
    try {
      await enqueueMetaTemplateMessage({
        tenantId: context.tenantId,
        recipientType: "user",
        destinationPhone: profile.phone,
        purpose: "brokerInvitation", // Reusing template infrastructure
        variables: [request.userEmail, tenant?.name ?? "CorreTop", resetUrl],
        requestedBy: context.userId,
        idempotencyKey: `password-reset:${requestId}`,
      });
    } catch {
      // Fallback silencioso se WhatsApp não estiver configurado
    }
  }

  return { success: true, resetUrl };
}

/**
 * Diretor rejeita a solicitação.
 */
export async function rejectPasswordReset(requestId: string, reason?: string) {
  const context = await getRequiredTenantContext();
  if (context.role !== "director") throw new Error("Apenas diretores podem gerenciar solicitações de recuperação.");

  const db = getDatabase();
  await db
    .update(schema.passwordResetRequests)
    .set({
      status: "rejected",
      reviewedBy: context.userId,
      reviewedAt: new Date(),
      directorNotes: reason ?? null,
    })
    .where(
      and(
        eq(schema.passwordResetRequests.id, requestId),
        eq(schema.passwordResetRequests.tenantId, context.tenantId),
      ),
    );

  return { success: true };
}

/**
 * Usuário finaliza o reset usando o token recebido.
 */
export async function completePasswordReset(token: string, newPassword: string) {
  const db = getDatabase();

  const [request] = await db
    .select()
    .from(schema.passwordResetRequests)
    .where(
      and(
        eq(schema.passwordResetRequests.token, token),
        eq(schema.passwordResetRequests.status, "approved"),
      ),
    )
    .limit(1);

  if (!request) throw new Error("Token inválido ou expirado.");
  if (!request.tokenExpiresAt || request.tokenExpiresAt < new Date()) {
    throw new Error("O token de recuperação expirou. Solicite novamente.");
  }

  const hashedPassword = await hashPassword(newPassword);

  await db.transaction(async (tx) => {
    // Atualizar senha
    await tx
      .update(schema.account)
      .set({ password: hashedPassword, updatedAt: new Date() })
      .where(
        and(
          eq(schema.account.userId, request.userId),
          eq(schema.account.providerId, "credential"),
        ),
      );

    // Marcar solicitação como concluída
    await tx
      .update(schema.passwordResetRequests)
      .set({ status: "completed" })
      .where(eq(schema.passwordResetRequests.id, request.id));

    // Registrar auditoria
    await tx.insert(schema.auditLogs).values({
      id: randomUUID(),
      userId: request.userId,
      entidade: "password_reset",
      entidadeId: request.id,
      acao: "completou_reset_senha",
    });
  });

  return { success: true };
}
