"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useActionState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { CatalogActionState } from "../types";

type CatalogAction = (formData: FormData) => Promise<CatalogActionState>;

export function CatalogActionForm({
  action,
  children,
  submitLabel,
  submittingLabel = "Salvando...",
  className,
  submitVariant = "default",
}: {
  action: CatalogAction;
  children: ReactNode;
  submitLabel: string;
  submittingLabel?: string;
  className?: string;
  submitVariant?: "default" | "outline";
}) {
  const [state, formAction, isPending] = useActionState<CatalogActionState, FormData>(
    action as unknown as (state: CatalogActionState, formData: FormData) => Promise<CatalogActionState>,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.error) {
      toast.error(state.error);
    } else if (state.success) {
      toast.success(state.success);
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className={className}>
      {children}
      <Button disabled={isPending} type="submit" variant={submitVariant}>
        {isPending ? submittingLabel : submitLabel}
      </Button>
    </form>
  );
}
