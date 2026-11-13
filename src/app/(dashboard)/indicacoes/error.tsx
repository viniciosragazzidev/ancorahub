"use client";
import { RouteError } from "@/components/route-error";

export default function ReferralsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError
    error={error}
    reset={reset}
    title="Indicações indisponíveis"
    description="Confira com o administrador se o módulo está liberado para seu perfil. Se estava funcionando, tente novamente."
  />;
}
