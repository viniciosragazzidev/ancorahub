"use client";

import { RouteError } from "@/components/route-error";

export default function AiAreaError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <RouteError
      error={error}
      reset={reset}
      title="Não deu para abrir o Atendimento IA"
      description="A IA continua atendendo os leads. Tente de novo em instantes."
    />
  );
}
