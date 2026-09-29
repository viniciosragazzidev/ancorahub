"use client";

import { toast } from "@/components/ui/sonner";

import { Copy } from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Props = {
  tenantId: string;
  tenantName: string | null;
  pilotEnabled: boolean;
};

export function TenantDebugBar({ tenantId, tenantName, pilotEnabled }: Props) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground">
      <div className="flex items-center gap-3">
        <span className="font-medium">Tenant:</span>
        <span className="font-semibold text-foreground">{tenantName ?? "N/A"}</span>
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">{tenantId}</code>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={pilotEnabled ? "success" : "outline"}>{pilotEnabled ? "Piloto ativo" : "Piloto inativo"}</Badge>
        <Button
          size="icon-sm"
          variant="ghost"
          type="button"
          aria-label="Copiar UUID"
          onClick={() =>
            navigator.clipboard.writeText(tenantId).then(() => toast.success("UUID copiado")).catch(() => {})
          }
        >
          <Copy className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
