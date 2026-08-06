"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppSelect } from "@/components/ui/select";

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
        <div className="grid grid-cols-3 gap-2">
          {canInviteManager ? (
            <button
              aria-pressed={role === "manager"}
              className="rounded-lg border border-border bg-muted/30 p-2.5 text-left aria-pressed:border-primary aria-pressed:bg-primary/10"
              onClick={() => setRole("manager")}
              type="button"
            >
              <span className="block text-xs font-medium">Gestor</span>
              <span className="text-[10px] text-muted-foreground">Multi-unidade.</span>
            </button>
          ) : null}
          <button
            aria-pressed={role === "supervisor"}
            className="rounded-lg border border-border bg-muted/30 p-2.5 text-left aria-pressed:border-primary aria-pressed:bg-primary/10"
            onClick={() => setRole("supervisor")}
            type="button"
          >
            <span className="block text-xs font-medium">Supervisor</span>
            <span className="text-[10px] text-muted-foreground">Sua unidade.</span>
          </button>
          <button
            aria-pressed={role === "broker"}
            className="rounded-lg border border-border bg-muted/30 p-2.5 text-left aria-pressed:border-primary aria-pressed:bg-primary/10"
            onClick={() => setRole("broker")}
            type="button"
          >
            <span className="block text-xs font-medium">Corretor</span>
            <span className="text-[10px] text-muted-foreground">Carteira própria.</span>
          </button>
        </div>
      </fieldset>
      <div className="space-y-2">
        <Label htmlFor="team-branch">Filial</Label>
        <AppSelect
          id="team-branch"
          name="branchId"
          required
          options={branches.filter(Boolean).map((branch) => ({
            value: branch.id,
            label: branch.name,
          }))}
          defaultValue={branches[0]?.id}
        />
      </div>
      <Button className="w-full" type="submit">
        Enviar convite
      </Button>
    </form>
  );
}
