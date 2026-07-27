"use client";

import { useState } from "react";

import { ArrowSquareOut, ChatCircleText, LockKey, WhatsappLogo } from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogPopup, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

function getWhatsAppUrl(phone: string | null) {
  const digits = phone?.replace(/\D/g, "") ?? "";
  return digits ? `https://wa.me/${digits}` : null;
}

/**
 * Transitional surface: the internal inbox must not imply that messages are
 * already synchronized before the official WhatsApp channel is available.
 */
export function LeadChat({ phone }: { phone: string | null }) {
  const [open, setOpen] = useState(false);
  const directUrl = getWhatsAppUrl(phone);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            aria-label="Chat do atendimento em desenvolvimento"
            className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-full border border-primary/20 bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-xl shadow-primary/20 transition-transform hover:-translate-y-0.5 active:translate-y-px max-[559px]:bottom-[calc(4.5rem+env(safe-area-inset-bottom))] max-[559px]:right-3"
          >
            <span className="grid size-8 place-items-center rounded-full bg-primary-foreground/15">
              <ChatCircleText size={18} />
            </span>
            <span className="hidden sm:inline">Chat do atendimento</span>
          </button>
        }
      />
      <DialogPopup
        className="h-[min(78vh,42rem)] w-[min(92vw,52rem)] max-w-none overflow-hidden p-0 max-sm:h-[82vh]"
        overlayClassName="bg-black/65 backdrop-blur-sm"
      >
        <div className="flex h-full min-h-0 flex-col bg-background">
          <header className="flex items-center gap-3 border-b border-border bg-card px-5 py-4 sm:px-6">
            <span className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
              <ChatCircleText size={21} />
            </span>
            <div className="min-w-0 flex-1">
              <DialogTitle>Chat do atendimento</DialogTitle>
              <DialogDescription className="mt-0.5 truncate">Integração oficial em preparação</DialogDescription>
            </div>
            <Badge className="hidden sm:inline-flex" variant="warning">EM DESENVOLVIMENTO</Badge>
          </header>

          <section className="relative min-h-0 flex-1 overflow-hidden bg-muted/30" aria-label="Prévia indisponível do chat interno">
            <div aria-hidden="true" className="pointer-events-none flex h-full flex-col gap-5 p-6 opacity-55 blur-[5px] select-none">
              <div className="ml-auto h-16 w-[58%] rounded-2xl rounded-br-md bg-primary/35" />
              <div className="h-20 w-[68%] rounded-2xl rounded-bl-md bg-card shadow-sm ring-1 ring-border" />
              <div className="ml-auto h-12 w-[42%] rounded-2xl rounded-br-md bg-primary/30" />
              <div className="mt-auto h-12 rounded-2xl border border-border bg-background" />
            </div>

            <div className="absolute inset-0 grid place-items-center bg-background/30 p-5 backdrop-blur-sm sm:p-8">
              <div className="max-w-md rounded-2xl border border-border/80 bg-card/95 p-5 text-center shadow-lg shadow-black/5 sm:p-6">
                <Badge className="sm:hidden" variant="warning">EM DESENVOLVIMENTO</Badge>
                <span className="mx-auto mt-3 grid size-11 place-items-center rounded-full bg-primary/10 text-primary sm:mt-0">
                  <LockKey size={20} />
                </span>
                <h2 className="mt-3 text-base font-semibold tracking-tight">Chat interno em desenvolvimento</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Enquanto finalizamos a integração oficial, o atendimento continua pelo WhatsApp pessoal do corretor.
                </p>
                {directUrl ? (
                  <Button className="mt-5 w-full" render={<a href={directUrl} rel="noopener noreferrer" target="_blank" />} size="sm">
                    <WhatsappLogo /> Abrir WhatsApp pessoal <ArrowSquareOut />
                  </Button>
                ) : (
                  <p className="mt-5 rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs leading-5 text-muted-foreground">
                    Inicie o atendimento para liberar o número do cliente e abrir o WhatsApp pessoal.
                  </p>
                )}
              </div>
            </div>
          </section>
        </div>
      </DialogPopup>
    </Dialog>
  );
}
