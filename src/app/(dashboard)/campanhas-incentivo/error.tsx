"use client";
import { RouteError } from "@/components/route-error";

export default function IncentiveCampaignsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError
    error={error}
    reset={reset}
    title="Campanhas indisponíveis"
    description="Confira com o administrador se o módulo de incentivos está liberado para seu perfil. Se estava funcionando, tente novamente."
  />;
}
