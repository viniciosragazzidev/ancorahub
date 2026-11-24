import "@/components/arc/venancor-scope.css";

import { notFound } from "next/navigation";

import { ManagerPreview, type Case, type Screen } from "./manager-preview";

/** Dev-only: modo gestor com dados de exemplo (sem banco). /dev/gestor-preview?caso=matriz|niteroi|sem-unidade&tela=painel|pos-venda */
export default async function ManagerPreviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const params = await searchParams;
  const caseId: Case = params.caso === "niteroi" || params.caso === "sem-unidade" ? params.caso : "matriz";
  const screen: Screen = params.tela === "pos-venda" ? "pos-venda" : "painel";
  return <ManagerPreview caseId={caseId} screen={screen} />;
}
