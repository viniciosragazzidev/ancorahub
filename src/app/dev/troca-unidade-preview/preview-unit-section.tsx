"use client";

import { LightUnitSection } from "@/app/(dashboard)/settings/_components/light-unit-section";
import type { OwnUnitChangeOptions } from "@/features/broker-unit-change/queries";

/** Dev preview only: the real section with a simulated action (no database). */
export function PreviewUnitSection({ data, failWith }: { data: OwnUnitChangeOptions; failWith?: string }) {
  const changeAction = async (branchId: string) => {
    await new Promise((resolve) => setTimeout(resolve, 700));
    if (failWith) return { ok: false as const, error: failWith };
    const branch = data.options.find((option) => option.id === branchId);
    return { ok: true as const, branchName: branch?.name ?? "", changed: true, releasedAssignments: data.openDutySlots };
  };
  return <LightUnitSection {...data} changeAction={changeAction} />;
}
