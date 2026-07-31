"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getDatabase, schema } from "@/shared/db";
import { getRequiredSession } from "@/shared/auth/session";
import {
  ROLE_OVERRIDE_CONFIGS,
  SUPERADMIN_ROLE_OVERRIDE_COOKIE,
  type RoleOverrideOption,
} from "./role-impersonation";

/** Alternar cargo simulado pelo Super-Admin */
export async function setSuperAdminRoleOverrideAction(targetRole: RoleOverrideOption): Promise<{ success: boolean; message?: string }> {
  const session = await getRequiredSession();
  const db = getDatabase();

  // 1. Verificar se o usuário é platform admin
  const [dbUser] = await db
    .select({ isPlatformAdmin: schema.user.isPlatformAdmin })
    .from(schema.user)
    .where(eq(schema.user.id, session.user.id))
    .limit(1);

  if (!dbUser?.isPlatformAdmin) {
    throw new Error("Apenas Super-Administradores podem utilizar o simulador de cargos.");
  }

  const cookieStore = await cookies();

  if (targetRole === "none") {
    cookieStore.delete(SUPERADMIN_ROLE_OVERRIDE_COOKIE);
  } else if (targetRole in ROLE_OVERRIDE_CONFIGS) {
    cookieStore.set(SUPERADMIN_ROLE_OVERRIDE_COOKIE, targetRole, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 24 horas
    });
  } else {
    throw new Error("Cargo de simulação inválido.");
  }

  // 2. Registrar auditoria
  await db.insert(schema.auditLogs).values({
    id: randomUUID(),
    userId: session.user.id,
    entidade: "superadmin_role_impersonation",
    entidadeId: targetRole,
    acao: targetRole === "none" ? "impersonation_cleared" : "impersonation_set",
    createdAt: new Date(),
  });

  revalidatePath("/", "layout");
  return { success: true };
}

import { eq } from "drizzle-orm";
