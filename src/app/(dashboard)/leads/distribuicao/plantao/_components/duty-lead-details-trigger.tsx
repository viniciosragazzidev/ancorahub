"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LeadDetailsDrawer, type LeadDrawerCommitResult } from "@/features/leads/components/lead-details-drawer";
import type { LeadWorkspaceItem } from "@/features/leads/components/lead-workspace-types";

type Broker = { id: string; name: string; branchId: string | null };
type Branch = { id: string; name: string };

export function DutyLeadDetailsTrigger({
  lead,
  contextRole,
  contextJobTitle,
  contextBranchId,
  brokers,
  branches,
  manualAssignmentChoiceEnabled,
  slaFirstContactMinutes,
  slaStagnantDays,
}: {
  lead: LeadWorkspaceItem;
  contextRole: string;
  contextJobTitle: string | null;
  contextBranchId: string | null;
  brokers: Broker[];
  branches: Branch[];
  manualAssignmentChoiceEnabled: boolean;
  slaFirstContactMinutes: number;
  slaStagnantDays: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [currentLead, setCurrentLead] = useState(lead);
  const [snapshot, setSnapshot] = useState<LeadWorkspaceItem | null>(null);

  function handleManagementCommitted(result: LeadDrawerCommitResult) {
    setOpen(false);
    router.refresh();
    if (result.entity) setCurrentLead((current) => ({
      ...current,
      ...(result.entity?.branchId === undefined ? {} : { branchId: result.entity.branchId }),
      ...(result.entity?.corretorId === undefined ? {} : { corretorId: result.entity.corretorId }),
      ...(result.entity?.status === undefined ? {} : { status: result.entity.status }),
      ...(result.entity?.distributionStatus === undefined ? {} : { distributionStatus: result.entity.distributionStatus }),
    }));
  }

  return (
    <>
      <button
        type="button"
        className="-mx-2 block max-w-full truncate rounded px-2 text-left font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => setOpen(true)}
        aria-label={`Abrir detalhes de ${currentLead.nome}`}
      >
        {currentLead.nome}
      </button>
      {open ? (
        <LeadDetailsDrawer
          lead={currentLead}
          contextRole={contextRole}
          contextJobTitle={contextJobTitle}
          contextBranchId={contextBranchId}
          brokers={brokers}
          branches={branches}
          manualAssignmentChoiceEnabled={manualAssignmentChoiceEnabled}
          slaFirstContactMinutes={slaFirstContactMinutes}
          slaStagnantDays={slaStagnantDays}
          onOpenChange={setOpen}
          onManagementCommitted={handleManagementCommitted}
          onReassignOptimistic={(brokerId) => {
            setSnapshot(currentLead);
            const broker = brokers.find((item) => item.id === brokerId);
            setCurrentLead((current) => ({ ...current, corretorId: brokerId, corretorNome: broker?.name ?? current.corretorNome, status: "distributed", distributionStatus: "assigned", assignedAt: new Date().toISOString() }));
          }}
          onReassignRollback={() => {
            if (snapshot) setCurrentLead(snapshot);
            setSnapshot(null);
          }}
          onLeadPatch={(patch) => setCurrentLead((current) => ({ ...current, ...patch }))}
        />
      ) : null}
    </>
  );
}
