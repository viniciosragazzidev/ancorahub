import React from "react";
import Link from "next/link";
import { ArrowLeft, Sparkles, Check, X, Building, AlertTriangle } from "lucide-react";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getKnowledgeSuggestions } from "@/features/tenant-intelligence/service";
import { approveKnowledgeSuggestion } from "@/features/tenant-intelligence/ingestion/pipeline";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default async function SuggestionsDiffPage() {
  const context = await getRequiredTenantContext();
  const suggestions = await getKnowledgeSuggestions(context.tenantId);

  async function handleApprove(formData: FormData) {
    "use server";
    const ctx = await getRequiredTenantContext();
    const suggestionId = formData.get("suggestionId") as string;
    await approveKnowledgeSuggestion({
      tenantId: ctx.tenantId,
      suggestionId,
      reviewedByUserId: ctx.userId,
    });
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/inteligencia">
          <Button variant="outline" size="icon" className="rounded-lg">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Sparkles className="size-5 text-amber-500" />
            Sugestões de Atualização do CRM (Diff Visual)
          </h1>
          <p className="text-xs text-muted-foreground">
            Alterações estruturadas detectadas nos materiais que aguardam aprovação humana para execução via MCP
          </p>
        </div>
      </div>

      {suggestions.length === 0 ? (
        <Card className="rounded-xl border border-dashed border-border p-8 text-center space-y-2">
          <AlertTriangle className="size-8 text-muted-foreground mx-auto opacity-50" />
          <h3 className="font-bold text-sm text-foreground">Nenhuma sugestão pendente</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Quando você envia novos materiais, a IA compara o conteúdo com os dados atuais do CRM e apresenta as alterações aqui para revisão.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {suggestions.map((sugg) => {
            const diffList = (sugg.diff as Array<{ field: string; current: string; detected: string }>) || [];
            const isPending = sugg.status === "pending";

            return (
              <Card key={sugg.id} className="rounded-xl border border-border/80 shadow-2xs overflow-hidden">
                <CardHeader className="bg-muted/30 pb-3 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <Building className="size-4 text-primary" />
                      {sugg.title}
                    </CardTitle>
                    <CardDescription className="text-[11px] capitalize">Entidade: {sugg.entityType}</CardDescription>
                  </div>
                  <Badge variant={isPending ? "destructive" : "outline"} className="text-[10px] capitalize">
                    {sugg.status}
                  </Badge>
                </CardHeader>

                <CardContent className="p-4 space-y-3">
                  <h4 className="text-xs font-semibold text-foreground">Comparativo de Dados (Diff):</h4>

                  <div className="rounded-lg border border-border/60 overflow-hidden text-xs">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-muted/50 text-muted-foreground border-b border-border/60">
                          <th className="p-2.5 font-semibold">Campo</th>
                          <th className="p-2.5 font-semibold text-rose-600 dark:text-rose-400">Dado Atual no CRM</th>
                          <th className="p-2.5 font-semibold text-emerald-600 dark:text-emerald-400">Dado Detectado no Material</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {diffList.length > 0 ? (
                          diffList.map((item, idx) => (
                            <tr key={idx} className="hover:bg-muted/20">
                              <td className="p-2.5 font-medium">{item.field}</td>
                              <td className="p-2.5 bg-rose-500/5 text-rose-700 dark:text-rose-300 font-mono text-[11px]">
                                {item.current}
                              </td>
                              <td className="p-2.5 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300 font-mono text-[11px]">
                                {item.detected}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={3} className="p-3 text-center text-muted-foreground italic">
                              Sem campos em conflito direto (nova entidade pronta para cadastro)
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>

                {isPending && (
                  <CardFooter className="bg-muted/20 p-3 flex justify-end gap-2 border-t">
                    <form action={handleApprove}>
                      <input type="hidden" name="suggestionId" value={sugg.id} />
                      <Button type="submit" size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
                        <Check className="size-3.5" />
                        Aprovar & Atualizar CRM via MCP
                      </Button>
                    </form>
                  </CardFooter>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
