"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, MessageSquareWarning, Send, ShieldCheck, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BottomSheet } from "@/components/arc/bottom-sheet/bottom-sheet";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-mobile";
import { useArcScopeEnabled } from "@/components/arc/arc-scope-context";
import { sendSystemReportAction, type SystemReportActionState } from "@/features/system-report/actions";
import { SYSTEM_REPORT_TRIGGERS, getSystemReportTrigger } from "@/features/system-report/message";

const initialState: SystemReportActionState = {};

export function SystemFeedbackDrawer() {
  const [open, setOpen] = useState(false);
  const directorLite = useArcScopeEnabled();
  const isMobile = useIsMobile();

  useEffect(() => {
    const handleOpen = () => setOpen(true);
    window.addEventListener("open-system-feedback", handleOpen);
    return () => window.removeEventListener("open-system-feedback", handleOpen);
  }, []);

  if (directorLite && isMobile) {
    return (
      <BottomSheet open={open} onOpenChange={setOpen} title="Reportar problema" detents={[0.62, 0.92]} closeLabel="Fechar" className="arc-venancor director-feedback-sheet">
        <FeedbackBody directorLiteEnabled />
      </BottomSheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent className={directorLite ? "w-full sm:max-w-md director-feedback-drawer" : "w-full sm:max-w-md"}>
        <FeedbackBody directorLiteEnabled={directorLite} />
      </SheetContent>
    </Sheet>
  );
}

function FeedbackBody({ directorLiteEnabled = false }: { directorLiteEnabled?: boolean }) {
  const [triggerId, setTriggerId] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState(sendSystemReportAction, initialState);
  const selectedTrigger = triggerId ? getSystemReportTrigger(triggerId) : null;

  return (
    <>
      <SheetHeader className="space-y-1">
        <Badge variant="outline" className={directorLiteEnabled ? "w-fit text-xs gap-1" : "w-fit text-[10px] gap-1"}>
          <TriangleAlert className="size-3 text-primary" />
          Reportar problema
        </Badge>
        <SheetTitle className={directorLiteEnabled ? "text-lg font-medium" : "text-lg font-bold"}>{directorLiteEnabled ? "Central de feedback" : "Central de Feedback"}</SheetTitle>
        <SheetDescription className="text-xs">
          {directorLiteEnabled ? "Escolha o assunto e conte o que aconteceu." : "Encontrou um problema no sistema? Escolha o assunto e descreva o que aconteceu. O responsável recebe a mensagem direto no WhatsApp."}
        </SheetDescription>
      </SheetHeader>

      <div className="flex min-h-0 flex-1 flex-col">
        <AnimatePresence mode="wait" initial={false}>
          {selectedTrigger ? (
            <motion.form
              key={`form:${selectedTrigger.id}`}
              action={formAction}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6"
            >
              <input type="hidden" name="triggerId" value={selectedTrigger.id} />
              <div className="rounded-xl border border-border/80 bg-muted/30 px-4 py-3">
                <p className="text-sm font-semibold text-foreground">{selectedTrigger.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">O responsável recebe este assunto junto com a sua descrição.</p>
              </div>
              <div className="space-y-2">
                <label htmlFor="system-report-message" className="text-xs font-medium text-foreground">
                  O que aconteceu?
                </label>
                <Textarea
                  id="system-report-message"
                  name="message"
                  autoFocus
                  placeholder="Descreva o problema, o que você esperava e o que viu acontecer…"
                  maxLength={2000}
                  required
                  className="min-h-36"
                />
              </div>
              {state.error ? <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{state.error}</p> : null}
              {state.success ? <p role="status" className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-foreground"><ShieldCheck className="mr-2 inline size-4 text-primary" />{state.success}</p> : null}
              <div className="mt-auto flex items-center gap-2 pt-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setTriggerId(null)} disabled={pending} className="gap-1.5">
                  <ChevronLeft className="size-4" />
                  Voltar
                </Button>
                <Button type="submit" size="sm" disabled={pending} className="flex-1 gap-1.5">
                  <Send className="size-4" />
                  {pending ? "Enviando…" : "Enviar report"}
                </Button>
              </div>
            </motion.form>
          ) : (
            <motion.div
              key="list"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6"
            >
              <p className={directorLiteEnabled ? "pb-1 text-sm font-medium text-muted-foreground" : "pb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground/80"}>Qual é o assunto?</p>
              {SYSTEM_REPORT_TRIGGERS.map((item) => (
                <Button
                  key={item.id}
                  type="button"
                  onClick={() => setTriggerId(item.id)}
                  className="group h-auto w-full justify-start gap-3 p-3.5 text-left hover:border-primary/40"
                  variant="outline"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary transition-transform duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] group-hover:scale-105 motion-reduce:transition-none">
                    <MessageSquareWarning className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">{item.label}</span>
                    <span className="block text-[11px] text-muted-foreground">Toque para descrever o problema</span>
                  </span>
                </Button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
