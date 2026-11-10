import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CopySaleDetailsButton } from "./sale-details-copy-button";
import { getSaleDetailsCard, type SaleDetailsCardField, type SaleDetailsCardPayload } from "@/features/leads/sale-details-query";

function FieldList({ fields }: { fields: SaleDetailsCardField[] }) {
  return <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
    {fields.map((field) => (
      <div key={field.key} className="min-w-0">
        <dt className="text-xs text-muted-foreground">{field.label}</dt>
        <dd className="mt-1 break-words text-sm font-medium text-foreground">{field.value}</dd>
        {field.source ? <dd className="mt-0.5 text-[11px] text-muted-foreground">Fonte: {field.source}</dd> : null}
      </div>
    ))}
  </dl>;
}

function SaleDetailsCardContent({ data }: { data: SaleDetailsCardPayload }) {
  return <>
    <CardHeader className="gap-3 pb-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <CardTitle className="text-base">Dados da venda</CardTitle>
        <CardDescription>Resumo consolidado do cadastro, propostas, venda registrada e conversa.</CardDescription>
      </div>
      <CopySaleDetailsButton text={data.copyText} />
    </CardHeader>
    <CardContent className="space-y-6">
      <section aria-label="Dados do cliente e da proposta" className="space-y-3">
        <h3 className="text-sm font-semibold">Cliente e proposta</h3>
        <FieldList fields={data.fields} />
      </section>

      <section aria-label="Datas principais" className="space-y-3 border-t border-border/60 pt-5">
        <h3 className="text-sm font-semibold">Datas principais</h3>
        <FieldList fields={data.milestones} />
      </section>

      {data.evidence.length ? (
        <section aria-label="Evidências da conversa" className="space-y-3 border-t border-border/60 pt-5">
          <h3 className="text-sm font-semibold">Evidências da conversa</h3>
          <ul className="grid gap-3">
            {data.evidence.map((item) => (
              <li key={item.id} className="rounded-lg border border-border/60 bg-muted/20 p-3">
                <p className="text-xs font-medium text-muted-foreground">{item.fieldLabel}{item.sender ? ` · ${item.sender}` : ""}</p>
                <blockquote className="mt-1 break-words text-sm text-foreground">“{item.quote}”</blockquote>
                {item.at ? <time className="mt-1 block text-xs text-muted-foreground" dateTime={item.at}>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(item.at))}</time> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.attachments.length ? (
        <section aria-label="Documentos e arquivos" className="space-y-3 border-t border-border/60 pt-5">
          <h3 className="text-sm font-semibold">Documentos e arquivos</h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {data.attachments.map((attachment) => (
              <li key={attachment.id} className="min-w-0 rounded-lg border border-border/60 p-3">
                <a className="block truncate text-sm font-medium text-primary underline-offset-4 hover:underline" href={attachment.href} target="_blank" rel="noreferrer">{attachment.filename}</a>
                <p className="mt-1 text-xs text-muted-foreground">{attachment.source} · {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(attachment.at))}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </CardContent>
  </>;
}

export async function SaleDetailsCard({ leadId }: { leadId: string }) {
  const data = await getSaleDetailsCard(leadId);
  if (!data) return null;
  return <Card className="border-border/60 bg-card/80 shadow-none dark:border-border dark:bg-card">
    <SaleDetailsCardContent data={data} />
  </Card>;
}
