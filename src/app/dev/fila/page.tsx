"use client";

import "@/components/arc/venancor-scope.css";

import { notFound } from "next/navigation";
import { Suspense } from "react";

import { LightLeadsList, type LightLeadItem } from "@/features/broker-workspace/components/light-leads-list";

/** Dev-only: the broker's Fila (Lite) grouped by the day and time the leads arrived. */
const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000);
const LEADS: LightLeadItem[] = [
  { id: "1", name: "Carla Mendes", phone: null, status: "distributed", isAwaitingAcceptance: true, createdAt: hoursAgo(0.2), arrivedAt: hoursAgo(0.1) },
  { id: "2", name: "Paulo Henrique", phone: "21999990000", status: "in_service", productName: "Amil PME", city: "Nova Iguaçu", createdAt: hoursAgo(3), arrivedAt: hoursAgo(2.5) },
  { id: "3", name: "Júlia Prado", phone: "21999990001", status: "quote_sent", createdAt: hoursAgo(5), arrivedAt: hoursAgo(4) },
  { id: "4", name: "Marcos Vinícius", phone: "21999990002", status: "in_service", isAwaitingResponse: true, createdAt: hoursAgo(26), arrivedAt: hoursAgo(25) },
  { id: "5", name: "Ana Beatriz", phone: "21999990003", status: "negotiation", createdAt: hoursAgo(30), arrivedAt: hoursAgo(29) },
  { id: "6", name: "Roberto Lima", phone: "21999990004", status: "in_service", productName: "SulAmérica", createdAt: hoursAgo(75), arrivedAt: hoursAgo(74) },
];

export default function FilaShowcasePage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <main className="arc-venancor min-h-dvh bg-[var(--surface-muted)] py-4">
      <Suspense fallback={null}>
        <LightLeadsList leads={LEADS} availabilityStatus="available" initialFilter="active" />
      </Suspense>
    </main>
  );
}
