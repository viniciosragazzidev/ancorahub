"use server";

import { randomUUID, createHash } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getDatabase, schema } from "@/shared/db";

const completeOnboardingSchema = z.object({
  invitationId: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(8).max(30),
  cpf: z.string().trim().max(20).optional().or(z.literal("")),
  birthDate: z.string().trim().min(10).max(10), // YYYY-MM-DD
  password: z.string().min(10).max(128),
  termsAccepted: z.literal("on"),
});

export type OnboardingResult = { success?: boolean; error?: string };

export async function completeOnboardingAction(
  _prev: OnboardingResult,
  formData: FormData
): Promise<OnboardingResult> {
  try {
    const input = completeOnboardingSchema.parse(Object.fromEntries(formData));
    const db = getDatabase();

    // 1. Fetch and validate invitation
    const [invitation] = await db
      .select()
      .from(schema.brokerInvitations)
      .where(and(eq(schema.brokerInvitations.id, input.invitationId), eq(schema.brokerInvitations.status, "PENDING")))
      .limit(1);

    if (!invitation) {
      throw new Error("Convite inválido ou já utilizado.");
    }

    if (new Date() > invitation.expiresAt) {
      throw new Error("O convite expirou. Solicite um novo link ao gestor.");
    }

    // 2. Fetch and validate broker profile
    const [profile] = await db
      .select()
      .from(schema.brokerProfiles)
      .where(eq(schema.brokerProfiles.id, invitation.brokerProfileId))
      .limit(1);

    if (!profile) {
      throw new Error("Perfil de corretor correspondente não encontrado.");
    }

    // 3. Clean and validate CPF matches the profile one
    const cleanInputCpf = input.cpf?.replace(/\D/g, "") || "";
    const cleanProfileCpf = profile.cpf?.replace(/\D/g, "") || "";
    if (cleanInputCpf && cleanProfileCpf && cleanInputCpf !== cleanProfileCpf) {
      throw new Error("O CPF informado não coincide com o CPF cadastrado pelo gestor.");
    }

    // 4. Validate email unique in user table
    const [existingUser] = await db
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(eq(schema.user.email, invitation.email))
      .limit(1);
    if (existingUser) {
      throw new Error("Já existe uma conta de acesso ativa com este e-mail.");
    }

    const userId = randomUUID();
    const hashedPassword = await hashPassword(input.password);

    // 5. Run transactional activation
    await db.transaction(async (tx) => {
      // Create user
      await tx.insert(schema.user).values({
        id: userId,
        name: input.name,
        email: invitation.email,
        emailVerified: true,
        active: true,
        status: "active",
      });

      // Create credential account
      await tx.insert(schema.account).values({
        id: randomUUID(),
        userId,
        providerId: "credential",
        accountId: userId,
        password: hashedPassword,
      });

      // Create tenant membership
      const membershipId = randomUUID();
      await tx.insert(schema.tenantMemberships).values({
        id: membershipId,
        tenantId: invitation.tenantId,
        userId,
        branchId: invitation.branchId,
        role: invitation.role,
        jobTitle: invitation.jobTitle as typeof schema.teamJobTitleValues[number],
        status: "active",
      });

      // Update broker profile
      await tx
        .update(schema.brokerProfiles)
        .set({
          userId,
          lifecycleStatus: "ACTIVE",
          activatedAt: new Date(),
          professionalName: input.name,
          phone: input.phone,
          cpf: cleanInputCpf || profile.cpf,
          updatedAt: new Date(),
        })
        .where(eq(schema.brokerProfiles.id, profile.id));

      // Accept invitation
      await tx
        .update(schema.brokerInvitations)
        .set({
          status: "ACCEPTED",
          acceptedAt: new Date(),
        })
        .where(eq(schema.brokerInvitations.id, invitation.id));

      // Set onboarding complete
      const onboardingId = randomUUID();
      const onboardingValues = {
        id: onboardingId,
        userId,
        tenantId: invitation.tenantId,
        status: "COMPLETED",
        completedAt: new Date(),
        updatedAt: new Date(),
      } as const;
      const insertedOnboarding = await tx
        .insert(schema.userOnboarding)
        .values(onboardingValues)
        .onConflictDoNothing()
        .returning({ id: schema.userOnboarding.id });
      if (insertedOnboarding.length === 0) {
        await tx
          .update(schema.userOnboarding)
          .set({ status: "COMPLETED", completedAt: onboardingValues.completedAt, updatedAt: onboardingValues.updatedAt })
          .where(and(eq(schema.userOnboarding.userId, userId), eq(schema.userOnboarding.tenantId, invitation.tenantId)));
      }

      // Save terms acceptance
      await tx.insert(schema.termsAcceptances).values({
        id: randomUUID(),
        tenantId: invitation.tenantId,
        userId,
        termsVersion: "v1.0",
        acceptedAt: new Date(),
      });

      // Save audit log
      await tx.insert(schema.auditLogs).values({
        id: randomUUID(),
        userId,
        entidade: "user_onboarding",
        entidadeId: onboardingId,
        acao: "concluiu_onboarding",
      });
    });

    return { success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro desconhecido ao concluir o onboarding.";
    return { success: false, error: message };
  }
}
