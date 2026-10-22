import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { SimpleLeadQualityReportData } from "../metrics/lead-quality-service";

const n = (value: number) => value.toLocaleString("pt-BR");
const pct = (part: number, total: number) => (total ? `${Math.round((part / total) * 100)}%` : "0%");

function Stat({ label, value, detail, tone }: { label: string; value: string; detail?: string; tone?: "good" | "weak" }) {
  const color = tone === "good" ? "text-emerald-700 dark:text-emerald-300" : tone === "weak" ? "text-sky-700 dark:text-sky-300" : "text-foreground";
  return (
    <div className="rounded-xl border border-border/70 bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-3xl font-semibold tabular-nums ${color}`}>{value}</p>
      {detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}
    </div>
  );
}

/**
 * The simple quality report: four plain answers for the owner. How many leads
 * arrived and how many were good; by queue; hour by hour, when the good ones
 * ran out; and what would happen without sending cold leads.
 */
export function LeadQualitySimple({ report, queueName }: { report: SimpleLeadQualityReportData; queueName: string | null }) {
  const arrivedWeak = report.arrived.cold + report.arrived.noReply;
  const sentWeak = report.distributed.cold + report.distributed.noReply;
  const runOuts = report.byQueue.filter((queue) => queue.goodRanOut);
  const inversions = report.byQueue.filter((queue) => queue.weakWhileGoodWaiting > 0);

  if (!report.arrived.total) {
    return <Card className="items-center gap-2 border-dashed px-6 py-14 text-center"><CardTitle>Nenhum lead neste período</CardTitle><CardDescription>Escolha outro período ou outra fila.</CardDescription></Card>;
  }

  return (
    <div className="flex flex-col gap-5">
      {report.truncated ? <p className="rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">Período muito longo: o relatório usa só os leads mais recentes. Escolha um intervalo menor para ver tudo.</p> : null}
      <section aria-labelledby="q1" className="space-y-3">
        <h2 id="q1" className="text-lg font-semibold">1. Quantos leads entraram e quantos são bons</h2>
        <p className="text-sm text-muted-foreground">Bom = quente ou morno validado. Lead de WhatsApp só conta como bom se o cliente respondeu a qualificação.</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Entraram" value={n(report.arrived.total)} detail={queueName ? `Entraram pela fila ${queueName}` : "Todas as filas"} />
          <Stat label="Bons (quentes + mornos)" value={n(report.arrived.good)} detail={`${pct(report.arrived.good, report.arrived.total)} do que entrou`} tone="good" />
          <Stat label="Frios" value={n(arrivedWeak)} detail={`${n(report.arrived.cold)} frios + ${n(report.arrived.noReply)} de WhatsApp que não responderam · ${pct(arrivedWeak, report.arrived.total)}`} tone="weak" />
          <Stat label="Descartados ou em qualificação" value={n(report.arrived.other)} detail={pct(report.arrived.other, report.arrived.total)} />
        </div>
      </section>

      <section aria-labelledby="q2" className="space-y-3">
        <h2 id="q2" className="text-lg font-semibold">2. Por fila</h2>
        <Card className="shadow-none">
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fila de entrada</TableHead>
                  <TableHead>Reter frios</TableHead>
                  <TableHead className="text-right">Entraram</TableHead>
                  <TableHead className="text-right">Bons</TableHead>
                  <TableHead className="text-right">Frios</TableHead>
                  <TableHead className="text-right">Distribuídos</TableHead>
                  <TableHead className="text-right">Frios distribuídos</TableHead>
                  <TableHead className="text-right">Bons acabaram</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.byQueue.map((queue) => (
                  <TableRow key={queue.queue}>
                    <TableCell className="font-medium">{queue.queue}</TableCell>
                    <TableCell>{queue.holdColdLeads ? "Ligada" : "Desligada"}</TableCell>
                    <TableCell className="text-right tabular-nums">{n(queue.arrived)}</TableCell>
                    <TableCell className="text-right tabular-nums">{n(queue.good)} <span className="text-muted-foreground">({pct(queue.good, queue.arrived)})</span></TableCell>
                    <TableCell className="text-right tabular-nums">{n(queue.weak)}</TableCell>
                    <TableCell className="text-right tabular-nums">{n(queue.distributed)}</TableCell>
                    <TableCell className="text-right tabular-nums">{n(queue.distributedWeak)}</TableCell>
                    <TableCell className="text-right">{report.hourly === "timeline" ? queue.goodRanOut ?? "Não acabaram" : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="q3" className="space-y-3">
        <h2 id="q3" className="text-lg font-semibold">3. Hora a hora: quando os bons acabaram</h2>
        <p className="text-sm text-muted-foreground">
          {report.hourly === "timeline"
            ? runOuts.length
              ? `${runOuts.map((queue) => `${queue.queue}: os bons acabaram às ${queue.goodRanOut}`).join(" · ")}. Dali em diante só havia frios para entregar.`
              : "Em nenhuma hora os bons acabaram: sempre havia lead bom qualificado esperando."
            : "Período longo: cada linha soma a mesma hora de todos os dias (a hora em que os bons acabam aparece escolhendo um dia só)."}
          {queueName ? null : " Os bons de uma fila não atendem outra: escolha uma fila para ver só ela."}
        </p>
        <Card className="shadow-none">
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hora</TableHead>
                  <TableHead className="text-right">Entraram bons</TableHead>
                  <TableHead className="text-right">Entraram frios</TableHead>
                  <TableHead className="text-right">Foram bons</TableHead>
                  <TableHead className="text-right">Foram frios</TableHead>
                  {report.hourly === "timeline" ? <TableHead className="text-right">Bons esperando</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.hours.map((hour) => {
                  const ranOutHere = hour.goodWaiting === 0 && hour.distributed.cold + hour.distributed.noReply > 0;
                  return (
                    <TableRow key={hour.startsAt} className={ranOutHere ? "bg-amber-50 dark:bg-amber-950/30" : undefined}>
                      <TableCell className="font-medium tabular-nums">{hour.label}</TableCell>
                      <TableCell className="text-right tabular-nums">{n(hour.arrived.good)}</TableCell>
                      <TableCell className="text-right tabular-nums">{n(hour.arrived.cold + hour.arrived.noReply)}</TableCell>
                      <TableCell className="text-right tabular-nums">{n(hour.distributed.good)}</TableCell>
                      <TableCell className="text-right tabular-nums">{n(hour.distributed.cold + hour.distributed.noReply)}</TableCell>
                      {report.hourly === "timeline" ? <TableCell className="text-right tabular-nums">{hour.goodWaiting === 0 ? "0 · acabaram" : n(hour.goodWaiting ?? 0)}</TableCell> : null}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        {inversions.length ? (
          <p className="rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            Atenção: {inversions.map((queue) => `${queue.queue} mandou ${n(queue.weakWhileGoodWaiting)} frios com lead bom qualificado esperando na mesma fila`).join(" · ")}. Aqui não faltou lead bom: vale revisar a distribuição.
          </p>
        ) : null}
      </section>

      <section aria-labelledby="q4" className="space-y-3">
        <h2 id="q4" className="text-lg font-semibold">4. E se não mandasse os frios? (estimativa)</h2>
        <p className="text-sm text-muted-foreground">Estimativa: tira os frios do que foi entregue e supõe que os bons seriam entregues igual.</p>
        <div className="grid gap-3 md:grid-cols-3">
          <Stat label="Foram para os corretores" value={n(report.distributed.total)} detail={`${n(report.distributed.good)} bons + ${n(sentWeak)} frios · ${n(report.brokers)} corretores`} />
          <Stat label="Sem os frios seriam (estimativa)" value={n(report.withoutWeak.distributed)} detail={`${n(report.withoutWeak.removed)} leads a menos (${report.withoutWeak.removedShare.toLocaleString("pt-BR")}%)`} tone="weak" />
          <Stat label="Média por corretor" value={`${report.withoutWeak.perBrokerNow?.toLocaleString("pt-BR") ?? "—"} → ${report.withoutWeak.perBrokerWithout?.toLocaleString("pt-BR") ?? "—"}`} detail="Hoje → sem os frios" />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {report.shifts.map((shift) => {
            const total = shift.distributedGood + shift.distributedWeak;
            return (
              <Card key={shift.key} className="shadow-none">
                <CardHeader className="pb-2"><CardTitle className="text-sm">{shift.label}</CardTitle></CardHeader>
                <CardContent className="text-sm">
                  <p>Receberam <strong className="tabular-nums">{n(total)}</strong> leads: {n(shift.distributedGood)} bons e {n(shift.distributedWeak)} frios ({n(shift.brokers)} corretores).</p>
                  <p className="mt-1 text-muted-foreground">Sem os frios: <strong className="text-foreground tabular-nums">{n(shift.distributedGood)}</strong> leads{shift.brokers ? `, ${(shift.distributedGood / shift.brokers).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} por corretor` : ""}.</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">Vendas vindas de leads frios no período: {n(report.converted.weak)} · de leads bons: {n(report.converted.good)}.</p>
      </section>
    </div>
  );
}
