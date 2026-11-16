"use client";

import { useRouter } from "next/navigation";

import SegmentedControl from "@/components/arc/segmented-control/segmented-control";

/**
 * Leads da equipe x Lista importada (16/11/2026): o supervisor vê separado o que é lead dos corretores e o que
 * veio da lista interna que ele importou. Cada vista na sua URL.
 */
export function TeamListSwitch({ value, pending }: { value: "equipe" | "lista"; pending: number }) {
  const router = useRouter();
  return (
    <SegmentedControl
      label="Leads da equipe ou lista importada"
      value={value}
      options={[
        { value: "equipe", label: "Leads da equipe" },
        { value: "lista", label: pending ? `Lista importada (${pending.toLocaleString("pt-BR")})` : "Lista importada" },
      ]}
      onValueChange={(next) => {
        if (next !== value) router.push(next === "lista" ? "/leads?vista=lista" : "/leads");
      }}
    />
  );
}
