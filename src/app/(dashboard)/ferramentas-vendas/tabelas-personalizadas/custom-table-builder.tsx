"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { formatCurrency } from "@/features/quotes/utils";
import {
  ArrowLeft,
  ArrowRight,
  Calculator,
  CheckCircle,
  Compass,
  FileArrowDown,
  FileText,
  SlidersHorizontal,
  SquaresFour,
  Users,
} from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCustomTablePricesAction, type CustomTableData } from "@/features/sales-tools/actions";

// ──────────────────────────────────────── Data Constants
const AGE_BANDS = [
  "0 a 18",
  "19 a 23",
  "24 a 28",
  "29 a 33",
  "34 a 38",
  "39 a 43",
  "44 a 48",
  "49 a 53",
  "54 a 58",
  "59+",
];

const RAMOS = [
  { value: "saude_individual", label: "Plano de Saúde Individual" },
  { value: "saude_familiar", label: "Plano de Saúde Familiar" },
  { value: "saude_adesao", label: "Plano de Saúde Coletivo por Adesão" },
  { value: "saude_pme", label: "Plano de Saúde PME/Empresarial" },
  { value: "odonto_individual", label: "Plano Odontológico Individual" },
  { value: "odonto_familiar", label: "Plano Odontológico Familiar" },
  { value: "odonto_pme", label: "Plano Odontológico PME" },
];

const ESTADOS = [
  { value: "AC", label: "Acre" },
  { value: "AL", label: "Alagoas" },
  { value: "AP", label: "Amapá" },
  { value: "AM", label: "Amazonas" },
  { value: "BA", label: "Bahia" },
  { value: "CE", label: "Ceará" },
  { value: "DF", label: "Distrito Federal" },
  { value: "ES", label: "Espírito Santo" },
  { value: "GO", label: "Goiás" },
  { value: "MA", label: "Maranhão" },
  { value: "MT", label: "Mato Grosso" },
  { value: "MS", label: "Mato Grosso do Sul" },
  { value: "MG", label: "Minas Gerais" },
  { value: "PA", label: "Pará" },
  { value: "PB", label: "Paraíba" },
  { value: "PR", label: "Paraná" },
  { value: "PE", label: "Pernambuco" },
  { value: "PI", label: "Piauí" },
  { value: "RJ", label: "Rio de Janeiro" },
  { value: "RN", label: "Rio Grande do Norte" },
  { value: "RS", label: "Rio Grande do Sul" },
  { value: "RO", label: "Rondônia" },
  { value: "RR", label: "Roraima" },
  { value: "SC", label: "Santa Catarina" },
  { value: "SP", label: "São Paulo" },
  { value: "SE", label: "Sergipe" },
  { value: "TO", label: "Tocantins" },
];

const COBERTURA_OPTIONS = [
  { value: "todas", label: "Todas as abrangências" },
  { value: "nacional", label: "Nacional" },
  { value: "estadual", label: "Estadual" },
  { value: "regional", label: "Regional" },
  { value: "municipal", label: "Municipal" },
];

const COPART_OPTIONS = [
  { value: "todos", label: "Com e sem coparticipação" },
  { value: "sem_copart", label: "Sem coparticipação" },
  { value: "com_copart", label: "Com coparticipação" },
];

// ──────────────────────────────────────── Types
type Carrier = { id: string; name: string };
type Plan = {
  id: string;
  carrierId: string;
  carrierName: string;
  name: string;
  type: string;
  coverage: string | null;
  maxEntryAge: number | null;
};

// ──────────────────────────────────────── Helpers


function isOdontoRamo(ramo: string): boolean {
  return ramo.startsWith("odonto");
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

// ──────────────────────────────────────── Component
export function CustomTableBuilder({
  carriers,
  plans,
}: {
  carriers: Carrier[];
  plans: Plan[];
}) {
  const [pending, startTransition] = useTransition();

  // Step navigation
  const [step, setStep] = useState<"params" | "plans" | "result">("params");

  // Form params
  const [ramo, setRamo] = useState("");
  const [estado, setEstado] = useState("");
  const [cobertura, setCobertura] = useState("todas");
  const [coparticipacao, setCoparticipacao] = useState("todos");

  // Selected carriers & plans
  const [selectedCarrierIds, setSelectedCarrierIds] = useState<string[]>([]);
  const [selectedPlanIds, setSelectedPlanIds] = useState<string[]>([]);

  // Life distribution (for per-plan price calculation)
  const [lives, setLives] = useState<Record<string, number>>({});

  // Result data
  const [tableData, setTableData] = useState<CustomTableData | null>(null);

  // ─── Derived state ──────────────────────

  // Filter plans by coverage selection
  const coverageFilteredPlans = useMemo(() => {
    return plans.filter((plan) => {
      if (cobertura === "todas") return true;
      const cov = normalizeText(plan.coverage ?? "");
      // Match against known coverage patterns
      const matchesNacional = cobertura === "nacional" && (cov.includes("nacional") || cov.includes("nac") || plan.coverage === "Nacional");
      const matchesEstadual = cobertura === "estadual" && (cov.includes("estadual") || cov.includes("estado") || plan.coverage === "Estadual");
      const matchesRegional = cobertura === "regional" && (cov.includes("regional") || cov.includes("grupo") || plan.coverage === "Regional");
      const matchesMunicipal = cobertura === "municipal" && (cov.includes("municipal") || cov.includes("local") || plan.coverage === "Municipal");
      return matchesNacional || matchesEstadual || matchesRegional || matchesMunicipal;
    });
  }, [plans, cobertura]);

  // Filter by plan type (saude / odonto) and coparticipação
  const typeFilteredPlans = useMemo(() => {
    return coverageFilteredPlans.filter((plan) => {
      const dn = isOdontoRamo(ramo);
      const nameLower = normalizeText(plan.name);
      const carrierLower = normalizeText(plan.carrierName);
      const isDental =
        nameLower.includes("odonto") ||
        nameLower.includes("dental") ||
        carrierLower.includes("odonto") ||
        carrierLower.includes("dental");

      // Apply coparticipação filter based on plan name
      if (coparticipacao === "com_copart" && !nameLower.includes("copart")) return false;
      if (coparticipacao === "sem_copart" && nameLower.includes("copart")) return false;

      return dn ? isDental : !isDental;
    });
  }, [coverageFilteredPlans, ramo, coparticipacao]);

  // Only show plans from selected carriers
  const visiblePlans = useMemo(() => {
    if (selectedCarrierIds.length === 0) return typeFilteredPlans;
    return typeFilteredPlans.filter((p) => selectedCarrierIds.includes(p.carrierId));
  }, [typeFilteredPlans, selectedCarrierIds]);

  // Selected carriers that have plans available
  const availableCarriers = useMemo(() => {
    const carrierIdsInPlans = new Set(typeFilteredPlans.map((p) => p.carrierId));
    return carriers.filter((c) => carrierIdsInPlans.has(c.id));
  }, [carriers, typeFilteredPlans]);

  // Total lives
  const totalLives = Object.values(lives).reduce((a, b) => a + b, 0);

  // Validation
  const paramsValid = ramo && estado;
  const plansValid = selectedPlanIds.length > 0;

  function toggleCarrier(carrierId: string) {
    setSelectedCarrierIds((prev) =>
      prev.includes(carrierId)
        ? prev.filter((id) => id !== carrierId)
        : [...prev, carrierId],
    );
  }

  function togglePlan(planId: string) {
    setSelectedPlanIds((prev) =>
      prev.includes(planId)
        ? prev.filter((id) => id !== planId)
        : [...prev, planId],
    );
  }

  function selectAllPlans() {
    setSelectedPlanIds(visiblePlans.map((p) => p.id));
  }

  function deselectAllPlans() {
    setSelectedPlanIds([]);
  }

  function handleGenerateTable() {
    if (selectedPlanIds.length === 0) {
      toast.error("Selecione pelo menos um plano para gerar a tabela.");
      return;
    }

    startTransition(async () => {
      const result = await getCustomTablePricesAction(selectedPlanIds);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (result.data) {
        setTableData(result.data);
        setStep("result");
      }
    });
  }

  function handlePrint() {
    window.print();
  }

  function handleDownloadPDF() {
    const planIdsParam = selectedPlanIds.join(",");
    window.open(
      `/api/ferramentas-vendas/tabelas-personalizadas/pdf?planIds=${encodeURIComponent(planIdsParam)}`,
      "_blank",
    );
  }

  function handleBackToPlans() {
    setStep("plans");
  }

  function handleBackToParams() {
    setStep("params");
  }

  function resetAll() {
    setRamo("");
    setEstado("");
    setCobertura("todas");
    setCoparticipacao("todos");
    setSelectedCarrierIds([]);
    setSelectedPlanIds([]);
    setLives({});
    setTableData(null);
    setStep("params");
  }

  // ─── Render ────────────────────────────

  return (
    <div className="w-full space-y-6">
      {/* Step indicators */}
      <div className="flex items-center gap-2 border-b border-border pb-4">
        {[
          { key: "params", label: "Parâmetros" },
          { key: "plans", label: "Planos" },
          { key: "result", label: "Tabela" },
        ].map((s, i) => {
          const isActive = step === s.key;
          const isDone =
            (s.key === "params" && paramsValid) ||
            (s.key === "plans" && plansValid) ||
            (s.key === "result" && tableData !== null);
          return (
            <div key={s.key} className="flex items-center gap-2">
              {i > 0 && <div className="h-px w-6 bg-border" />}
              <span
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold tracking-wider transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : isDone
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {isDone && s.key !== step ? (
                  <CheckCircle className="size-3.5" />
                ) : (
                  <span className="grid size-3.5 place-items-center text-[10px] font-bold">
                    {i + 1}
                  </span>
                )}
                {s.label}
              </span>
            </div>
          );
        })}
        {(step === "params" || step === "plans") && (
          <button
            type="button"
            onClick={resetAll}
            className="ml-auto text-[10px] font-semibold text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Limpar tudo
          </button>
        )}
      </div>

      {/* ═══════════ Step 1: Parâmetros ═══════════ */}
      {step === "params" && (
        <Card className="border-border/80 bg-card shadow-none">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                <SlidersHorizontal className="size-5" />
              </span>
              <div>
                <CardTitle className="text-base font-bold text-foreground">
                  1. Parâmetros da Tabela
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Defina o ramo, estado e filtros da tabela personalizada.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 pt-2">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Ramo */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase">
                  Ramo
                </Label>
                <Select value={ramo} onValueChange={(val) => setRamo(val ?? "")}>
                  <SelectTrigger className="h-10 w-full text-xs">
                    <SelectValue placeholder="Selecione o ramo" />
                  </SelectTrigger>
                  <SelectContent>
                    {RAMOS.map((item) => (
                      <SelectItem key={item.value} value={item.value} className="text-xs">
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Estado */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase">
                  Estado de referência
                </Label>
                <Select value={estado} onValueChange={(val) => setEstado(val ?? "")}>
                  <SelectTrigger className="h-10 w-full text-xs">
                    <SelectValue placeholder="Selecione o estado" />
                  </SelectTrigger>
                  <SelectContent>
                    {ESTADOS.map((item) => (
                      <SelectItem key={item.value} value={item.value} className="text-xs">
                        {item.label} ({item.value})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Cobertura */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase">
                  Abrangência
                </Label>
                <Select value={cobertura} labels={Object.fromEntries(COBERTURA_OPTIONS.map((o) => [o.value, o.label]))} onValueChange={(val) => setCobertura(val ?? "todas")}>
                  <SelectTrigger className="h-10 w-full text-xs">
                    <SelectValue placeholder="Filtrar por abrangência" />
                  </SelectTrigger>
                  <SelectContent>
                    {COBERTURA_OPTIONS.map((item) => (
                      <SelectItem key={item.value} value={item.value} className="text-xs">
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Coparticipação */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase">
                  Coparticipação
                </Label>
                <Select
                  value={coparticipacao}
                  labels={Object.fromEntries(COPART_OPTIONS.map((o) => [o.value, o.label]))}
                  onValueChange={(val) => setCoparticipacao(val ?? "todos")}
                >
                  <SelectTrigger className="h-10 w-full text-xs">
                    <SelectValue placeholder="Filtrar coparticipação" />
                  </SelectTrigger>
                  <SelectContent>
                    {COPART_OPTIONS.map((item) => (
                      <SelectItem key={item.value} value={item.value} className="text-xs">
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Lives Input */}
            <div className="border-t border-border/50 pt-4">
              <div className="mb-3 flex items-center gap-2">
                <Users className="size-4 text-muted-foreground" />
                <span className="text-xs font-bold text-muted-foreground uppercase">
                  Vidas por faixa etária
                </span>
                {totalLives > 0 && (
                  <Badge variant="outline" className="ml-auto text-xs tabular-nums">
                    {totalLives} {totalLives === 1 ? "vida" : "vidas"}
                  </Badge>
                )}
              </div>
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-5">
                {AGE_BANDS.map((ageBand) => (
                  <div key={ageBand} className="space-y-1">
                    <Label
                      htmlFor={`lives-${ageBand}`}
                      className="text-[10px] text-muted-foreground uppercase font-bold"
                    >
                      {ageBand} anos
                    </Label>
                    <Input
                      id={`lives-${ageBand}`}
                      type="number"
                      min={0}
                      value={lives[ageBand] ?? 0}
                      onChange={(e) =>
                        setLives((prev) => ({
                          ...prev,
                          [ageBand]: Math.max(0, Number(e.target.value) || 0),
                        }))
                      }
                      className="h-9 text-xs font-semibold tabular-nums"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end border-t border-border/50 pt-4">
              <Button
                size="lg"
                disabled={!paramsValid}
                onClick={() => setStep("plans")}
                className="w-full sm:w-auto gap-2 font-semibold"
              >
                Selecionar Planos <ArrowRight className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══════════ Step 2: Seleção de Planos ═══════════ */}
      {step === "plans" && (
        <div className="grid gap-6 xl:grid-cols-[20rem_minmax(0,1fr)]">
          {/* Carrier sidebar */}
          <Card className="h-fit border-border/80 bg-card shadow-none">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <SquaresFour className="size-4 text-muted-foreground" />
                <CardTitle className="text-xs font-bold uppercase text-muted-foreground">
                  Operadoras
                </CardTitle>
              </div>
              <CardDescription className="text-[10px]">
                Selecione as operadoras para filtrar os planos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1.5 pt-0">
              <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border/60 px-3 py-2.5 text-xs font-medium transition-colors hover:bg-muted/40">
                <Checkbox
                  checked={selectedCarrierIds.length === availableCarriers.length}
                  onCheckedChange={() => {
                    if (selectedCarrierIds.length === availableCarriers.length) {
                      setSelectedCarrierIds([]);
                    } else {
                      setSelectedCarrierIds(availableCarriers.map((c) => c.id));
                    }
                  }}
                />
                <span>Todas as operadoras</span>
                <span className="ml-auto text-muted-foreground tabular-nums">
                  {availableCarriers.length}
                </span>
              </label>
              {availableCarriers.map((carrier) => (
                <label
                  key={carrier.id}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border/40 px-3 py-2 text-xs transition-colors hover:bg-muted/30"
                >
                  <Checkbox
                    checked={selectedCarrierIds.includes(carrier.id)}
                    onCheckedChange={() => toggleCarrier(carrier.id)}
                  />
                  <span className="truncate">{carrier.name}</span>
                  <span className="ml-auto text-muted-foreground tabular-nums">
                    {typeFilteredPlans.filter((p) => p.carrierId === carrier.id).length}
                  </span>
                </label>
              ))}
              {availableCarriers.length === 0 && (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  Nenhuma operadora disponível para os parâmetros selecionados.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Plans area */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <p className="text-xs font-bold text-foreground uppercase">
                  Planos disponíveis
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {visiblePlans.length}{" "}
                  {visiblePlans.length === 1 ? "plano encontrado" : "planos encontrados"}
                  {selectedCarrierIds.length > 0
                    ? ` (${selectedCarrierIds.length} operadora${selectedCarrierIds.length > 1 ? "s" : ""})`
                    : ""}
                </p>
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={selectAllPlans}
                  className="rounded-md px-2.5 py-1 text-[10px] font-semibold text-primary underline underline-offset-2 hover:text-primary/80"
                >
                  Selecionar todos
                </button>
                <button
                  type="button"
                  onClick={deselectAllPlans}
                  className="rounded-md px-2.5 py-1 text-[10px] font-semibold text-muted-foreground underline underline-offset-2 hover:text-foreground"
                >
                  Limpar
                </button>
              </div>
            </div>

            {visiblePlans.length === 0 ? (
              <div className="flex flex-col items-center rounded-xl border border-dashed px-6 py-12 text-center">
                <Compass className="mb-2 size-8 text-muted-foreground/40" />
                <p className="text-sm font-medium text-muted-foreground">
                  Nenhum plano encontrado
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Tente alterar os filtros ou selecionar outras operadoras.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={handleBackToParams}
                >
                  <ArrowLeft className="size-3.5" /> Voltar aos parâmetros
                </Button>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {visiblePlans.map((plan) => {
                  const selected = selectedPlanIds.includes(plan.id);
                  return (
                    <label
                      key={plan.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-all duration-150 ${
                        selected
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border/60 bg-card hover:bg-muted/30 hover:border-border"
                      }`}
                    >
                      <Checkbox
                        checked={selected}
                        onCheckedChange={() => togglePlan(plan.id)}
                        className="mt-0.5"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-foreground">{plan.name}</p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          {plan.carrierName}
                        </p>
                        {plan.coverage && (
                          <p className="mt-0.5 text-[10px] text-muted-foreground/70">
                            {plan.coverage}
                          </p>
                        )}
                        <Badge variant="outline" className="mt-1.5 text-[9px] uppercase">
                          {plan.type}
                        </Badge>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}

            {/* Navigation buttons */}
            <div className="flex items-center justify-between border-t border-border pt-4">
              <Button variant="outline" size="sm" onClick={handleBackToParams}>
                <ArrowLeft className="size-3.5" /> Parâmetros
              </Button>
              <Button
                size="lg"
                disabled={!plansValid}
                onClick={handleGenerateTable}
                className="gap-2 font-semibold"
              >
                {pending ? (
                  <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <Calculator className="size-4" />
                )}
                Gerar Tabela
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ Step 3: Resultado ═══════════ */}
      {step === "result" && tableData && (
        <div className="space-y-6">
          {/* Actions bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
                <SquaresFour className="size-5" />
              </span>
              <div>
                <p className="text-sm font-bold text-foreground">
                  Tabela Personalizada — {tableData.plans.length}{" "}
                  {tableData.plans.length === 1 ? "plano" : "planos"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {RAMOS.find((r) => r.value === ramo)?.label ?? "Plano de Saúde"} ·{" "}
                  {ESTADOS.find((e) => e.value === estado)?.label ?? estado}
                  {totalLives > 0 ? ` · ${totalLives} ${totalLives === 1 ? "vida" : "vidas"}` : ""}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleBackToPlans}>
                <ArrowLeft className="size-3.5" /> Alterar planos
              </Button>
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <FileArrowDown className="size-3.5 rotate-90" /> Imprimir
              </Button>
              <Button variant="default" size="sm" onClick={handleDownloadPDF}>
                <FileArrowDown className="size-3.5" /> Baixar PDF
              </Button>
            </div>
          </div>

          {/* ─── Price Table ─── */}
          <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-none @container"
          >
            <div className="min-w-[48rem] p-1">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-36 pl-5 text-[10px] font-bold uppercase text-muted-foreground">
                      Operadora
                    </TableHead>
                    <TableHead className="w-48 text-[10px] font-bold uppercase text-muted-foreground">
                      Plano
                    </TableHead>
                    <TableHead className="w-24 text-[10px] font-bold uppercase text-muted-foreground">
                      Abrangência
                    </TableHead>
                    {tableData.allAgeBands.map((band) => (
                      <TableHead
                        key={band}
                        className="min-w-[5.5rem] text-right text-[10px] font-bold uppercase text-muted-foreground"
                      >
                        {band}
                      </TableHead>
                    ))}
                    <TableHead className="min-w-[5.5rem] pr-5 text-right text-[10px] font-bold uppercase text-primary">
                      Total/mês
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableData.plans.map((plan) => {
                    const planTotal = plan.prices.reduce((sum, price) => {
                      const qty = lives[price.ageBand] ?? 0;
                      return sum + price.monthlyPrice * qty;
                    }, 0);

                    return (
                      <TableRow
                        key={plan.id}
                        className="group transition-colors hover:bg-muted/20"
                      >
                        <TableCell className="pl-5 text-xs font-semibold text-foreground/80">
                          {plan.carrierName}
                        </TableCell>
                        <TableCell className="max-w-48">
                          <p className="truncate text-xs font-semibold text-foreground">
                            {plan.name}
                          </p>
                          <Badge
                            variant="outline"
                            className="mt-0.5 text-[9px] leading-none capitalize"
                          >
                            {plan.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-[11px] text-muted-foreground">
                          {plan.coverage ?? "—"}
                        </TableCell>
                        {tableData.allAgeBands.map((band) => {
                          const price = plan.prices.find((p) => p.ageBand === band);
                          return (
                            <TableCell
                              key={band}
                              className="text-right font-mono text-xs tabular-nums text-foreground"
                            >
                              {price && price.monthlyPrice > 0
                                ? formatCurrency(price.monthlyPrice)
                                : "—"}
                            </TableCell>
                          );
                        })}
                        <TableCell className="pr-5 text-right font-mono text-sm font-bold text-primary tabular-nums">
                          {planTotal > 0 ? formatCurrency(planTotal) : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Table info footer */}
          <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-4 py-3">
            <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
              <span>
                <strong className="text-foreground">{tableData.plans.length}</strong>{" "}
                {tableData.plans.length === 1 ? "plano listado" : "planos listados"}
              </span>
              <span>
                <strong className="text-foreground">{tableData.allAgeBands.length}</strong> faixas
                etárias
              </span>
              {totalLives > 0 && (
                <span>
                  <strong className="text-foreground">{totalLives}</strong>{" "}
                  {totalLives === 1 ? "vida considerada" : "vidas consideradas"}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <FileText className="size-3" />
              <span>Valores de referência sujeitos a análise de crédito das operadoras.</span>
            </div>
          </div>

          {/* Create another table */}
          <div className="flex justify-center border-t border-border pt-6">
            <Button variant="outline" onClick={resetAll} className="gap-2">
              <Compass className="size-4" /> Criar nova tabela
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
