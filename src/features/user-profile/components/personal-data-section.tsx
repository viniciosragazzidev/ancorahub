"use client";

import { useActionState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { updateDisplayNameAction, type ProfileActionState } from "../actions";
import type { PerfilData } from "./perfil-tabs";

export function PersonalDataSection({ data }: { data: PerfilData }) {
  const [state, formAction, isPending] = useActionState<ProfileActionState, FormData>(
    async (prev, formData) => {
      const result = await updateDisplayNameAction(prev, formData);
      if (result.success) toast.success("Nome atualizado com sucesso.");
      else toast.error(result.error ?? "Não foi possível salvar o nome.");
      return result;
    },
    {},
  );

  const broker = data.brokerProfile;

  return (
    <Card className="border-border bg-card shadow-none">
      <CardHeader>
        <CardTitle>Dados pessoais</CardTitle>
        <CardDescription>As informações exibidas para seus colegas e para a equipe de atendimento.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <form action={formAction} className="grid gap-4 sm:grid-cols-2">
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="name">Nome completo</FieldLabel>
            <Input
              id="name"
              name="name"
              defaultValue={data.user?.name ?? ""}
              maxLength={80}
              disabled={isPending}
              aria-describedby={state.error ? "name-error" : undefined}
            />
            {state.error ? <FieldError id="name-error">{state.error}</FieldError> : null}
            <FieldDescription>Este nome aparece no cabeçalho e nas listas da equipe.</FieldDescription>
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando..." : "Salvar nome"}
            </Button>
          </div>
        </form>

        <dl className="grid gap-4 border-t border-border/60 pt-5 sm:grid-cols-2">
          <div className="rounded-lg border border-border p-4">
            <dt className="text-xs text-muted-foreground">Nome profissional</dt>
            <dd className="mt-1 text-sm font-medium">{broker?.professionalName ?? "—"}</dd>
            <dd className="mt-0.5 text-xs text-muted-foreground">Exibido quando aplicável (ex.: credenciamento).</dd>
          </div>
          <div className="rounded-lg border border-border p-4">
            <dt className="text-xs text-muted-foreground">Telefone</dt>
            <dd className="mt-1 text-sm font-medium">{broker?.phone ?? "—"}</dd>
          </div>
          <div className="rounded-lg border border-border p-4">
            <dt className="text-xs text-muted-foreground">CPF</dt>
            <dd className="mt-1 font-mono text-sm font-medium">{broker?.cpf ?? "—"}</dd>
          </div>
          <div className="rounded-lg border border-border p-4">
            <dt className="text-xs text-muted-foreground">Código interno</dt>
            <dd className="mt-1 font-mono text-sm font-medium">{broker?.internalCode ?? "—"}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
