"use client";

import { useActionState, type ReactNode } from "react";

import type { TenantCreateActionState } from "../types";

type TenantCreateAction = (
  state: TenantCreateActionState,
  formData: FormData,
) => Promise<TenantCreateActionState>;

export function CreateTenantForm({
  action,
  children,
}: {
  action: TenantCreateAction;
  children: ReactNode;
}) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} className="space-y-4">
      {children}
      {state.error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
          {state.error} Confira o CNPJ e tente novamente.
        </p>
      ) : null}
    </form>
  );
}
