"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function TeamInviteForm({
  action,
  branches,
  canInviteManager,
}: {
  action: (formData: FormData) => void | Promise<void>;
  branches: { id: string; name: string }[];
  canInviteManager: boolean;
}) {
  const [role, setRole] = useState(canInviteManager ? "manager" : "broker");
  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="team-name">Nome</Label>
        <Input id="team-name" name="name" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="team-email">E-mail</Label>
        <Input id="team-email" name="email" required type="email" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="team-phone">Telefone</Label>
        <Input id="team-phone" name="phone" placeholder="(21) 99999-9999" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="team-cpf">CPF <span className="text-muted-foreground">(opcional)</span></Label>
        <Input id="team-cpf" name="cpf" placeholder="000.000.000-00" />
      </div>
      <input name="role" type="hidden" value={role} />
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Papel a convidar</legend>
        <div className="grid grid-cols-2 gap-2">
          {canInviteManager ? (
            <button
              aria-pressed={role === "manager"}
              className="rounded-lg border border-border bg-muted/30 p-3 text-left aria-pressed:border-primary aria-pressed:bg-primary/10"
              onClick={() => setRole("manager")}
              type="button"
            >
              <span className="block text-sm font-medium">Gestor</span>
              <span className="text-xs text-muted-foreground">Acompanha a operação.</span>
            </button>
          ) : null}
          <button
            aria-pressed={role === "broker"}
            className="rounded-lg border border-border bg-muted/30 p-3 text-left aria-pressed:border-primary aria-pressed:bg-primary/10"
            onClick={() => setRole("broker")}
            type="button"
          >
            <span className="block text-sm font-medium">Corretor</span>
            <span className="text-xs text-muted-foreground">Opera a própria carteira.</span>
          </button>
        </div>
      </fieldset>
      <div className="space-y-2">
        <Label htmlFor="team-branch">Filial</Label>
        <select
          className="flex h-8 w-full rounded-lg border border-input bg-input/30 px-2.5 text-sm"
          id="team-branch"
          name="branchId"
          required
        >
          {branches.filter(Boolean).map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
      </div>
      <Button className="w-full" type="submit">
        Enviar convite
      </Button>
    </form>
  );
}
