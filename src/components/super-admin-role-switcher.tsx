"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowsClockwise, Lightning, ShieldCheck, UserList } from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { setSuperAdminRoleOverrideAction } from "@/features/super-admin/role-impersonation-actions";
import type { RoleOverrideOption } from "@/features/super-admin/role-impersonation";

type SuperAdminRoleSwitcherProps = {
  activeOverride: string | null | undefined;
  compact?: boolean;
};

const ROLE_OPTIONS: Array<{ value: RoleOverrideOption; label: string; icon: string; badge: string }> = [
  { value: "none", label: "👑 Cargo Real (Super-Admin)", icon: "👑", badge: "Super-Admin" },
  { value: "director", label: "🏢 Diretor", icon: "🏢", badge: "Diretor" },
  { value: "manager", label: "👔 Gestor / Gerente", icon: "👔", badge: "Gestor" },
  { value: "broker", label: "💼 Corretor", icon: "💼", badge: "Corretor" },
  { value: "marketing", label: "🎯 Marketing (Especialista)", icon: "🎯", badge: "Marketing" },
  { value: "finance", label: "💰 Financeiro (Backoffice)", icon: "💰", badge: "Financeiro" },
];

export function SuperAdminRoleSwitcher({ activeOverride, compact = false }: SuperAdminRoleSwitcherProps) {
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
              ? "Cargo real de Super-Admin restaurado com sucesso!"
              : `Simulação de cargo alterada para: ${ROLE_OPTIONS.find((r) => r.value === newRole)?.badge}`
          );
          router.refresh();
        }
      } catch (err: any) {
        toast.error(err?.message || "Falha ao alterar cargo simulado.");
      }
    });
  };

  const isSimulating = activeOverride && activeOverride !== "none";

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <select
          value={selectedRole}
          onChange={(e) => handleRoleChange(e.target.value as RoleOverrideOption)}
          disabled={isPending}
          className="h-8 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-500 text-xs font-semibold px-2 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
        >
          {ROLE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-background text-foreground">
              {opt.label}
            </option>
          ))}
        </select>
        {isPending && <ArrowsClockwise className="size-3.5 animate-spin text-amber-500" />}
      </div>
    );
  }

  return (
    <div className="mx-2 mb-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
          <Lightning className="size-4 shrink-0" />
          <span>Modo Super-Admin</span>
        </div>
        {isSimulating && (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-[10px] font-mono font-semibold uppercase">
            🧪 Simulação Ativa
          </Badge>
        )}
      </div>

      <div className="space-y-1">
        <label className="text-[11px] text-muted-foreground font-medium block">Visão de Cargo Simulada:</label>
        <div className="relative">
          <select
            value={selectedRole}
            onChange={(e) => handleRoleChange(e.target.value as RoleOverrideOption)}
            disabled={isPending}
            className="w-full h-9 rounded-lg border border-border bg-card text-foreground text-xs font-medium px-3 pr-8 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer shadow-xs"
          >
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {isPending && (
            <div className="absolute right-2.5 top-2.5">
              <ArrowsClockwise className="size-4 animate-spin text-amber-500" />
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
          className="w-full h-7 text-[11px] text-amber-600 hover:text-amber-700 hover:bg-amber-500/10 font-semibold gap-1.5"
        >
          <ShieldCheck className="size-3.5" /> Restaurar Cargo Real
        </Button>
      )}
    </div>
  );
}

