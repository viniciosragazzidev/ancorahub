import { CalendarBlank, CheckCircle, FileText, UserList } from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Dependent = { id: string; name: string; birthDate: string; relationship: string; isHolder: boolean };

export function PersonRecordDetails({
  kind,
  createdAt,
  birthDate,
  consentimentoLgpd,
  dependents,
  documentCount,
}: {
  kind: "lead" | "client";
  createdAt: Date;
  birthDate?: string | null;
  consentimentoLgpd: boolean;
  dependents: Dependent[];
  documentCount: number;
}) {
  return (
    <Card className="border-border bg-card shadow-sm">
      <CardHeader className="border-b border-border/40 pb-3">
        <CardTitle className="text-sm font-semibold tracking-tight">Dados organizados</CardTitle>
        <p className="text-xs text-muted-foreground">Informações essenciais para continuar o relacionamento sem procurar em várias telas.</p>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-border/70 bg-muted/20 p-3"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Registro</p><p className="mt-1 text-sm font-semibold">{kind === "client" ? "Cliente" : "Lead"}</p></div>
          <div className="rounded-lg border border-border/70 bg-muted/20 p-3"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Documentos</p><p className="mt-1 text-sm font-semibold">{documentCount}</p></div>
        </div>
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 text-muted-foreground"><CalendarBlank className="size-3.5" /> Cadastro</span><span className="font-medium">{new Intl.DateTimeFormat("pt-BR").format(createdAt)}</span></div>
          <div className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 text-muted-foreground"><CalendarBlank className="size-3.5" /> Aniversário</span><span className="font-medium">{birthDate ? new Intl.DateTimeFormat("pt-BR").format(new Date(`${birthDate}T00:00:00`)) : "Ainda não informado"}</span></div>
          <div className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 text-muted-foreground"><CheckCircle className="size-3.5" /> Consentimento LGPD</span><Badge variant={consentimentoLgpd ? "success" : "outline"}>{consentimentoLgpd ? "Registrado" : "Pendente"}</Badge></div>
        </div>
        <div className="border-t border-border/50 pt-3">
          <div className="mb-2 flex items-center justify-between"><p className="flex items-center gap-2 text-xs font-semibold"><UserList className="size-4 text-primary" /> Dependentes</p><Badge variant="outline" className="text-[10px]">{dependents.length}</Badge></div>
          {dependents.length ? <div className="space-y-2">{dependents.map((dependent) => <div className="flex items-center justify-between rounded-lg bg-muted/20 px-3 py-2 text-xs" key={dependent.id}><span className="font-medium">{dependent.name}{dependent.isHolder ? " · Titular" : ""}</span><span className="text-muted-foreground">{dependent.relationship}</span></div>)}</div> : <p className="rounded-lg border border-dashed border-border/70 px-3 py-3 text-xs text-muted-foreground">Nenhum dependente cadastrado.</p>}
        </div>
        <p className="flex items-start gap-2 rounded-lg border border-primary/15 bg-primary/[0.05] px-3 py-2.5 text-xs leading-5 text-muted-foreground"><FileText className="mt-0.5 size-3.5 shrink-0 text-primary" />Use a aba Documentos para consultar requisitos, arquivos enviados e status de revisão.</p>
      </CardContent>
    </Card>
  );
}
