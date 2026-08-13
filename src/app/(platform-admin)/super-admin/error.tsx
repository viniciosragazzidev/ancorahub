"use client";

import { RouteError } from "@/components/route-error";

export default function SuperAdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteError
      error={error}
      reset={reset}
      title="Não foi possível carregar o Painel Super-Admin"
      description="Ocorreu um erro inesperado nesta visualização do Super-Admin. Você pode tentar novamente ou retornar ao dashboard."
    />
  );
}
