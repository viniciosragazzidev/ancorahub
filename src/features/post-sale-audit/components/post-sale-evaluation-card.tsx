import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { PostSaleBrokerReportRow } from "../reporting";

function percent(value: number | null) {
  return value === null ? "Sem respostas" : `${value}%`;
}

export function PostSaleEvaluationCard({ report, periodDays = 30 }: { report: PostSaleBrokerReportRow; periodDays?: number }) {
  const facts = [
    { label: "Pesquisas enviadas", value: report.sent, detail: `${report.responded} respondidas` },
    { label: "Atendimento", value: percent(report.attendancePercent), detail: `${report.attended} de ${report.attendanceAnswered} respostas` },
    { label: "Nota média", value: report.averageRating === null ? "Sem notas" : `${report.averageRating}/5`, detail: "Notas recebidas" },
    { label: "Fechou", value: percent(report.closePercent), detail: `${report.closed} de ${report.closeAnswered} respostas` },
    { label: "Sem contato", value: report.noContact, detail: "Clientes que não falaram com o corretor" },
    { label: "Alertas abertos", value: report.openAlerts, detail: "Pesquisas que pedem acompanhamento" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Avaliação dos clientes</CardTitle>
        <CardDescription>Últimos {periodDays} dias. Percentuais consideram respostas válidas para cada pergunta.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {facts.map((fact) => (
          <div className="min-w-0 border-b border-border/60 pb-3" key={fact.label}>
            <p className="text-xs text-muted-foreground">{fact.label}</p>
            <p className="mt-1 font-mono text-xl font-semibold tabular-nums">{fact.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{fact.detail}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
