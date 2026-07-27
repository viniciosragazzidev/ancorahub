import { cn } from "@/lib/utils";

type OwnershipContextProps = {
  brokerName: string | null | undefined;
  branchName: string | null | undefined;
  className?: string;
  emptyLabel?: string;
};

type ViewScopeContextProps = {
  role: "director" | "manager" | "broker";
  branchName?: string | null;
  className?: string;
};

export function OwnershipContext({ brokerName, branchName, className, emptyLabel = "Aguardando distribuição" }: OwnershipContextProps) {
  if (!brokerName && !branchName) return <span className={cn("text-muted-foreground", className)}>{emptyLabel}</span>;
  return <span className={cn("inline-flex min-w-0 flex-wrap items-baseline gap-x-1", className)}><span className="font-medium text-foreground">{brokerName ?? "Sem corretor"}</span><span className="text-muted-foreground">· {branchName ?? "Sem unidade"}</span></span>;
}

export function ViewScopeContext({ role, branchName, className }: ViewScopeContextProps) {
  const label = role === "director"
    ? "Visão consolidada · Todas as unidades"
    : role === "manager"
      ? `Unidade: ${branchName ?? "não identificada"}`
      : `Unidade: ${branchName ?? "minha unidade"}`;

  return <span className={cn("inline-flex w-fit items-center rounded-md border border-border/70 bg-muted/40 px-2.5 py-1 text-xs font-medium text-muted-foreground", className)}>{label}</span>;
}
