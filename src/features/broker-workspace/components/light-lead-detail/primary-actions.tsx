"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle, FileText, WhatsappLogo, XCircle } from "@/components/huge-icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { type LightLeadDetailData } from "./types";
import type { LeadDetailController } from "./use-lead-detail";

export function PrimaryActionsZone({ lead, c }: { lead: LightLeadDetailData; c: LeadDetailController }) {
  const { leadStatus, accepting, setShowDeclineModal, whatsappOpenedAt, setWhatsappOpenedAt, requestingSale, externalWhatsAppUrl, setShowSaleConfirm, approvedDocument, rejectedDocument, isDistributed, handleOpenUpdateModal, handleAccept, handleRequestSale } = c;
  return (
    <>
          {/* Zona B — Ação Principal em Destaque */}
          {isDistributed ? (
            /* State 1: ANTES DO ACEITE */
            <div className="pt-2 space-y-2 border-t border-border/50">
              <Button
                size="lg"
                disabled={accepting}
                onClick={handleAccept}
                className="w-full h-12 text-sm font-bold gap-2 shadow-md bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {accepting ? (
                  <span>Aceitando...</span>
                ) : (
                  <>
                    <CheckCircle className="size-5" />
                    ACEITAR LEAD
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                size="sm"
                disabled={accepting}
                onClick={() => setShowDeclineModal(true)}
                className="w-full text-xs text-muted-foreground hover:text-destructive hover:border-destructive/40"
              >
                RECUSAR ATENDIMENTO
              </Button>
            </div>
          ) : (
            /* State 2: EM ATENDIMENTO */
            <div className="pt-2 space-y-3 border-t border-border/50">
              <Card variant="subtle" className="border-emerald-500/30 bg-emerald-500/5 p-3 text-xs text-muted-foreground">
                <div className="flex items-start gap-2">
                  <WhatsappLogo className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                  <p>
                    Para proteger os dados do cliente, o número fica oculto no computador. Conecte seu WhatsApp por QR Code em{" "}
                    <Link className="font-semibold text-emerald-700 underline underline-offset-2 dark:text-emerald-400" href="/integrations/whatsapp">Integrações → WhatsApp</Link>{" "}
                    e continue o atendimento pelo aplicativo.
                  </p>
                </div>
              </Card>

              <Button
                render={externalWhatsAppUrl ? <a href={externalWhatsAppUrl} rel="noreferrer" target="_blank" /> : undefined}
                disabled={!externalWhatsAppUrl}
                onClick={() => {
                  const nowStr = new Date().toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  setWhatsappOpenedAt(nowStr);
                }}
                size="lg"
                className="w-full h-12 text-sm font-bold gap-2.5 shadow-md bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center rounded-xl"
              >
                <WhatsappLogo className="size-5" />
                ABRIR WHATSAPP
              </Button>

              {whatsappOpenedAt ? (
                <p className="text-center text-[11px] text-emerald-600 font-medium">
                  ✓ Contato aberto às {whatsappOpenedAt}
                </p>
              ) : null}

              <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card p-3">
                <div>
                  <span className="text-[11px] text-muted-foreground block">Etapa atual</span>
                  <strong className="text-xs font-semibold text-foreground">
                    {leadStatus === "in_contact"
                      ? "Em atendimento"
                      : leadStatus === "quote_sent"
                        ? "Cotação enviada"
                        : leadStatus === "negotiation"
                          ? "Em negociação"
                          : leadStatus === "converted"
                            ? "Venda realizada"
                            : leadStatus === "documentation_pending"
                              ? "Documentação pendente"
                              : "Contato iniciado"}
                  </strong>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenUpdateModal}
                  className="h-8 text-xs font-semibold gap-1.5"
                >
                  REGISTRAR ETAPA
                  <ArrowRight className="size-3.5" />
                </Button>
              </div>

              {/* Approved document */}
              {approvedDocument && leadStatus !== "converted" && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 space-y-2 text-center">
                  <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle className="size-4" />
                    Documentação Aprovada pelo Supervisor!
                  </div>
                  <p className="text-xs text-muted-foreground">
                    O documento &quot;{approvedDocument.filename}&quot; foi aprovado. Confirme a venda para finalizar.
                  </p>
                  <Button
                    size="sm"
                    onClick={() => setShowSaleConfirm(true)}
                    className="w-full text-xs font-bold gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <FileText className="size-4" />
                    CONFIRMAR VENDA & CONVERTER
                  </Button>
                </div>
              )}

              {/* Rejected document */}
              {!approvedDocument && rejectedDocument && leadStatus !== "converted" && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3.5 space-y-2 text-center">
                  <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-destructive">
                    <XCircle className="size-4" />
                    Documentação Rejeitada pelo Supervisor
                  </div>
                  <p className="text-xs text-muted-foreground">
                    O documento &quot;{rejectedDocument.filename}&quot; foi rejeitado. Reenvie a documentação corrigida.
                  </p>
                  <Button
                    size="sm"
                    onClick={handleRequestSale}
                    disabled={requestingSale}
                    className="w-full text-xs font-bold gap-2 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    <FileText className="size-4" />
                    REENVIAR DOCUMENTAÇÃO
                  </Button>
                </div>
              )}

              {/* Pending sale status */}
              {!approvedDocument && !rejectedDocument && leadStatus === "documentation_pending" && (
                <div className="rounded-xl border border-amber-300/30 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-center">
                  <p className="font-semibold text-amber-700 dark:text-amber-400">Documentação de venda em análise</p>
                  <p className="mt-1 text-amber-600 dark:text-amber-300">Aguardando aprovação do supervisor.</p>
                </div>
              )}

              {/* Regular Register Sale Button */}
              {!approvedDocument &&
                !rejectedDocument &&
                leadStatus !== "converted" &&
                leadStatus !== "lost" &&
                leadStatus !== "documentation_pending" && (
                  <Button
                    size="sm"
                    onClick={handleRequestSale}
                    disabled={requestingSale}
                    className="w-full text-xs font-bold gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <FileText className="size-4" />
                    {requestingSale ? "Enviando..." : "REGISTRAR VENDA"}
                  </Button>
                )}
            </div>
          )}
    </>
  );
}
