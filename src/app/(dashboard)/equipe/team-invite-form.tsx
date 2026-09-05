"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppSelect } from "@/components/ui/select";

export function TeamInviteForm({
  action,
  branches,
  canInviteDirector = false,
  canInviteManager,
}: {
  action: (formData: FormData) => void | Promise<void>;
  branches: { id: string; name: string }[];
  canInviteDirector?: boolean;
  canInviteManager: boolean;
}) {
  const [role, setRole] = useState(canInviteDirector ? "director" : canInviteManager ? "manager" : "broker");
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
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {canInviteDirector ? (
            <Button
              aria-pressed={role === "director"}
              className="h-auto flex-col items-start gap-0.5 p-2.5 text-left aria-pressed:border-primary aria-pressed:bg-primary/10"
              onClick={() => setRole("director")}
              type="button"
              variant="outline"
            >
              <span className="block text-xs font-medium">Diretor</span>
              <span className="text-[10px] text-muted-foreground">Acesso global.</span>
            </Button>
          ) : null}
          {canInviteManager ? (
            <Button
              aria-pressed={role === "manager"}
              className="h-auto flex-col items-start gap-0.5 p-2.5 text-left aria-pressed:border-primary aria-pressed:bg-primary/10"
              onClick={() => setRole("manager")}
              type="button"
              variant="outline"
            >
              <span className="block text-xs font-medium">Gestor</span>
              <span className="text-[10px] text-muted-foreground">Multi-unidade.</span>
            </Button>
          ) : null}
          <Button
            aria-pressed={role === "supervisor"}
            className="h-auto flex-col items-start gap-0.5 p-2.5 text-left aria-pressed:border-primary aria-pressed:bg-primary/10"
            onClick={() => setRole("supervisor")}
            type="button"
            variant="outline"
          >
            <span className="block text-xs font-medium">Supervisor</span>
            <span className="text-[10px] text-muted-foreground">Sua unidade.</span>
          </Button>
          <Button
            aria-pressed={role === "broker"}
            className="h-auto flex-col items-start gap-0.5 p-2.5 text-left aria-pressed:border-primary aria-pressed:bg-primary/10"
            onClick={() => setRole("broker")}
            type="button"
            variant="outline"
          >
            <span className="block text-xs font-medium">Corretor</span>
            <span className="text-[10px] text-muted-foreground">Carteira própria.</span>
          </Button>
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
