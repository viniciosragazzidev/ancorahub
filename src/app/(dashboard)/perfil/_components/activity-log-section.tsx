"use client";

import { ClipboardText } from "@/components/huge-icons";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/features/quotes/utils";
import type { PerfilData } from "../perfil-tabs";

const ACTION_LABELS: Record<string, string> = {
  login: "Entrou na conta",
  logout: "Saiu da conta",
  sign_up: "Criou a conta",
  atualizou_nome: "Atualizou o nome",
  atualizou_avatar: "Atualizou a foto",
  alterou_senha: "Alterou a senha",
  solicitou_verificacao_email: "Solicitou verificação de e-mail",
  encerrou_sessao: "Encerrou uma sessão",
  encerrou_todas_sessoes: "Encerrou as demais sessões",
  ativou_2fa: "Ativou a autenticação em duas etapas",
  desativou_2fa: "Desativou a autenticação em duas etapas",
  gerou_codigos_backup: "Gerou códigos de recuperação",
  atualizou_disponibilidade: "Alterou a disponibilidade de atendimento",
};

export function ActivityLogSection({ data }: { data: PerfilData }) {
  const logs = data.auditLogs;

  return (
    <Card className="border-border bg-card shadow-none">
      <CardHeader>
        <CardTitle className="text-base">Registro de atividades</CardTitle>
        <CardDescription className="mt-1">As últimas ações realizadas na sua conta.</CardDescription>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <EmptyState icon={ClipboardText} title="Nenhuma atividade registrada" description="As ações da sua conta aparecerão aqui." />
        ) : (
          <ul className="grid gap-1">
            {logs.map((log) => (
              <li key={log.id} className="flex flex-wrap items-center gap-2 border-b border-border/60 py-2.5 text-sm last:border-b-0">
                <span className="min-w-0 flex-1 text-foreground">
                  {ACTION_LABELS[log.acao] ?? log.acao}
                </span>
                <Badge variant="outline" className="font-mono text-[11px] font-normal text-muted-foreground">
                  {log.entidade}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {formatDate(log.createdAt, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
