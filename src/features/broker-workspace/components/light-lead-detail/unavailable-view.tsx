"use client";

import Link from "next/link";
import { UserCheck } from "@/components/huge-icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LightAvailabilityBanner } from "@/features/broker-workspace/components/light-availability-banner";

export function UnavailableLeadView({ availabilityStatus }: { availabilityStatus: "available" | "paused" | "offline" }) {
  return (
      <div className="min-h-full bg-background text-foreground flex flex-col">
        <LightAvailabilityBanner initialStatus={availabilityStatus} />
        <div className="mx-auto w-full max-w-lg space-y-4 px-4 py-12 text-center flex-1">
          <Card variant="subtle" className="p-8 bg-card/95 border-dashed space-y-4">
            <div className="mx-auto grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
              <UserCheck className="size-6" />
            </div>
            <div className="space-y-1">
              <h1 className="text-lg font-bold text-foreground">
                Este atendimento foi redistribuído
              </h1>
              <p className="text-xs text-muted-foreground">
                Outro corretor assumiu este lead ou ele já foi concluído.
              </p>
            </div>
            <div className="pt-2">
              <Button size="sm" render={<Link href="/minha-fila" />} className="w-full font-bold">
                ← Voltar para meus leads
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
}
