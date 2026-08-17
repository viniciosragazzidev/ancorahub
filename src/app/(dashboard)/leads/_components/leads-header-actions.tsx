"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { FileText, Lightning, MoreHorizontalIcon, Plus } from "@/components/huge-icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PeriodSelect } from "@/components/period-select";
import { DEFAULT_PERIOD, PERIOD_OPTIONS, type PeriodValue } from "@/shared/period";
import type { TenantRole } from "@/shared/db/schema";

import { BulkLeadImportDialog } from "./bulk-lead-import-dialog";
import { ManualLeadSheet } from "./manual-lead-sheet";

type PlanOption = { id: string; name: string; carrierName: string };
type Branch = { id: string; name: string };
type LeadQueue = { id: string; name: string; branchId: string | null };
type UrgentLead = { id: string; nome: string; status: string; urgentReason: string } | null;

/**
 * Ações do cabeçalho de /leads com layout responsivo:
 * - ≥ lg: todas as ações em linha (Período, próximo lead, importar, novo lead).
 * - < lg: botão primário "Novo lead" + menu "Mais ações" com Período, Importar e
 *   Próximo lead — evita overflow horizontal do header em telas estreitas.
 */
export function LeadsHeaderActions({
  period,
  plans,
  branches,
  queues,
  role,
  jobTitle,
  branchId,
  urgentLead,
  initiallyOpen = false,
  children,
}: {
  period: PeriodValue;
  plans: PlanOption[];
  branches: Branch[];
  queues: LeadQueue[];
  role: TenantRole;
  jobTitle: string;
  branchId: string | null;
  urgentLead: UrgentLead;
  initiallyOpen?: boolean;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [leadSheetOpen, setLeadSheetOpen] = useState(initiallyOpen);
  const [importOpen, setImportOpen] = useState(false);

  const isCentralMarketing = jobTitle === "marketing" && branchId === null;
  const canImport = role === "director" || role === "manager" || role === "supervisor" || isCentralMarketing;

  function selectPeriod(days: PeriodValue) {
    const params = new URLSearchParams(searchParams.toString());
    if (days === DEFAULT_PERIOD) params.delete("period");
    else params.set("period", String(days));
    if (pathname) router.push(`${pathname}${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <>
      {/* ≥ lg: todas as ações em linha */}
      <div className="hidden items-center gap-2 lg:flex">
        <PeriodSelect value={period} />
        {children}
        {canImport ? (
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <FileText /> Importar leads
          </Button>
        ) : null}
        <Button size="sm" onClick={() => setLeadSheetOpen(true)}>
          <Plus weight="bold" /> Novo lead
        </Button>
      </div>

      {/* < lg: ações compactas em menu */}
      <div className="flex items-center gap-1.5 lg:hidden">
        <Button size="sm" className="shrink-0" onClick={() => setLeadSheetOpen(true)}>
          <Plus weight="bold" /> Novo lead
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button size="icon-sm" variant="outline" aria-label="Mais ações" className="shrink-0" />}>
            <MoreHorizontalIcon className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 p-1.5">
            <DropdownMenuLabel className="px-2 py-1 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
              Período
            </DropdownMenuLabel>
            <div className="grid grid-cols-4 gap-1 px-2 pb-1">
              {PERIOD_OPTIONS.map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => selectPeriod(days)}
                  aria-pressed={period === days}
                  className={`h-8 rounded-lg text-xs font-medium transition-[background-color,color] duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] ${
                    period === days
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/40 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {days}
                </button>
              ))}
            </div>
            <DropdownMenuSeparator className="my-1" />
            {canImport ? (
              <DropdownMenuItem onClick={() => setImportOpen(true)} className="gap-2.5 px-2.5 py-2">
                <FileText className="size-4 text-muted-foreground" />
                Importar leads
              </DropdownMenuItem>
            ) : null}
            {urgentLead ? (
              <DropdownMenuItem render={<Link href={`/leads/${urgentLead.id}`} />} className="gap-2.5 px-2.5 py-2">
                <Lightning className="size-4 text-amber-500" />
                Próximo lead
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Instâncias únicas dos diálogos, controladas por estado local */}
      <BulkLeadImportDialog
        branches={branches}
        queues={queues}
        role={role}
        jobTitle={jobTitle}
        branchId={branchId}
        open={importOpen}
        onOpenChange={setImportOpen}
      />
      <ManualLeadSheet plans={plans} open={leadSheetOpen} onOpenChange={setLeadSheetOpen} />
    </>
  );
}
