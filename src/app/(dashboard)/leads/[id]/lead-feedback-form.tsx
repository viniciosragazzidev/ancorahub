"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { submitLeadFeedbackAction, type LeadFeedbackState } from "@/features/leads/feedback-actions";
import { getActiveChecklistTemplatesAction, type ChecklistTemplateWithItems } from "@/features/leads/checklist-actions";

const feedbackTypes = [
  ["contacted", "Contato realizado"],
  ["no_answer", "Cliente não respondeu"],
  ["callback_requested", "Pediu retorno"],
  ["quote_sent", "Cotação enviada"],
  ["documentation_pending", "Documentação pendente"],
  ["negotiation", "Em negociação"],
  ["no_interest", "Sem interesse"],
  ["invalid_number", "Número inválido"],
  ["other", "Outro"],
] as const;

export function LeadFeedbackForm({ leadId }: { leadId: string }) {
  const [state, action, pending] = useActionState<LeadFeedbackState, FormData>(submitLeadFeedbackAction, {});
  const [checklist, setChecklist] = useState<ChecklistTemplateWithItems | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | number | boolean>>({});
  const [feedbackType, setFeedbackType] = useState("contacted");

  useEffect(() => {
    if (state.success) toast.success("Feedback registrado e SLA atualizado.");
    if (state.error) toast.error(state.error);
  }, [state.error, state.success]);

  useEffect(() => {
    getActiveChecklistTemplatesAction().then((templates) => {
      if (templates.length > 0) setChecklist(templates[0]);
    });
  }, []);

  const totalRequired = checklist ? checklist.items.filter((item) => item.required).length : 0;
  const answeredRequired = checklist
    ? checklist.items.filter((item) => {
        if (!item.required) return false;
        const val = answers[item.id];
        return val !== undefined && val !== "";
      }).length
    : 0;
  const allRequiredAnswered = totalRequired === 0 || answeredRequired >= totalRequired;

  function handleSubmit(formData: FormData) {
    formData.set("leadId", leadId);
    formData.set("type", feedbackType);
    if (checklist) {
      formData.set("checklistId", checklist.id);
      formData.set("answers", JSON.stringify(answers));
    }
    action(formData);
  }

  return (
    <Card className="border-primary/20 bg-primary/[0.03] shadow-none" id="feedback">
      <CardHeader>
        <CardTitle>Atualizar atendimento</CardTitle>
        <CardDescription>Registre o andamento para manter o lead sob sua responsabilidade.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <input name="leadId" type="hidden" value={leadId} />
          {checklist && <input name="checklistId" type="hidden" value={checklist.id} />}

          <div className="grid gap-2">
            <Label>O que aconteceu?</Label>
            <Select defaultValue="contacted" name="type" labels={Object.fromEntries(feedbackTypes.map(([v, l]) => [v, l]))} onValueChange={(value) => setFeedbackType(value ?? "contacted")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {feedbackTypes.map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="feedback-next-action">Próxima ação</Label>
            <Input id="feedback-next-action" name="nextAction" placeholder="Ex.: Retornar após análise da proposta" />
          </div>

          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="feedback-content">Observação</Label>
            <Input id="feedback-content" name="content" placeholder="Contexto do contato (opcional)" />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="feedback-next-action-at">Data do próximo contato</Label>
            <Input id="feedback-next-action-at" name="nextActionAt" type="datetime-local" />
          </div>

          {/* ─── Checklist questions ─── */}
          {checklist && (
            <div className="sm:col-span-2 space-y-3 rounded-lg border border-primary/10 bg-primary/[0.02] p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-primary">{checklist.name}</p>
                <span className="text-[10px] text-muted-foreground">
                  {answeredRequired}/{totalRequired} obrigatórias
                </span>
              </div>

              {/* Progress bar */}
              {totalRequired > 0 && (
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${Math.min((answeredRequired / totalRequired) * 100, 100)}%` }}
                  />
                </div>
              )}

              <div className="space-y-3">
                {checklist.items.map((item) => (
                  <div key={item.id} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium">
                        {item.question}
                        {item.required && <span className="ml-0.5 text-destructive">*</span>}
                      </Label>
                      {answers[item.id] !== undefined && (
                        <span className="text-[9px] text-success">✓</span>
                      )}
                    </div>

                    {item.answerType === "boolean" && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setAnswers((prev) => ({ ...prev, [item.id]: true }))}
                          className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                            answers[item.id] === true
                              ? "border-success bg-success/10 text-success"
                              : "border-border text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          Sim
                        </button>
                        <button
                          type="button"
                          onClick={() => setAnswers((prev) => ({ ...prev, [item.id]: false }))}
                          className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                            answers[item.id] === false
                              ? "border-destructive bg-destructive/10 text-destructive"
                              : "border-border text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          Não
                        </button>
                      </div>
                    )}

                    {item.answerType === "rating" && (
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((rating) => (
                          <button
                            key={rating}
                            type="button"
                            onClick={() => setAnswers((prev) => ({ ...prev, [item.id]: rating }))}
                            className={`flex-1 rounded-lg border py-1.5 text-xs font-bold transition-colors ${
                              answers[item.id] === rating
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border text-muted-foreground hover:bg-muted"
                            }`}
                          >
                            {rating}
                          </button>
                        ))}
                      </div>
                    )}

                    {item.answerType === "text" && (
                      <Input
                        value={String(answers[item.id] ?? "")}
                        onChange={(e) => setAnswers((prev) => ({ ...prev, [item.id]: e.target.value }))}
                        placeholder="Descreva..."
                        className="text-xs"
                      />
                    )}

                    {item.answerType === "select" && Array.isArray(item.options) && (
                      <select
                        className="flex h-8 w-full rounded-lg border border-input bg-input/30 px-2.5 text-xs"
                        value={String(answers[item.id] ?? "")}
                        onChange={(e) => setAnswers((prev) => ({ ...prev, [item.id]: e.target.value }))}
                      >
                        <option value="">Selecione...</option>
                        {item.options.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-end sm:col-span-2">
            <Button disabled={pending || !allRequiredAnswered} type="submit">
              {pending ? "Salvando..." : "Registrar feedback"}
            </Button>
            {!allRequiredAnswered && (
              <p className="ml-3 text-[10px] text-muted-foreground">
                Responda todas as perguntas obrigatórias do checklist.
              </p>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
