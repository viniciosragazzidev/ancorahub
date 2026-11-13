import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getErpImports } from "@/features/erp/imports";
import { ImportUpload } from "@/features/erp/components/import-workspace";
import { IMPORT_STATUS } from "@/features/erp/contracts";
import page from "@/components/lite/page/lite-page.module.css";

export default async function ImportsPage() {
  const data = await getErpImports();
  return <><DashboardHeader breadcrumb="Operação" title="Importações" /><main className={page.stack}><p className="text-sm text-muted-foreground">Prepare o arquivo, confira a prévia e solicite a revisão independente. Referências repetidas e alterações concorrentes impedem a aplicação.</p><ImportUpload maxRows={data.maxRows} domains={data.domains} />
    <section className={page.group}><h2 className={page.sectionTitle}>Últimos lotes</h2>{data.rows.length ? <Table><TableHeader><TableRow><TableHead>Arquivo</TableHead><TableHead>Preparado por</TableHead><TableHead>Linhas</TableHead><TableHead>Estado</TableHead><TableHead>Revisão</TableHead></TableRow></TableHeader><TableBody>{data.rows.map((row) => <TableRow key={row.id}><TableCell>{row.fileName}<p className={page.cellSub}>{row.domain === "finance" ? "Financeiro" : "Implantação"}</p></TableCell><TableCell>{row.createdBy}</TableCell><TableCell>{row.rowCount}</TableCell><TableCell>{row.status === "applied" ? IMPORT_STATUS.applied : row.status === "rejected" ? IMPORT_STATUS.rejected : IMPORT_STATUS.preview}</TableCell><TableCell><Button variant="outline" render={<Link href={`/administracao/importacoes/${row.id}`} />}>Conferir lote</Button></TableCell></TableRow>)}</TableBody></Table> : <p className="text-sm text-muted-foreground">Nenhum lote preparado no seu escopo.</p>}</section>
  </main></>;
}
