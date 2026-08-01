"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowsClockwise, Lightning, ShieldCheck } from "@/components/huge-icons";
import { Button } from "@/components/ui/button";
import { setSuperAdminRoleOverrideAction } from "@/features/super-admin/role-impersonation-actions";
import type { RoleOverrideOption } from "@/features/super-admin/role-impersonation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Falha ao alterar cargo simulado.");
      }
    });
  };

  const isSimulating = activeOverride && activeOverride !== "none";

  return (
    <div className="fixed bottom-24 right-6 max-[559px]:bottom-32 max-[559px]:right-3 z-50">
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button
            size="icon"
            variant="outline"
            className="size-12 rounded-full shadow-lg border-border bg-popover hover:bg-muted relative"
          >
            <Lightning className="size-5 text-foreground" />
            {isSimulating && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
              </span>
            )}
          </Button>} />
        <DropdownMenuContent align="end" side="top" className="w-56">
          <DropdownMenuLabel className="text-xs font-bold flex items-center justify-between">
            Modo Super-Admin
            {isPending && <ArrowsClockwise className="size-3.5 animate-spin text-muted-foreground" />}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup value={selectedRole} onValueChange={(v) => handleRoleChange(v as RoleOverrideOption)}>
            {ROLE_OPTIONS.map((opt) => (
              <DropdownMenuRadioItem key={opt.value} value={opt.value} disabled={isPending} className="text-xs">
                {opt.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          {isSimulating && (
            <>
              <DropdownMenuSeparator />
              <div className="p-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRoleChange("none")}
                  disabled={isPending}
                  className="w-full h-7 text-[10px] font-semibold gap-1 px-1 justify-start text-muted-foreground hover:text-foreground"
                >
                  <ShieldCheck className="size-3" /> Restaurar Cargo Real
                </Button>
              </div>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
