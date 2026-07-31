"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowsClockwise, Lightning, ShieldCheck } from "@/components/huge-icons";
import { Button } from "@/components/ui/button";
import { setSuperAdminRoleOverrideAction } from "@/features/super-admin/role-impersonation-actions";
import type { RoleOverrideOption } from "@/features/super-admin/role-impersonation";

type SuperAdminRoleSwitcherProps = {
  activeOverride: string | null | undefined;
  compact?: boolean;
};

const ROLE_OPTIONS: Array<{ value: RoleOverrideOption; label: string; badge: string }> = [
  { value: "none", label: "👑 Cargo Real (Super-Admin)", badge: "Super-Admin" },
  { value: "director", label: "🏢 Diretor", badge: "Diretor" },
  { value: "manager", label: "👔 Gestor / Gerente", badge: "Gestor" },
  { value: "broker", label: "💼 Corretor", badge: "Corretor" },
  { value: "marketing", label: "🎯 Marketing (Especialista)", badge: "Marketing" },
  { value: "finance", label: "💰 Financeiro (Backoffice)", badge: "Financeiro" },
];

export function SuperAdminRoleSwitcher({ activeOverride }: SuperAdminRoleSwitcherProps) {
  const [isPending, startTransition] = useTransition();
  const [selectedRole, setSelectedRole] = useState<RoleOverrideOption>((activeOverride as RoleOverrideOption) || "none");
  const router = useRouter();

  const handleRoleChange = (newRole: RoleOverrideOption) => {
    setSelectedRole(newRole);
    startTransition(async () => {
      try {
        const res = await setSuperAdminRoleOverrideAction(newRole);
        if (res.success) {
          toast.success(
            newRole === "none"
              ? "Cargo real restaurado com sucesso!"
              : `Visão simulada: ${ROLE_OPTIONS.find((r) => r.value === newRole)?.badge}`
          );
          router.refresh();
        }
      } catch (err: any) {
        toast.error(err?.message || "Falha ao alterar cargo simulado.");
      }
    });
  };

  const isSimulating = activeOverride && activeOverride !== "none";

  return (
    <div className="w-full rounded-xl border border-amber-500/30 bg-amber-500/5 p-2.5 space-y-2 text-left">
      <div className="flex items-center justify-between gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
        <span className="flex items-center gap-1.5 truncate">
          <Lightning className="size-3.5 shrink-0 text-amber-500" /> Modo Super-Admin
        </span>
        {isSimulating && (
          <span className="size-2 rounded-full bg-amber-500 animate-pulse shrink-0" title="Simulação Ativa" />
        )}
      </div>

      <div className="space-y-1">
        <div className="relative">
          <select
            value={selectedRole}
            onChange={(e) => handleRoleChange(e.target.value as RoleOverrideOption)}
            disabled={isPending}
            className="w-full h-8 rounded-lg border border-amber-500/20 bg-background text-foreground text-xs font-medium pl-2.5 pr-7 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer truncate shadow-2xs"
          >
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {isPending && (
            <div className="absolute right-2 top-2">
              <ArrowsClockwise className="size-3.5 animate-spin text-amber-500" />
            </div>
          )}
        </div>
      </div>

      {isSimulating && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleRoleChange("none")}
          disabled={isPending}
          className="w-full h-6 text-[10px] text-amber-600 hover:text-amber-700 hover:bg-amber-500/10 font-semibold gap-1 px-1"
        >
          <ShieldCheck className="size-3" /> Restaurar Cargo Real
        </Button>
      )}
    </div>
  );
}

