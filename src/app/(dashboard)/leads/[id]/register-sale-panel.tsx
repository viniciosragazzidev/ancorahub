"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogDescription, DialogPanel, DialogPopup, DialogTitle } from "@/components/ui/dialog";
import { registerSaleAction } from "@/features/post-sale/actions";

type CarrierOption = { id: string; name: string };
type ConfirmationDocument = { id: string; filename: string; status: string };

function addMonths(dateStr: string, months: number): string {
  if (!dateStr) return "";
  try {
    const d = new Date(`${dateStr}T12:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + months);
    return d.toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

export function RegisterSalePanel({
  leadId,
  documents,
  carriers,
  open,
  onOpenChange,
}: {
  leadId: string;
  documents: ConfirmationDocument[];
  carriers: CarrierOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [policyNumber, setPolicyNumber] = useState("");
  const [coverageStartDate, setCoverageStartDate] = useState("");
  const [contractTermMonths, setContractTermMonths] = useState<number>(12);
  const [customExpirationDate, setCustomExpirationDate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"boleto" | "debito_automatico" | "cartao_credito" | "desconto_folha" | "outro">("boleto");
  const [renewalType, setRenewalType] = useState<"reajuste_operadora" | "portabilidade" | "manutencao" | "nova_contratacao">("reajuste_operadora");
  const [renewalContactPreference, setRenewalContactPreference] = useState("whatsapp");
  const [postSaleNotes, setPostSaleNotes] = useState("");
  const [approvedValue, setApprovedValue] = useState("");
  const [carrierId, setCarrierId] = useState("");
  const [confirmationDocumentId, setConfirmationDocumentId] = useState("");

  const approvedDocuments = documents.filter((document) => document.status === "approved");

  const computedExpirationDate = useMemo(() => {
    if (customExpirationDate) return customExpirationDate;
    return addMonths(coverageStartDate, contractTermMonths);
  }, [coverageStartDate, contractTermMonths, customExpirationDate]);

  function submit() {
    startTransition(async () => {
      const result = await registerSaleAction({
        leadId,
        policyNumber,
        coverageStartDate,
        contractTermMonths,
        expirationDate: computedExpirationDate || undefined,
        paymentMethod,
        renewalType,
        renewalContactPreference,
        postSaleNotes: postSaleNotes.trim() || undefined,
        approvedValue,
        confirmationDocumentId,
        carrierId: carrierId || undefined,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Venda registrada com ciclo de vida e lembretes de renovação agendados!");
      onOpenChange(false);
      window.location.reload();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="max-h-[min(90vh,48rem)] max-w-2xl overflow-y-auto">
        <DialogPanel className="space-y-6">
          <div className="space-y-1">
            <DialogTitle className="text-lg font-bold">Declarar Venda e Registrar Pós-Venda</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Insira os dados do contrato para conversão do lead e agendamento dos marcos de renovação futura.
            </DialogDescription>
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border border-border/80 bg-muted/30 p-3.5 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">1. Confirmação da Operadora & Apólice</p>
              
              <div className="grid gap-3 sm:grid-cols-2">
                {carriers.length > 0 && (
                  <div className="space-y-1.5">
                    <Label htmlFor="sale-carrier" className="text-xs">Operadora</Label>
                    <select
                      id="sale-carrier"
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
                      value={carrierId}
                      onChange={(event) => setCarrierId(event.target.value)}
                    >
                      <option value="">Selecione a operadora...</option>
                      {carriers.map((carrier) => (
                        <option key={carrier.id} value={carrier.id}>{carrier.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="policy-number" className="text-xs">Número da Apólice / Contrato</Label>
                  <Input
                    id="policy-number"
                    value={policyNumber}
                    onChange={(event) => setPolicyNumber(event.target.value)}
                    placeholder="Ex.: 123456789"
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="approved-value" className="text-xs">Valor Final Aprovado (Mensalidade)</Label>
                  <CurrencyInput
                    id="approved-value"
                    placeholder="0,00"
                    value={approvedValue}
                    onChange={setApprovedValue}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirmation-document" className="text-xs">Confirmação da Operadora</Label>
                  <select
                    id="confirmation-document"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
                    value={confirmationDocumentId}
                    onChange={(event) => setConfirmationDocumentId(event.target.value)}
                  >
                    <option value="">Selecione a confirmação aprovada...</option>
                    {documents.length === 0 && (
                      <option disabled>Nenhum documento encontrado — anexe na seção de documentos</option>
                    )}
                    {documents.map((doc) => (
                      <option key={doc.id} value={doc.id} disabled={doc.status !== "approved"}>
                        {doc.filename}{doc.status === "pending" ? " (aguardando aprovação)" : doc.status === "rejected" ? " (rejeitado)" : " ✓"}
                      </option>
                    ))}
                  </select>
                  {documents.length > 0 && !approvedDocuments.length && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400">
                      Nenhum documento aprovado ainda. Solicite a aprovação do gestor.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border/80 bg-muted/30 p-3.5 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">2. Ciclo de Vida do Contrato & Renovação Futurista</p>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="coverage-start-date" className="text-xs">Início da Vigência</Label>
                  <Input
                    id="coverage-start-date"
                    type="date"
                    value={coverageStartDate}
                    onChange={(event) => setCoverageStartDate(event.target.value)}
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="contract-term" className="text-xs">Vigência do Contrato</Label>
                  <select
                    id="contract-term"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
                    value={contractTermMonths}
                    onChange={(event) => setContractTermMonths(Number(event.target.value))}
                  >
                    <option value={12}>12 Meses (Anual)</option>
                    <option value={24}>24 Meses (Bienal)</option>
                    <option value={36}>36 Meses (Trienal)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="expiration-date" className="text-xs">Data de Vencimento (Calculada)</Label>
                  <Input
                    id="expiration-date"
                    type="date"
                    value={computedExpirationDate}
                    onChange={(event) => setCustomExpirationDate(event.target.value)}
                    className="h-9 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="payment-method" className="text-xs">Forma de Pagamento</Label>
                  <select
                    id="payment-method"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
                    value={paymentMethod}
                    onChange={(event) => setPaymentMethod(event.target.value as typeof paymentMethod)}
                  >
                    <option value="boleto">Boleto Bancário</option>
                    <option value="debito_automatico">Débito Automático</option>
                    <option value="cartao_credito">Cartão de Crédito</option>
                    <option value="desconto_folha">Desconto em Folha</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="renewal-type" className="text-xs">Estratégia de Renovação Futura</Label>
                  <select
                    id="renewal-type"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
                    value={renewalType}
                    onChange={(event) => setRenewalType(event.target.value as typeof renewalType)}
                  >
                    <option value="reajuste_operadora">Reajuste Anual da Operadora</option>
                    <option value="portabilidade">Portabilidade / Troca de Plano</option>
                    <option value="manutencao">Manutenção do Plano Atual</option>
                    <option value="nova_contratacao">Nova Contratação</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="contact-preference" className="text-xs">Canal Preferencial de Contato</Label>
                  <select
                    id="contact-preference"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
                    value={renewalContactPreference}
                    onChange={(event) => setRenewalContactPreference(event.target.value)}
                  >
                    <option value="whatsapp">WhatsApp</option>
                    <option value="phone">Ligação Telefônica</option>
                    <option value="email">E-mail</option>
                  </select>
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="post-sale-notes" className="text-xs">Observações do Pós-Venda (Opcional)</Label>
                  <textarea
                    id="post-sale-notes"
                    rows={2}
                    placeholder="Particularidades da negociação, carências especiais ou preferências do cliente para a renovação..."
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={postSaleNotes}
                    onChange={(event) => setPostSaleNotes(event.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => onOpenChange(false)}
                className="h-9 text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={pending || !policyNumber || !coverageStartDate || !approvedValue || !confirmationDocumentId}
                onClick={submit}
                className="h-9 text-xs gap-1.5 font-semibold"
              >
                {pending ? "Processando..." : "Confirmar Venda & Agendar Renovação"}
              </Button>
            </div>
          </div>
        </DialogPanel>
      </DialogPopup>
    </Dialog>
  );
}
