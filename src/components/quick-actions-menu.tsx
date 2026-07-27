"use client";

import Link from "next/link";

import { Calculator, ChatCircleText, ListChecks, Plus, Users } from "@/components/huge-icons";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function QuickActionsMenu() {
  return <DropdownMenu><DropdownMenuTrigger render={<Button aria-label="Ações rápidas" className="rounded-full shadow-sm" size="icon" title="Ações rápidas"><Plus /></Button>} /><DropdownMenuContent align="start" className="w-52 p-1.5" side="right" sideOffset={10}><DropdownMenuItem render={<Link href="/leads?new=1" />}><Users /> Criar lead</DropdownMenuItem><DropdownMenuItem render={<Link href="/tarefas" />}><ListChecks /> Criar tarefa</DropdownMenuItem><DropdownMenuItem render={<Link href="/leads?new=1#cotacao" />}><Calculator /> Nova cotação</DropdownMenuItem><DropdownMenuItem render={<Link href="/conversas" />}><ChatCircleText /> Enviar mensagem</DropdownMenuItem></DropdownMenuContent></DropdownMenu>;
}
