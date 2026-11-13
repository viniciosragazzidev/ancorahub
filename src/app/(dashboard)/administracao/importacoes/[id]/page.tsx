import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getErpImport } from "@/features/erp/imports";
import { ImportReview } from "@/features/erp/components/import-workspace";
import { ErpPage } from "@/features/erp/ui/erp-page";

export default async function ImportDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const batch = await getErpImport(id);
  return <ErpPage pathname="/administracao/importacoes" breadcrumb="Importações" title={batch.fileName}
    actions={<Button variant="outline" render={<Link href="/administracao/importacoes" />}>Voltar aos lotes</Button>}>
    <ImportReview batch={batch} />
  </ErpPage>;
}
