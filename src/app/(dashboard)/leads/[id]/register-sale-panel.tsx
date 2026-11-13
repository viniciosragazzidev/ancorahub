"use client";

import { useMemo, useState, useTransition, type ComponentType, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/sonner";
import { useSuccessOverlay } from "@/components/motion/success-overlay";

import {
  Buildings,
  CalendarBlank,
  Check,
  ChevronDownIcon,
  ChevronRightIcon,
  CreditCard,
  FileText,
  SealCheck,
  XIcon,
} from "@/components/huge-icons";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppSelect } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogClose, DialogDescription, DialogPanel, DialogPopup, DialogTitle } from "@/components/ui/dialog";
import { registerSaleAction } from "@/features/post-sale/actions";
import { cn } from "@/lib/utils";

type CarrierOption = { id: string; name: string };
type ConfirmationDocument = { id: string; filename: string; status: string };
type PaymentMethod = "boleto" | "debito_automatico" | "cartao_credito" | "desconto_folha" | "outro";
type RenewalType = "reajuste_operadora" | "portabilidade" | "manutencao" | "nova_contratacao";

const CONTRACT_TERMS = [
  { value: 12, label: "12 meses" },
  { value: 24, label: "24 meses" },
  { value: 36, label: "36 meses" },
] as const;

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "boleto", label: "Boleto bancário" },
  { value: "debito_automatico", label: "Débito automático" },
  { value: "cartao_credito", label: "Cartão de crédito" },
  { value: "desconto_folha", label: "Desconto em folha" },
  { value: "outro", label: "Outro" },
];

const RENEWAL_TYPES: { value: RenewalType; label: string }[] = [
  { value: "reajuste_operadora", label: "Reajuste anual da operadora" },
  { value: "portabilidade", label: "Portabilidade ou troca de plano" },
  { value: "manutencao", label: "Manutenção do plano atual" },
  { value: "nova_contratacao", label: "Nova contratação" },
];

const CONTACT_PREFERENCES = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "phone", label: "Ligação telefônica" },
  { value: "email", label: "E-mail" },
];

const DOCUMENT_STATUS_LABEL: Record<string, string> = {
  approved: "Aprovado",
  pending: "Aguardando aprovação",
  rejected: "Rejeitado",
};

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

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  if (!year || !month || !day) return "";
  return `${day}/${month}/${year}`;
}

/** Cartão clicável da grade 2x2: ícone, título, chevron e o valor escolhido. Abre um seletor em popover. */
function PickerCard({
  icon: Icon,
  title,
  value,
  placeholder,
  hint,
  hintTone = "muted",
  disabled,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  value?: string;
  placeholder: string;
  hint?: string;
  hintTone?: "muted" | "warning";
  disabled?: boolean;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        aria-label={`${title}: ${value || placeholder}`}
        className={cn(
          "group flex min-h-[5.5rem] w-full min-w-0 flex-col items-start gap-1.5 rounded-[var(--radius-card)] border border-border bg-card p-3 text-left outline-none transition-colors",
          "hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50 data-[popup-open]:border-foreground/40",
          "disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none",
        )}
      >
        <span className="flex w-full items-center gap-1.5">
          <Icon className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{title}</span>
          <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[popup-open]:rotate-90 motion-reduce:transition-none" />
        </span>
        <span className={cn("w-full truncate text-sm", value ? "text-foreground" : "text-muted-foreground")}>
          {value || placeholder}
        </span>
        {hint ? (
          <span
            className={cn(
              "w-full text-[11px] leading-snug",
              hintTone === "warning" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground",
            )}
          >
            {hint}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-1.5">
        {children(() => setOpen(false))}
      </PopoverContent>
    </Popover>
  );
}

/** Opção de lista dentro do popover de um cartão. */
function PickerOption({
  selected,
  disabled,
  label,
  description,
  onSelect,
}: {
  selected: boolean;
  disabled?: boolean;
  label: string;
  description?: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-2 rounded-[var(--radius-control)] px-2.5 py-2 text-left text-sm outline-none transition-colors",
        "hover:bg-muted focus-visible:bg-muted disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none",
        selected && "bg-muted font-medium",
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate">{label}</span>
        {description ? <span className="block text-[11px] text-muted-foreground">{description}</span> : null}
      </span>
      {selected ? <Check className="size-4 shrink-0" /> : null}
    </button>
  );
}

export function RegisterSalePanel({
  leadId,
  documents,
  carriers,
  open,
  onOpenChange,
  onRegistered,
}: {
  leadId: string;
  documents: ConfirmationDocument[];
  carriers: CarrierOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Chamado depois que a venda é salva (a tela Lite mantém o status em estado local). */
  onRegistered?: () => void;
}) {
  const { celebrate: celebrateSuccess, node: successOverlay } = useSuccessOverlay();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [policyNumber, setPolicyNumber] = useState("");
  const [coverageStartDate, setCoverageStartDate] = useState("");
  const [contractTermMonths, setContractTermMonths] = useState<number>(12);
  const [customExpirationDate, setCustomExpirationDate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("boleto");
  const [renewalType, setRenewalType] = useState<RenewalType>("reajuste_operadora");
  const [renewalContactPreference, setRenewalContactPreference] = useState("whatsapp");
  const [postSaleNotes, setPostSaleNotes] = useState("");
  const [approvedValue, setApprovedValue] = useState("");
  const [carrierId, setCarrierId] = useState("");
  const [confirmationDocumentId, setConfirmationDocumentId] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);

  const approvedDocuments = documents.filter((document) => document.status === "approved");
  const selectedCarrier = carriers.find((carrier) => carrier.id === carrierId);
  const selectedDocument = documents.find((document) => document.id === confirmationDocumentId);
  const selectedPayment = PAYMENT_METHODS.find((method) => method.value === paymentMethod);

  const computedExpirationDate = useMemo(() => {
    if (customExpirationDate) return customExpirationDate;
    return addMonths(coverageStartDate, contractTermMonths);
  }, [coverageStartDate, contractTermMonths, customExpirationDate]);

  const missingFields = [
    !approvedValue && "valor",
    !policyNumber && "apólice",
    !coverageStartDate && "início da vigência",
    !confirmationDocumentId && "confirmação da operadora",
  ].filter(Boolean) as string[];

  const confirmationHint =
    documents.length === 0
      ? "Anexe a confirmação na seção de documentos."
      : approvedDocuments.length === 0
        ? "Nenhum documento aprovado ainda. Solicite a aprovação do gestor."
        : undefined;

  function submit() {
    if (pending) return;
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof registerSaleAction>>;
      try {
        result = await registerSaleAction({
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
      } catch {
        // Queda de rede ou deploy no meio: a venda pode ou não ter sido salva; a atualização mostra qual.
        toast.error("Não foi possível confirmar o registro. Atualize a página para ver se a venda entrou antes de tentar de novo.");
        return;
      }

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success("Venda registrada com ciclo de vida e lembretes de renovação agendados!");
      celebrateSuccess("Venda registrada");
      onOpenChange(false);
      onRegistered?.();
      setTimeout(() => router.refresh(), 0);
    });
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup
        key={open ? "open" : "closed"}
        className={cn(
          "max-h-[min(92dvh,48rem)] max-w-lg overflow-y-auto",
          // No celular vira uma folha inferior, como um lançamento rápido.
          "max-sm:top-auto max-sm:bottom-0 max-sm:w-full max-sm:translate-y-0 max-sm:rounded-b-none max-sm:pb-[calc(var(--size-spacing-05)+env(safe-area-inset-bottom))]",
        )}
      >
        <DialogPanel className="gap-5">
          <div aria-hidden="true" className="mx-auto -mt-1 h-1 w-10 rounded-full bg-muted sm:hidden" />

          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-0.5">
              <DialogTitle className="text-lg font-semibold">Nova venda</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Confirme o contrato para converter o lead e agendar a renovação.
              </DialogDescription>
            </div>
            <DialogClose
              render={<Button type="button" variant="ghost" size="icon-sm" aria-label="Fechar" disabled={pending} />}
            >
              <XIcon className="size-4" />
            </DialogClose>
          </div>

          {/* Valor em destaque */}
          <div className="space-y-1 text-center">
            <Label
              htmlFor="approved-value"
              className="justify-center text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
            >
              Mensalidade aprovada
            </Label>
            <CurrencyInput id="approved-value" size="hero" placeholder="0,00" value={approvedValue} onChange={setApprovedValue} />
          </div>

          {/* Vigência do contrato como seletor segmentado */}
          <Tabs
            variant="segment"
            value={String(contractTermMonths)}
            onValueChange={(value) => setContractTermMonths(Number(value))}
          >
            <TabsList aria-label="Vigência do contrato" className="grid w-full grid-cols-3 bg-muted/60 p-1">
              {CONTRACT_TERMS.map((term) => (
                <TabsTrigger key={term.value} value={String(term.value)} className="w-full px-2">
                  {term.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {/* Apólice com ícone à esquerda */}
          <div className="flex items-center gap-3 rounded-[var(--radius-card)] border border-border bg-card p-2 focus-within:ring-3 focus-within:ring-ring/50">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-muted text-muted-foreground">
              <FileText className="size-4" />
            </span>
            <Label htmlFor="policy-number" className="sr-only">
              Número da apólice ou contrato
            </Label>
            <Input
              id="policy-number"
              value={policyNumber}
              onChange={(event) => setPolicyNumber(event.target.value)}
              placeholder="Número da apólice ou contrato"
              className="h-9 border-0 bg-transparent px-1 text-base shadow-none focus-visible:ring-0 dark:bg-transparent"
            />
          </div>

          {/* Grade 2x2 de escolhas */}
          <div className="grid grid-cols-2 gap-3">
            <PickerCard
              icon={Buildings}
              title="Operadora"
              value={selectedCarrier?.name}
              placeholder={carriers.length ? "Escolher" : "Nenhuma cadastrada"}
              disabled={carriers.length === 0}
            >
              {(close) => (
                <div role="listbox" aria-label="Operadora" className="max-h-64 overflow-y-auto">
                  <PickerOption
                    selected={!carrierId}
                    label="Não informar"
                    onSelect={() => {
                      setCarrierId("");
                      close();
                    }}
                  />
                  {carriers.map((carrier) => (
                    <PickerOption
                      key={carrier.id}
                      selected={carrier.id === carrierId}
                      label={carrier.name}
                      onSelect={() => {
                        setCarrierId(carrier.id);
                        close();
                      }}
                    />
                  ))}
                </div>
              )}
            </PickerCard>

            <PickerCard
              icon={SealCheck}
              title="Confirmação"
              value={selectedDocument?.filename}
              placeholder="Escolher documento"
              hint={selectedDocument ? "Aprovada pelo gestor" : confirmationHint}
              hintTone={selectedDocument ? "muted" : "warning"}
            >
              {(close) =>
                documents.length === 0 ? (
                  <p className="px-2.5 py-2 text-xs text-muted-foreground">
                    Nenhum documento encontrado. Anexe a confirmação na seção de documentos.
                  </p>
                ) : (
                  <div role="listbox" aria-label="Confirmação da operadora" className="max-h-64 overflow-y-auto">
                    {documents.map((doc) => (
                      <PickerOption
                        key={doc.id}
                        selected={doc.id === confirmationDocumentId}
                        disabled={doc.status !== "approved"}
                        label={doc.filename}
                        description={DOCUMENT_STATUS_LABEL[doc.status] ?? doc.status}
                        onSelect={() => {
                          setConfirmationDocumentId(doc.id);
                          close();
                        }}
                      />
                    ))}
                  </div>
                )
              }
            </PickerCard>

            <PickerCard
              icon={CalendarBlank}
              title="Início"
              value={coverageStartDate ? formatDate(coverageStartDate) : undefined}
              placeholder="Escolher data"
              hint={computedExpirationDate ? `Vence em ${formatDate(computedExpirationDate)}` : undefined}
            >
              {(close) => (
                <div className="space-y-2 p-1.5">
                  <Label htmlFor="coverage-start-date" className="text-xs">
                    Início da vigência
                  </Label>
                  <Input
                    id="coverage-start-date"
                    type="date"
                    autoFocus
                    value={coverageStartDate}
                    onChange={(event) => setCoverageStartDate(event.target.value)}
                    className="h-9 text-sm"
                  />
                  <Button type="button" variant="outline" size="sm" className="w-full" onClick={close}>
                    Pronto
                  </Button>
                </div>
              )}
            </PickerCard>

            <PickerCard icon={CreditCard} title="Pagamento" value={selectedPayment?.label} placeholder="Escolher">
              {(close) => (
                <div role="listbox" aria-label="Forma de pagamento">
                  {PAYMENT_METHODS.map((method) => (
                    <PickerOption
                      key={method.value}
                      selected={method.value === paymentMethod}
                      label={method.label}
                      onSelect={() => {
                        setPaymentMethod(method.value);
                        close();
                      }}
                    />
                  ))}
                </div>
              )}
            </PickerCard>
          </div>

          {/* Mais opções recolhidas */}
          <div className="border-t border-border pt-1">
            <button
              type="button"
              aria-expanded={moreOpen}
              aria-controls="register-sale-more"
              onClick={() => setMoreOpen((value) => !value)}
              className="flex w-full items-center justify-between gap-3 rounded-[var(--radius-control)] px-1 py-2.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="text-sm font-medium text-foreground">Mais opções</span>
              <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                <span className="truncate">Vencimento, renovação e observações</span>
                <ChevronDownIcon
                  className={cn("size-4 shrink-0 transition-transform motion-reduce:transition-none", moreOpen && "rotate-180")}
                />
              </span>
            </button>

            <div id="register-sale-more" hidden={!moreOpen} className="grid gap-3 pt-2 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="expiration-date" className="text-xs">
                  Data de vencimento (calculada)
                </Label>
                <Input
                  id="expiration-date"
                  type="date"
                  value={computedExpirationDate}
                  onChange={(event) => setCustomExpirationDate(event.target.value)}
                  className="h-9 text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="renewal-type" className="text-xs">
                  Estratégia de renovação futura
                </Label>
                <AppSelect
                  id="renewal-type"
                  value={renewalType}
                  onValueChange={(value) => setRenewalType(value as RenewalType)}
                  options={RENEWAL_TYPES}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="contact-preference" className="text-xs">
                  Canal preferencial de contato
                </Label>
                <AppSelect
                  id="contact-preference"
                  value={renewalContactPreference}
                  onValueChange={setRenewalContactPreference}
                  options={CONTACT_PREFERENCES}
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="post-sale-notes" className="text-xs">
                  Observações do pós-venda (opcional)
                </Label>
                <Textarea
                  id="post-sale-notes"
                  rows={2}
                  placeholder="Particularidades da negociação, carências especiais ou preferências do cliente para a renovação..."
                  className="text-xs"
                  value={postSaleNotes}
                  onChange={(event) => setPostSaleNotes(event.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Button
              type="button"
              size="lg"
              disabled={pending || missingFields.length > 0}
              onClick={submit}
              className="h-11 w-full font-semibold"
            >
              {pending ? "Salvando..." : "Salvar venda"}
            </Button>
            {missingFields.length > 0 ? (
              <p className="text-center text-[11px] text-muted-foreground" aria-live="polite">
                Falta preencher: {missingFields.join(", ")}.
              </p>
            ) : null}
          </div>
        </DialogPanel>
      </DialogPopup>
    </Dialog>
    {successOverlay}
    </>
  );
}
