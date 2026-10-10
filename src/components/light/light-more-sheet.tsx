"use client";

import Link from "next/link";

import { startLiteTour } from "@/components/chat/tour/lite-tour";
import { ChevronRight, LogOut } from "lucide-react";

import { Avatar } from "@/components/arc/avatar/avatar";
import { BottomSheet } from "@/components/arc/bottom-sheet/bottom-sheet";
import { Button } from "@/components/arc/button/button";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import type { LightAvailability } from "@/components/light-top-nav";
import { signOut } from "@/shared/auth/client";

import { getLightMoreDestinations } from "./light-routes";

/**
 * "Mais" bottom sheet: profile, secondary destinations, availability and sign
 * out. Opened from the bottom bar, the rail and the internal header.
 */
export function LightMoreSheet({
  open,
  onOpenChange,
  user,
  showQuoteSimulator,
  showDutyCalendar,
  availability,
  availabilityPending,
  onChangeAvailability,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: { name: string | null; email: string | null };
  showQuoteSimulator: boolean;
  showDutyCalendar: boolean;
  availability: LightAvailability;
  availabilityPending: boolean;
  onChangeAvailability: (next: "available" | "paused") => void;
}) {
  const destinations = getLightMoreDestinations({ quoteSimulator: showQuoteSimulator, dutyCalendar: showDutyCalendar });

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Mais"
      detents={[0.62, 0.92]}
      closeLabel="Fechar"
      className="arc-venancor"
    >
      <div className="flex flex-col gap-5 pb-2">
        <div className="flex items-center gap-3">
          <Avatar name={user?.name || "Corretor"} size="lg" className="light-avatar" />
          <div className="min-w-0">
            <p className="truncate text-base font-medium text-(--foreground)">{user?.name || "Corretor"}</p>
            <p className="truncate text-sm text-(--text-secondary)">{user?.email || ""}</p>
          </div>
        </div>

        <nav aria-label="Mais destinos">
          <ul className="overflow-hidden rounded-3xl bg-(--surface-muted)">
            {destinations.map((item) => (
              <li key={item.href} className="border-b border-(--border) last:border-b-0">
                <Link
                  href={item.href}
                  onClick={() => onOpenChange(false)}
                  className="flex min-h-14 items-center justify-between gap-3 px-4 text-sm font-medium text-(--foreground) active:bg-(--surface)"
                >
                  <span>{item.label}</span>
                  <ChevronRight className="size-4 text-(--text-muted)" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <button
          type="button"
          onClick={() => {
            onOpenChange(false);
            // The tour runs on the Início; from another screen, go there and start it.
            if (window.location.pathname === "/dashboard") window.setTimeout(startLiteTour, 280);
            else window.location.assign("/dashboard?tour=1");
          }}
          className="flex min-h-14 items-center justify-between gap-3 rounded-3xl bg-(--surface-muted) px-4 text-left text-sm font-medium text-(--foreground) active:bg-(--surface)"
        >
          <span>
            Ver o tour do app
            <span className="block text-xs font-normal text-(--text-muted)">uns 3 minutos, passo a passo</span>
          </span>
          <ChevronRight className="size-4 text-(--text-muted)" aria-hidden="true" />
        </button>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-(--foreground)">Disponibilidade</p>
          <div aria-busy={availabilityPending}>
            <SegmentedControl
              label="Disponibilidade para receber leads"
              options={[
                { value: "available", label: "Disponível" },
                { value: "paused", label: "Pausado" },
              ]}
              value={availability === "available" ? "available" : "paused"}
              onValueChange={(value) => onChangeAvailability(value === "available" ? "available" : "paused")}
            />
          </div>
          <p className="text-xs text-(--text-secondary)">
            {availability === "available"
              ? "Você recebe novos leads normalmente."
              : "Pausado: você não recebe novos leads até voltar a ficar disponível."}
          </p>
        </div>

        <Button
          variant="secondary"
          size="lg"
          onClick={() => {
            onOpenChange(false);
            void signOut();
          }}
        >
          <LogOut className="size-4" aria-hidden="true" />
          Sair da conta
        </Button>
      </div>
    </BottomSheet>
  );
}
