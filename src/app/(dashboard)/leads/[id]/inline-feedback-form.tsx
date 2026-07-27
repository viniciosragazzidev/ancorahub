"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { submitLeadFeedbackAction, type LeadFeedbackState } from "@/features/leads/feedback-actions";
import { getActiveChecklistTemplatesAction, type ChecklistTemplateWithItems } from "@/features/leads/checklist-actions";
import { CheckCircle, CircleDashed, ClipboardText, X } from "@/components/huge-icons";

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

export function InlineFeedbackForm({ leadId, onSuccess }: { leadId: string; onSuccess?: () => void }) {
  const [state, action, pending] = useActionState<LeadFeedbackState, FormData>(submitLeadFeedbackAction, {});
  const [checklist, setChecklist] = useState<ChecklistTemplateWithItems | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | number | boolean>>({});
  const [feedbackType, setFeedbackType] = useState("contacted");
  const [phase, setPhase] = useState<"form" | "success" | "checklist" | "done">("form");

  useEffect(() => {
    if (state.success) {
      if (phase === "form") {
        // First submit: move to success phase
        toast.success("Feedback registrado e SLA atualizado.");
        setPhase(checklist ? "success" : "done");
        if (!checklist) onSuccess?.();
      } else if (phase === "checklist") {
        // Checklist submitted: done
        toast.success("Checklist de qualidade registrado.");
        setPhase("done");
        onSuccess?.();
      }
    }
    if (state.error) toast.error(state.error);
  }, [state.error, state.success, phase, checklist, onSuccess]);

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
  const allRequiredAnswered = phase === "checklist" ? totalRequired === 0 || answeredRequired >= totalRequired : true;

  function handleQuickSubmit(formData: FormData) {
    formData.set("leadId", leadId);
    formData.set("type", feedbackType);
    // Don't send checklist data in the first submit
    action(formData);
  }

  function handleChecklistSubmit() {
    // Submit checklist separately
    const formData = new FormData();
    formData.set("leadId", leadId);
    formData.set("type", feedbackType);
    if (checklist) {
      formData.set("checklistId", checklist.id);
      formData.set("answers", JSON.stringify(answers));
    }
    action(formData);
  }

  // ── Phase: done ──
  if (phase === "done") {
    return (
      <div className="flex items-center gap-3 rounded-lg bg-success/[0.06] px-4 py-3 text-sm">
        <CheckCircle className="size-5 text-success" />
        <div>
          <p className="font-medium text-success">Finalizado!</p>
          <p className="text-xs text-muted-foreground">Feedback e checklist registrados com sucesso.</p>
        </div>
      </div>
    );
  }

  // ── Phase: success (post-quick-submit, show checklist option) ──
  if (phase === "success") {
    return (
      <div className="space-y-4">
        {/* Success banner */}
        <div className="flex items-center justify-between rounded-lg bg-success/[0.06] px-4 py-3">
          <div className="flex items-center gap-3">
            <CheckCircle className="size-5 text-success" />
            <div>
              <p className="text-sm font-medium text-success">Feedback registrado</p>
              <p className="text-xs text-muted-foreground">O SLA de atendimento foi atualizado.</p>
            </div>
          </div>
        </div>

        {/* Optional: fill checklist */}
        {checklist && (
          <div className="space-y-3 rounded-lg border border-primary/10 bg-primary/[0.02] p-4">
            <div className="flex items-center gap-3">
              <ClipboardText className="size-5 text-primary" />
              <div className="flex-1">
                <p className="text-sm font-medium">Checklist de qualidade</p>
                <p className="text-xs text-muted-foreground">
                  {checklist.name} — {answeredRequired}/{totalRequired} obrigatórias
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => setPhase("checklist")}
              >
                Preencher
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setPhase("done");
                  onSuccess?.();
                }}
              >
                Pular
              </Button>
            </div>
          </div>
        )}

        {/* Close accordion call-to-action */}
        {!checklist && (
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setPhase("done");
                onSuccess?.();
              }}
            >
              Fechar
            </Button>
          </div>
        )}
      </div>
    );
  }

  // ── Phase: checklist (post-submit, filling checklist) ──
  if (phase === "checklist") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <ClipboardText className="size-5 text-primary" />
          <div>
            <p className="text-sm font-semibold">{checklist?.name ?? "Checklist"}</p>
            <p className="text-xs text-muted-foreground">{answeredRequired}/{totalRequired} obrigatórias respondidas</p>
          </div>
        </div>

        {totalRequired > 0 && (
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${Math.min((answeredRequired / totalRequired) * 100, 100)}%` }}
            />
          </div>
        )}

        <div className="space-y-3">
          {checklist?.items.map((item) => (
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
                  className="text-xs h-8"
                />
              )}

              {item.answerType === "select" && Array.isArray(item.options) && (
                <select
                  className="flex h-8 w-full rounded-lg border border-input bg-input/30 px-2.5 text-xs"
                  value={String(answers[item.id] ?? "")}
                  onChange={(e) => setAnswers((prev) => ({ ...prev, [item.id]: e.target.value }))}
                >
                  <option value="">Selecione...</option>
                  {item.options.map((opt: string) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              )}
            </div>
          ))}
        </div>

        {/* Checklist actions */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setPhase("done");
              onSuccess?.();
            }}
          >
            <X className="size-4" />
            Pular
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={pending || !allRequiredAnswered}
            onClick={handleChecklistSubmit}
          >
            {pending ? <><CircleDashed className="size-4 animate-spin" /> Salvando...</> : "Concluir checklist"}
          </Button>
          {!allRequiredAnswered && (
            <p className="text-[10px] text-muted-foreground">
              Responda todas as perguntas obrigatórias.
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── Phase: form (initial quick feedback) ──
  return (
    <form action={handleQuickSubmit} className="space-y-4">
      <input name="leadId" type="hidden" value={leadId} />

      {/* Quick fields row: type + next action */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label className="text-xs font-medium">O que aconteceu?</Label>
          <Select defaultValue="contacted" name="type" labels={Object.fromEntries(feedbackTypes.map(([v, l]) => [v, l]))} onValueChange={(value) => setFeedbackType(value ?? "contacted")}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {feedbackTypes.map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <Label className="text-xs font-medium" htmlFor="fi-next-action">Próxima ação</Label>
          <Input id="fi-next-action" name="nextAction" placeholder="Ex.: Retornar após análise" className="h-9 text-sm" />
        </div>
      </div>

      {/* Optional: observation */}
      <div className="grid gap-1.5">
        <Label className="text-xs font-medium" htmlFor="fi-content">Observação <span className="text-muted-foreground font-normal">(opcional)</span></Label>
        <Input id="fi-content" name="content" placeholder="Contexto do contato..." className="h-9 text-sm" />
      </div>

      {/* Optional: date */}
      <div className="grid gap-1.5 sm:max-w-xs">
        <Label className="text-xs font-medium" htmlFor="fi-next-action-at">Data do próximo contato <span className="text-muted-foreground font-normal">(opcional)</span></Label>
        <Input id="fi-next-action-at" name="nextActionAt" type="datetime-local" className="h-9 text-sm" />
      </div>

      {/* Submit */}
      <div className="flex items-center gap-3 pt-1">
        <Button disabled={pending} size="sm" type="submit">
          {pending ? <><CircleDashed className="size-4 animate-spin" /> Salvando...</> : "Registrar feedback"}
        </Button>
      </div>
    </form>
  );
}
