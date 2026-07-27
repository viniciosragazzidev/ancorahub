"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const roles = [
  { value: "director", title: "Diretor", description: "Administra a corretora e suas equipes." },
  { value: "manager", title: "Gestor", description: "Acompanha a operação da filial." },
  { value: "broker", title: "Corretor", description: "Opera a própria carteira de leads." },
] as const;

export function CreateTenantAccessForm({ action, branches, tenantId }: { action: (formData: FormData) => void | Promise<void>; branches: { id: string; name: string }[]; tenantId: string }) {
  const [role, setRole] = useState<(typeof roles)[number]["value"]>("director");
  return <form action={action} className="space-y-4"><input name="tenantId" type="hidden" value={tenantId} /><input name="role" type="hidden" value={role} /><div className="space-y-2"><Label htmlFor="memberName">Nome</Label><Input id="memberName" name="name" required /></div><div className="space-y-2"><Label htmlFor="memberEmail">E-mail</Label><Input id="memberEmail" name="email" type="email" required /></div><div className="space-y-2"><Label htmlFor="memberPassword">Senha inicial</Label><Input id="memberPassword" name="password" minLength={8} type="password" required /></div><fieldset className="space-y-2"><legend className="text-sm font-medium">Papel</legend><div className="grid gap-2">{roles.map((item) => <button aria-pressed={role === item.value} className="rounded-lg border border-border bg-muted/30 p-3 text-left transition-colors hover:bg-muted aria-pressed:border-primary aria-pressed:bg-primary/10" key={item.value} onClick={() => setRole(item.value)} type="button"><span className="block text-sm font-medium">{item.title}</span><span className="mt-1 block text-xs text-muted-foreground">{item.description}</span></button>)}</div></fieldset><div className="space-y-2"><Label htmlFor="branchId">Filial</Label><select className="flex h-8 w-full rounded-lg border border-input bg-input/30 px-2.5 text-sm" id="branchId" name="branchId" required>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></div><Button className="w-full" type="submit">Adicionar acesso</Button></form>;
}
