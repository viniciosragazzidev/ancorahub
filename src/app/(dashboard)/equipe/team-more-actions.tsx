"use client";

import Link from "next/link";
import { ChevronDown, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

/** Ações secundárias de /equipe num "Mais ▾" (anatomia de página: um CTA primário por tela). */
export function TeamMoreActions({ showRoles }: { showRoles: boolean }) {
  if (!showRoles) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button size="sm" variant="outline" aria-label="Mais ações" />}>
        Mais
        <ChevronDown className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem render={<Link href="/equipe/cargos" />}>
          <ShieldCheck className="size-4" />
          Cargos e permissões
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
