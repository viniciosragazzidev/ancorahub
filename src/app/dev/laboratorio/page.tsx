import "@/components/arc/venancor-scope.css";

import { notFound } from "next/navigation";

import { FlowLab } from "./lab";

/**
 * Laboratório de fluxos do corretor (15/11/2026), só em desenvolvimento: aceitar plantão, aceitar lead e as
 * conquistas, com as telas reais e o servidor simulado. Sem banco, sem plantão de verdade, sem lead de verdade.
 */
export default function FlowLabPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <FlowLab />;
}
