"use client";

import { RouteError } from "@/components/route-error";

export default function CampaignDetailError({
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
      title="Não foi possível carregar esta campanha"
      description="Ocorreu uma falha ao carregar os anúncios ou os dados da campanha. Tente novamente; se persistir, envie o código de diagnóstico ao suporte."
    />
  );
}
