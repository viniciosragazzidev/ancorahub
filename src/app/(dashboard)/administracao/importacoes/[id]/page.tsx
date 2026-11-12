import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard-header";
import { Button } from "@/components/ui/button";
import { getErpImport } from "@/features/erp/imports";
import { ImportReview } from "@/features/erp/components/import-workspace";
import page from "@/components/lite/page/lite-page.module.css";
export default async function ImportDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const batch = await getErpImport(id);
  return <><DashboardHeader breadcrumb="Importações" title="Conferir lote" /><main className={page.stack}><div className={page.toolbar}><p className="text-sm">{batch.fileName}</p><Button variant="outline" render={<Link href="/administracao/importacoes" />}>Voltar aos lotes</Button></div><ImportReview batch={batch} /></main></>;
}
