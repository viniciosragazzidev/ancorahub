import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getPostSaleLeadSurveyAction } from "../actions";
import { R0_OUTCOME_LABELS } from "@/features/post-sale-audit/r0-rules";

const dateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Sao_Paulo" });

const OUTCOME_LABELS: Record<string, string> = {
  no_contact: "Não conseguiu falar com o corretor",
  bad_service: "Relatou uma experiência ruim",
  closed: "Informou que fechou o plano",
  ok: "Atendimento avaliado",
  no_reply: "Sem resposta",
  opted_out: "Pediu para não receber novas pesquisas",
  other: "Pesquisa encerrada",
  ...R0_OUTCOME_LABELS,
};

function answerText(value: unknown, yes: string, no: string) {
  return value === true ? yes : value === false ? no : null;
}

export async function PostSaleLeadCard({ leadId }: { leadId: string }) {
  const result = await getPostSaleLeadSurveyAction(leadId);
  if (!result.ok || !result.data) return null;
  const survey = result.data;
  const answers = survey.answers;
  const occurredAt = survey.completedAt ?? survey.lastReplyAt ?? survey.sentAt;
  const status = OUTCOME_LABELS[survey.outcome ?? ""] ?? (survey.status === "sent" || survey.status === "answering" ? "Pesquisa em andamento" : survey.status === "failed" ? "Não foi possível enviar" : survey.status === "skipped" ? "Pesquisa não enviada" : "Pesquisa registrada");
  const rows = [
    ["Contato do corretor", answerText(answers.contacted, "Sim", "Não")],
    ["Rapidez", answers.speed === "fast" ? "Rápido" : answers.speed === "slow" ? "Demorou" : null],
    ["Recebeu cotação", answerText(answers.receivedQuote, "Sim", "Não")],
    ["Plano fechado", answers.closed === "yes" ? "Sim" : answers.closed === "no" ? "Não" : answers.closed === "deciding" ? "Em decisão" : null],
    ["Pediu ajuda", answerText(answers.wantsHelp, "Sim", "Não")],
    ["Motivo", typeof answers.reason === "string" ? answers.reason : null],
    ["Comentário", typeof answers.comment === "string" ? answers.comment : null],
  ].filter((row): row is [string, string] => Boolean(row[1]));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pesquisa de pós-venda</CardTitle>
        <CardDescription>{occurredAt ? `Atualizada em ${dateFormat.format(new Date(occurredAt))}` : "Sem data registrada"}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span><strong className="font-medium">Resultado:</strong> {status}</span>
          {survey.rating !== null ? <span><strong className="font-medium">Nota:</strong> {survey.rating}/5</span> : null}
        </div>
        {rows.length ? <dl className="grid gap-3 sm:grid-cols-2">
          {rows.map(([label, value]) => <div className="min-w-0" key={label}>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-0.5 break-words text-sm">{value}</dd>
          </div>)}
        </dl> : <p className="text-sm text-muted-foreground">O cliente ainda não enviou respostas.</p>}
      </CardContent>
    </Card>
  );
}
