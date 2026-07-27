"use client";

import { useActionState } from "react";
import { toast } from "sonner";
import { updateTenantBrandingAction } from "../actions";
import { ColorPicker } from "./color-picker";
import { LogoUpload } from "./logo-upload";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { HugeiconsIcon } from "@hugeicons/react";
import { SaveIcon } from "@hugeicons/core-free-icons";
import { Loader2Icon } from "@/components/huge-icons";

type Tenant = {
  name: string;
  legalName: string | null;
  cnpj: string | null;
  logoUrl: string | null;
  brandColor: string | null;
};

export function EmpresaTab({ tenant, canEdit }: { tenant: Tenant; canEdit: boolean }) {
  const [state, formAction, isPending] = useActionState(
    async (prev: { success: boolean; error?: string }, formData: FormData) => {
      const result = await updateTenantBrandingAction(prev, formData);
      if (result.success) {
        toast.success("Identidade visual salva!");
      } else {
        toast.error(result.error ?? "Erro ao salvar.");
      }
      return result;
    },
    { success: false },
  );

  return (
    <form action={formAction} className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Field>
          <FieldLabel>Nome da corretora</FieldLabel>
          <Input defaultValue={tenant.name} disabled />
        </Field>
        <Field>
          <FieldLabel>CNPJ</FieldLabel>
          <Input defaultValue={tenant.cnpj ?? "—"} disabled />
        </Field>
        <Field>
          <FieldLabel>Razão social</FieldLabel>
          <Input defaultValue={tenant.legalName ?? "—"} disabled />
        </Field>
      </div>

      <div className="h-px bg-border" />

      <div className="grid gap-4 md:grid-cols-2">
        <Field>
          <FieldLabel>Logo da corretora</FieldLabel>
          <LogoUpload defaultValue={tenant.logoUrl} name="logoUrl" disabled={!canEdit} />
        </Field>
        <Field>
          <FieldLabel>Cor da marca</FieldLabel>
          <ColorPicker defaultValue={tenant.brandColor} name="brandColor" disabled={!canEdit} />
        </Field>
      </div>

      <div className="flex justify-end">
        {!canEdit ? <p className="mr-auto self-center text-xs text-muted-foreground">A identidade visual pode ser alterada apenas pelo Diretor.</p> : null}
        <Button type="submit" disabled={isPending || !canEdit}>
          {isPending ? (
            <Loader2Icon className="mr-2 size-4 animate-spin" />
          ) : (
            <HugeiconsIcon icon={SaveIcon} className="mr-2" size={16} />
          )}
          Salvar alterações
        </Button>
      </div>

      {state.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}
    </form>
  );
}
