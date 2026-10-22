import "server-only";

import { randomBytes, randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { and, eq, gte, or } from "drizzle-orm";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { canGenerateMemberPasswordReset } from "./password-recovery-scope";
import { enqueueMetaTextMessage, processMetaOutboundBatch } from "@/features/communication-channels/outbound-service";
import {
  buildCredentialAccount,
  buildCredentialAccountPasswordUpdate,
  CREDENTIAL_PROVIDER_ID,
} from "@/shared/auth/credential-account";

/** One self-service link per person every 2 minutes: a repeated click does not flood their WhatsApp. */
const SELF_SERVICE_INTERVAL_MS = 2 * 60_000;
const SELF_SERVICE_LINK_TTL_MS = 60 * 60_000;

/**
 * "Esqueceu a senha?" on the login (Vinicios, 22/10): the person types their e-mail
 * and the reset link goes straight to their own WhatsApp, with no director in the
 * middle. The answer never says whether the e-mail exists. Open sessions only end
 * when the new password is saved, so asking for a link cannot log anyone out.
 * Without a phone, or when WhatsApp fails, it falls back to the director approval.
 */
export async function requestPasswordResetByWhatsApp(email: string) {
  const db = getDatabase();
  const [user] = await db
    .select({ id: schema.user.id, email: schema.user.email })
    .from(schema.user)
    .where(eq(schema.user.email, email.trim().toLowerCase()))
    .limit(1);
  if (!user) return { success: true };

  const [membership] = await db
    .select({ tenantId: schema.tenantMemberships.tenantId })
    .from(schema.tenantMemberships)
    .where(and(eq(schema.tenantMemberships.userId, user.id), eq(schema.tenantMemberships.status, "active")))
    .limit(1);
  if (!membership) return { success: true };

  const [recent] = await db
    .select({ id: schema.passwordResetRequests.id })
    .from(schema.passwordResetRequests)
    .where(and(
      eq(schema.passwordResetRequests.userId, user.id),
      eq(schema.passwordResetRequests.status, "approved"),
      gte(schema.passwordResetRequests.createdAt, new Date(Date.now() - SELF_SERVICE_INTERVAL_MS)),
    ))
    .limit(1);
  if (recent) return { success: true };

  const id = randomUUID();
  const token = randomBytes(32).toString("hex");
  const now = new Date();
  await db.insert(schema.passwordResetRequests).values({
    id,
    tenantId: membership.tenantId,
    userId: user.id,
    userEmail: user.email,
    status: "approved",
    token,
    tokenExpiresAt: new Date(now.getTime() + SELF_SERVICE_LINK_TTL_MS),
    reviewedAt: now,
    directorNotes: "Pedido pela própria pessoa na tela de login; link enviado no WhatsApp cadastrado.",
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(schema.auditLogs).values({ id: randomUUID(), userId: user.id, entidade: "password_reset", entidadeId: id, acao: "password_reset.self_service_whatsapp" });

  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL || "").replace(/\/$/, "");
  const resetUrl = `${baseUrl}/recuperar-senha?token=${encodeURIComponent(token)}`;
  const status = await sendPasswordResetWhatsApp({ tenantId: membership.tenantId, userId: user.id, requestedBy: user.id, resetUrl, requestId: id, selfService: true });
  if (status === "sent") return { success: true };

  // No phone or WhatsApp down: the unused link is closed and the director approves instead.
  await db.update(schema.passwordResetRequests).set({ status: "rejected", token: null, directorNotes: status === "no_phone" ? "Sem telefone cadastrado." : "Falha no envio pelo WhatsApp.", updatedAt: new Date() })
    .where(eq(schema.passwordResetRequests.id, id));
  return requestPasswordReset(user.email);
}

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

  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL || "").replace(/\/$/, "");
  const resetUrl = `${baseUrl}/recuperar-senha?token=${encodeURIComponent(token)}`;
  // It used to reuse the invitation template with the wrong variables, so the link never arrived.
  await sendPasswordResetWhatsApp({ tenantId: context.tenantId, userId: request.userId, requestedBy: context.userId, resetUrl, requestId });

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
    const updatedAccounts = await tx
      .update(schema.account)
      .set(buildCredentialAccountPasswordUpdate(request.userId, hashedPassword))
      .where(
        and(
          eq(schema.account.userId, request.userId),
          eq(schema.account.providerId, CREDENTIAL_PROVIDER_ID),
        ),
      )
      .returning({ id: schema.account.id });

    if (updatedAccounts.length === 0) {
      await tx.insert(schema.account).values(buildCredentialAccount({
        id: randomUUID(),
        userId: request.userId,
        password: hashedPassword,
      }));
    }

    // The new password ends every open session (the self-service request does not).
    await tx.delete(schema.session).where(eq(schema.session.userId, request.userId));

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

  return { success: true, userEmail: request.userEmail };
}

/**
 * Gera um link de redefinição de senha para um membro da equipe (solicitado por diretor ou gestor).
 */
export type PasswordResetWhatsAppStatus = "sent" | "failed" | "no_phone";

/**
 * Sends the reset link to the member's own WhatsApp right away (Vinicios, 20/10: no copy and
 * paste), as free text on the same route as the chat messages to brokers (no Meta template).
 * When it fails the screen keeps the link to copy.
 */
async function sendPasswordResetWhatsApp(input: { tenantId: string; userId: string; requestedBy: string; resetUrl: string; requestId: string; selfService?: boolean }): Promise<PasswordResetWhatsAppStatus> {
  // A WhatsApp problem never stops the reset: the screen still shows the link to copy.
  try {
    const db = getDatabase();
    const [member] = await db
      .select({ name: schema.user.name, phone: schema.brokerProfiles.phone, tenantName: schema.tenants.name })
      .from(schema.user)
      .leftJoin(schema.brokerProfiles, and(eq(schema.brokerProfiles.userId, schema.user.id), eq(schema.brokerProfiles.tenantId, input.tenantId)))
      .leftJoin(schema.tenants, eq(schema.tenants.id, input.tenantId))
      .where(eq(schema.user.id, input.userId))
      .limit(1);
    if (!member?.phone) return "no_phone";
    const firstName = member.name?.trim().split(/\s+/)[0];
    const queued = await enqueueMetaTextMessage({
      tenantId: input.tenantId,
      recipientType: "user",
      recipientId: input.userId,
      destinationPhone: member.phone,
      purpose: "passwordReset",
      body: input.selfService
        ? `Olá${firstName ? `, ${firstName}` : ""}! Recebemos um pedido para trocar a sua senha do CRM da ${member.tenantName ?? "Âncora Saúde"}. Para criar uma nova senha, abra o link:\n\n${input.resetUrl}\n\nO link vale por 1 hora. Se não foi você quem pediu, ignore esta mensagem: a sua senha continua a mesma.`
        : `Olá${firstName ? `, ${firstName}` : ""}! A gestão da ${member.tenantName ?? "Âncora Saúde"} gerou um link para você criar uma nova senha no CRM:\n\n${input.resetUrl}\n\nO link vale por 24 horas. Se não foi você quem pediu, avise a sua gestão.`,
      requestedBy: input.requestedBy,
      idempotencyKey: `password-reset:${input.requestId}`,
    });
    const delivery = await processMetaOutboundBatch(1, input.tenantId, queued.id);
    return delivery.sent ? "sent" : "failed";
  } catch {
    return "failed";
  }
}

export async function generatePasswordResetLinkForMember(targetIdentifier: string) {
  const context = await getRequiredTenantContext();
  if (context.role !== "director" && context.role !== "manager") {
    throw new Error("Permissão insuficiente para gerar link de redefinição de senha.");
  }

  const db = getDatabase();

  const [target] = await db
    .select({ tenantId: schema.tenantMemberships.tenantId, userId: schema.user.id, email: schema.user.email, role: schema.tenantMemberships.role, branchId: schema.tenantMemberships.branchId })
    .from(schema.tenantMemberships)
    .innerJoin(schema.user, eq(schema.user.id, schema.tenantMemberships.userId))
    .leftJoin(schema.brokerProfiles, and(eq(schema.brokerProfiles.userId, schema.user.id), eq(schema.brokerProfiles.tenantId, context.tenantId)))
    .where(and(
      eq(schema.tenantMemberships.tenantId, context.tenantId),
      or(eq(schema.user.id, targetIdentifier), eq(schema.tenantMemberships.id, targetIdentifier), eq(schema.brokerProfiles.id, targetIdentifier)),
    ))
    .limit(1);

  if (!target) throw new Error("Este membro ainda não possui uma conta cadastrada neste tenant.");
  if (!canGenerateMemberPasswordReset(context, target)) throw new Error("Este membro está fora do seu escopo de gestão.");
  const user = { id: target.userId, email: target.email };
  const targetUserId = target.userId;

  const id = randomUUID();
  const token = randomBytes(32).toString("hex");
  const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas
  const now = new Date();

  await db.insert(schema.passwordResetRequests).values({
    id,
    tenantId: context.tenantId,
    userId: targetUserId,
    userEmail: user.email,
    status: "approved",
    token,
    tokenExpiresAt,
    reviewedBy: context.userId,
    reviewedAt: now,
    createdAt: now,
    updatedAt: now,
  });

  // Revogar sessões ativas do membro por segurança
  await db.delete(schema.session).where(eq(schema.session.userId, targetUserId));

  // Log de auditoria
  await db.insert(schema.auditLogs).values({
    id: randomUUID(),
    userId: context.userId,
    entidade: "user",
    entidadeId: targetUserId,
    acao: "team.generated_password_reset_link",
  });

  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL || "").replace(/\/$/, "");
  const resetUrl = `${baseUrl}/recuperar-senha?token=${encodeURIComponent(token)}`;
  const whatsappStatus = await sendPasswordResetWhatsApp({ tenantId: context.tenantId, userId: targetUserId, requestedBy: context.userId, resetUrl, requestId: id });

  return { success: true, resetUrl, whatsappStatus };
}

