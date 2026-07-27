"use client"

import { useSyncExternalStore } from "react"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { ShimmerSkeleton } from "@/components/unlumen-ui/shimmer-skeleton"

type FunnelDatum = { stage: string; volume: number }

export function FunnelChart({ data }: { data: FunnelDatum[] }) {
  const isHydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false
  )

  if (!isHydrated) return <ShimmerSkeleton className="h-72" rounded="lg" />

  return (
    <ResponsiveContainer height="100%" minHeight={288} minWidth={0} width="100%">
      <BarChart data={data} margin={{ top: 4, right: 2, left: -20, bottom: 0 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
        <XAxis axisLine={false} dataKey="stage" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} tickLine={false} />
        <YAxis axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} tickLine={false} />
        <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} cursor={{ fill: "var(--muted)" }} />
        <Bar barSize={28} dataKey="volume" fill="var(--primary)" radius={[5, 5, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
