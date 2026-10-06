"use client";

import { useMemo, useState } from "react";
import { Calculator, Check, ChevronDown, ChevronLeft, ChevronRight, Copy, FileDown, HeartPulse, MessageCircle, Plus, Search, ShieldCheck, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppSelect, type SelectOption } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { toast } from "@/components/ui/sonner";
import { AGE_BANDS, HOSPITALS, MOCK_LEADS, MOCK_PLANS, REGIONS, type Accommodation, type Copayment, type Coverage, type MockPlan, type ProfileType, type Region } from "@/features/broker-workspace/quote-simulator/mock-data";
import { calculatePlanPricing, getAgeBand, type BeneficiaryInput, type PlanPricing, type PricingPreferences } from "@/features/broker-workspace/quote-simulator/pricing";

type Step = 0 | 1 | 2 | 3 | 4 | 5;
type Beneficiary = { id: string; age: string };
type SortMode = "price" | "network" | "per-life";

const STEPS = ["Perfil", "Beneficiários", "Preferências", "Resultados", "Comparar", "Resumo"];
const PROFILE_OPTIONS: SelectOption[] = [
  { value: "individual", label: "Pessoa física" },
  { value: "family", label: "Familiar" },
  { value: "pme", label: "PME, de 2 a 29 vidas" },
  { value: "adhesion", label: "Adesão" },
];
const COVERAGE_OPTIONS: SelectOption[] = [
  { value: "regional", label: "Regional" },
  { value: "state", label: "Estadual" },
  { value: "national", label: "Nacional" },
];
const CARRIER_OPTIONS: SelectOption[] = [
  { value: "all", label: "Todas as operadoras" },
  ...Array.from(new Set(MOCK_PLANS.map((plan) => plan.carrier))).map((carrier) => ({ value: carrier, label: carrier })),
];
const ACCOMMODATION_FILTERS: SelectOption[] = [
  { value: "all", label: "Qualquer acomodação" },
  { value: "ward", label: "Enfermaria" },
  { value: "private", label: "Apartamento" },
];
const COPAYMENT_FILTERS: SelectOption[] = [
  { value: "all", label: "Qualquer coparticipação" },
  { value: "none", label: "Sem coparticipação" },
  { value: "partial", label: "Coparticipação parcial" },
  { value: "full", label: "Coparticipação total" },
];

const REGION_LABEL: Record<Region, string> = {
  "rj-capital": "Rio de Janeiro, capital",
  baixada: "Baixada Fluminense",
  "niteroi-sg": "Niterói e São Gonçalo",
  "sp-capital": "São Paulo, capital",
  other: "Outra região",
};
const ACCOMMODATION_LABEL: Record<Accommodation, string> = { ward: "Enfermaria", private: "Apartamento" };
const COPAYMENT_LABEL: Record<Copayment, string> = { none: "Sem coparticipação", partial: "Parcial", full: "Total" };
const COVERAGE_LABEL: Record<Coverage, string> = { regional: "Regional", state: "Estadual", national: "Nacional" };
const PROFILE_LABEL: Record<ProfileType, string> = {
  individual: "Pessoa física",
  family: "Familiar",
  pme: "PME",
  adhesion: "Adesão",
};

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function makeBeneficiary(): Beneficiary {
  return { id: "life-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7), age: "" };
}

function getNetworkMatch(plan: MockPlan, selectedHospitals: readonly string[]) {
  return selectedHospitals.filter((hospital) => plan.hospitals.includes(hospital)).length;
}

function ageInputs(beneficiaries: Beneficiary[]): BeneficiaryInput[] | null {
  const parsed: BeneficiaryInput[] = [];
  for (const beneficiary of beneficiaries) {
    if (!/^\d{1,3}$/.test(beneficiary.age)) return null;
    const age = Number(beneficiary.age);
    if (age < 0 || age > 120) return null;
    parsed.push({ id: beneficiary.id, age });
  }
  return parsed;
}

function PlanAgeTable({ plan, preferences }: { plan: MockPlan; preferences: PricingPreferences }) {
  return (
    <details className="mt-4 border-t border-border pt-3 text-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-medium text-foreground">
        Valores simulados por faixa etária <ChevronDown aria-hidden="true" className="size-4 shrink-0" />
      </summary>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
        {AGE_BANDS.map((band, index) => {
          const result = calculatePlanPricing(plan, preferences, [{ id: band.id, age: band.min }]);
          return (
            <div key={band.id} className="flex flex-col rounded-xl border border-border/70 px-3 py-2">
              <span className="text-xs text-muted-foreground">{band.label}</span>
              <span className="mt-1 font-semibold tabular-nums">{money(result.monthlyTotal)}</span>
              <span className="text-[11px] text-muted-foreground">índice simulado {plan.ageBandMultipliers[index].toFixed(2).replace(".", ",")}</span>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">A faixa indica uma estimativa de exemplo. A operadora define seus preços e regras contratuais.</p>
    </details>
  );
}

function PlanCard({
  plan,
  pricing,
  preferences,
  selectedHospitals,
  isCheapest,
  isMostComplete,
  isCompared,
  onCompare,
  onChoose,
}: {
  plan: MockPlan;
  pricing: PlanPricing;
  preferences: PricingPreferences;
  selectedHospitals: readonly string[];
  isCheapest: boolean;
  isMostComplete: boolean;
  isCompared: boolean;
  onCompare: (checked: boolean) => void;
  onChoose: () => void;
}) {
  const matchingHospitals = getNetworkMatch(plan, selectedHospitals);
  return (
    <Card className="gap-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-muted-foreground">{plan.carrier}</p>
          <h3 className="mt-1 text-lg font-semibold tracking-tight text-foreground">{plan.name}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{plan.tier}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {isCheapest && <Badge variant="success">Melhor custo</Badge>}
          {isMostComplete && <Badge variant="info">Mais completo</Badge>}
          {selectedHospitals.length > 0 && matchingHospitals > 0 && <Badge variant="secondary">Atende seus hospitais</Badge>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 rounded-2xl bg-muted/45 p-3">
        <div><p className="text-xs text-muted-foreground">Total estimado por mês</p><p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{money(pricing.monthlyTotal)}</p></div>
        <div><p className="text-xs text-muted-foreground">Média por vida</p><p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{money(pricing.monthlyPerLife)}</p></div>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div><dt className="text-xs text-muted-foreground">Acomodação</dt><dd className="mt-0.5 font-medium">{ACCOMMODATION_LABEL[preferences.accommodation]}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Coparticipação</dt><dd className="mt-0.5 font-medium">{COPAYMENT_LABEL[preferences.copayment]}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Abrangência</dt><dd className="mt-0.5 font-medium">{COVERAGE_LABEL[preferences.coverage]}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Odontologia</dt><dd className="mt-0.5 font-medium">{plan.dentalIncluded || preferences.includeDental ? "Incluída na estimativa" : "Não incluída"}</dd></div>
      </dl>
      <div>
        <p className="text-xs font-medium text-muted-foreground">Rede de exemplo{selectedHospitals.length > 0 ? " · " + matchingHospitals + " de " + selectedHospitals.length + " hospitais desejados" : ""}</p>
        <p className="mt-1 text-sm leading-relaxed">{plan.hospitals.join(", ")}</p>
      </div>
      <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">Carências:</span> {plan.waitingPeriodSummary}</p>
      <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">Reajuste médio de referência:</span> {plan.averageAnnualAdjustment.toFixed(1).replace(".", ",")}% ao ano, valor demonstrativo.</p>
      <PlanAgeTable plan={plan} preferences={preferences} />
      <div className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex min-h-10 items-center gap-2 text-sm">
          <Checkbox checked={isCompared} onCheckedChange={(checked) => onCompare(checked === true)} aria-label={"Comparar " + plan.name} />
          Comparar plano
        </label>
        <Button type="button" onClick={onChoose}>Escolher este plano</Button>
      </div>
    </Card>
  );
}

export function LightQuoteSimulator() {
  const [step, setStep] = useState<Step>(0);
  const [profileType, setProfileType] = useState<ProfileType>("individual");
  const [region, setRegion] = useState<Region>("rj-capital");
  const [entity, setEntity] = useState("");
  const [profession, setProfession] = useState("");
  const [mockCnpj, setMockCnpj] = useState("");
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([{ id: "titular", age: "35" }]);
  const [accommodation, setAccommodation] = useState<Accommodation>("ward");
  const [copayment, setCopayment] = useState<Copayment>("partial");
  const [coverage, setCoverage] = useState<Coverage>("regional");
  const [includeDental, setIncludeDental] = useState(false);
  const [budget, setBudget] = useState(1800);
  const [selectedHospitals, setSelectedHospitals] = useState<string[]>([]);
  const [carrierFilter, setCarrierFilter] = useState("all");
  const [accommodationFilter, setAccommodationFilter] = useState("all");
  const [copaymentFilter, setCopaymentFilter] = useState("all");
  const [sortMode, setSortMode] = useState<SortMode>("price");
  const [comparedIds, setComparedIds] = useState<string[]>([]);
  const [chosenPlanId, setChosenPlanId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [phone, setPhone] = useState("");
  const [leadSearch, setLeadSearch] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [leadLinkPreview, setLeadLinkPreview] = useState(false);

  const parsedBeneficiaries = useMemo(() => ageInputs(beneficiaries), [beneficiaries]);
  const preferences = useMemo<PricingPreferences>(() => ({
    profileType,
    region,
    accommodation,
    copayment,
    coverage,
    includeDental,
  }), [profileType, region, accommodation, copayment, coverage, includeDental]);
  const allResults = useMemo(() => {
    if (!parsedBeneficiaries) return [];
    return MOCK_PLANS
      .filter((plan) => plan.regions.includes(region)
        && plan.accommodations.includes(accommodation)
        && plan.copayments.includes(copayment)
        && plan.coverages.includes(coverage))
      .map((plan) => ({
        plan,
        pricing: calculatePlanPricing(plan, preferences, parsedBeneficiaries),
        networkMatch: getNetworkMatch(plan, selectedHospitals),
      }));
  }, [parsedBeneficiaries, region, accommodation, copayment, coverage, preferences, selectedHospitals]);
  const filteredResults = useMemo(() => {
    const sorted = allResults
      .filter(({ pricing }) => pricing.monthlyTotal <= budget)
      .filter(({ plan }) => carrierFilter === "all" || plan.carrier === carrierFilter)
      .filter(({ plan }) => accommodationFilter === "all" || plan.accommodations.includes(accommodationFilter as Accommodation))
      .filter(({ plan }) => copaymentFilter === "all" || plan.copayments.includes(copaymentFilter as Copayment));
    return sorted.sort((a, b) => {
      if (sortMode === "network") return b.networkMatch - a.networkMatch || a.pricing.monthlyTotal - b.pricing.monthlyTotal;
      if (sortMode === "per-life") return a.pricing.monthlyPerLife - b.pricing.monthlyPerLife;
      return a.pricing.monthlyTotal - b.pricing.monthlyTotal;
    });
  }, [allResults, budget, carrierFilter, accommodationFilter, copaymentFilter, sortMode]);

  const chosenResult = allResults.find(({ plan }) => plan.id === chosenPlanId);
  const comparedResults = comparedIds
    .map((id) => allResults.find(({ plan }) => plan.id === id))
    .filter((result): result is (typeof allResults)[number] => Boolean(result));
  const matchingLeads = MOCK_LEADS.filter((lead) => lead.name.toLocaleLowerCase("pt-BR").includes(leadSearch.toLocaleLowerCase("pt-BR")));
  const familyDiscount = profileType === "pme" && beneficiaries.length >= 2 ? 0.05 : 0;
  const finalMonthly = chosenResult ? Math.round(chosenResult.pricing.monthlyTotal * (1 - familyDiscount) * 100) / 100 : 0;

  function validateCurrentStep(): boolean {
    if (step === 0 && profileType === "adhesion" && (!entity.trim() || !profession.trim())) {
      setError("Informe a entidade e a profissão para o perfil de adesão.");
      return false;
    }
    if (step === 0 && profileType === "pme" && beneficiaries.length > 29) {
      setError("A demonstração de PME aceita até 29 vidas.");
      return false;
    }
    if (step === 1) {
      if (!parsedBeneficiaries || parsedBeneficiaries.length === 0) {
        setError("Informe uma idade inteira entre 0 e 120 anos para cada beneficiário.");
        return false;
      }
      if (profileType === "pme" && (parsedBeneficiaries.length < 2 || parsedBeneficiaries.length > 29)) {
        setError("Para a simulação PME, informe de 2 a 29 beneficiários.");
        return false;
      }
    }
    setError("");
    return true;
  }

  function nextStep() {
    if (!validateCurrentStep()) return;
    setStep((current) => Math.min(5, current + 1) as Step);
  }

  function toggleHospital(hospital: string, checked: boolean) {
    setSelectedHospitals((current) => checked ? [...current, hospital] : current.filter((item) => item !== hospital));
  }

  function toggleCompared(id: string, checked: boolean) {
    setComparedIds((current) => {
      if (!checked) return current.filter((item) => item !== id);
      if (current.includes(id)) return current;
      if (current.length >= 3) {
        toast.info("Compare até três planos por vez.");
        return current;
      }
      return [...current, id];
    });
  }

  function choosePlan(id: string) {
    setChosenPlanId(id);
    setStep(5);
    setError("");
  }

  function copySummary() {
    if (!chosenResult) return;
    const summary = "Simulação demonstrativa: " + chosenResult.plan.carrier + ", " + chosenResult.plan.name + ". "
      + beneficiaries.length + " vidas. Total estimado: " + money(finalMonthly) + " por mês. Valores sujeitos à análise da operadora.";
    void navigator.clipboard.writeText(summary)
      .then(() => toast.success("Resumo copiado."))
      .catch(() => toast.error("Não foi possível copiar. Selecione e copie o resumo exibido."));
  }

  function openWhatsApp() {
    if (!chosenResult) return;
    const summary = "Olá! Segue uma simulação demonstrativa de plano de saúde: "
      + chosenResult.plan.carrier + ", " + chosenResult.plan.name + ", " + beneficiaries.length
      + " vidas, total estimado de " + money(finalMonthly) + " por mês. Valores sujeitos à análise da operadora.";
    const digits = phone.replace(/\D/g, "");
    const destination = digits
      ? "https://wa.me/" + digits + "?text=" + encodeURIComponent(summary)
      : "https://wa.me/?text=" + encodeURIComponent(summary);
    window.open(destination, "_blank", "noopener,noreferrer");
  }

  function previewLeadLink() {
    if (!selectedLeadId) {
      setError("Escolha um lead de demonstração para visualizar o vínculo.");
      return;
    }
    setLeadLinkPreview(true);
    setError("");
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 pb-12 sm:px-6 lg:px-8 print:max-w-none print:px-0 print:py-0">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between print:hidden">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-primary"><Calculator aria-hidden="true" className="size-4" /> Simulador demonstrativo</div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Encontre uma opção para este perfil</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">Compare exemplos de planos a partir das idades, região e preferências informadas.</p>
        </div>
        <Badge variant="secondary" className="w-fit">Dados mocados</Badge>
      </header>

      <section aria-label="Etapas da simulação" className="mb-6 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {STEPS.map((label, index) => {
          const isCurrent = step === index;
          const isComplete = index < step;
          return (
            <button key={label} type="button" onClick={() => isComplete && setStep(index as Step)} disabled={!isComplete && !isCurrent}
              aria-current={isCurrent ? "step" : undefined}
              className={"flex min-h-12 items-center gap-2 rounded-full border px-3 py-2 text-left text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-default "
                + (isCurrent ? "border-primary bg-primary text-primary-foreground" : isComplete ? "border-primary/30 bg-primary/5 text-foreground hover:bg-primary/10" : "border-border bg-card text-muted-foreground")}>
              <span className={"grid size-6 shrink-0 place-items-center rounded-full text-[11px] "
                + (isCurrent ? "bg-primary-foreground/15 text-primary-foreground" : isComplete ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                {isComplete ? <Check aria-hidden="true" className="size-3.5" /> : index + 1}
              </span>
              <span className="truncate">{label}</span>
            </button>
          );
        })}
      </section>

      <div className="mb-5 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground" role="note">
        <p className="font-medium">Valores simulados, sujeitos à análise da operadora.</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Operadoras, planos, rede, reajustes, carências e preços são exemplos fictícios e não consultam o catálogo oficial do CorreTop. Esta simulação não é uma proposta comercial.</p>
      </div>

      {error && <p className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">{error}</p>}

      <section aria-labelledby={"step-title-" + step} className="min-w-0">
        {step === 0 && (
          <Card className="gap-5 p-4 sm:p-6">
            <div><h2 id="step-title-0" className="text-lg font-semibold">Perfil e região</h2><p className="mt-1 text-sm text-muted-foreground">Escolha o tipo de contratação para ajustar os exemplos.</p></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="profile-type">Perfil da contratação</Label><AppSelect id="profile-type" value={profileType} onValueChange={(value) => setProfileType(value as ProfileType)} options={PROFILE_OPTIONS} /></div>
              <div className="space-y-2"><Label htmlFor="region">Cidade ou região</Label><AppSelect id="region" value={region} onValueChange={(value) => setRegion(value as Region)} options={REGIONS.map(({ value, label }) => ({ value, label }))} /></div>
            </div>
            {profileType === "pme" && (
              <div className="space-y-2">
                <Label htmlFor="mock-cnpj">CNPJ (opcional, somente exemplo)</Label>
                <Input id="mock-cnpj" value={mockCnpj} onChange={(event) => setMockCnpj(event.target.value.slice(0, 18))} placeholder="00.000.000/0000-00" autoComplete="off" inputMode="numeric" />
                <p className="text-xs text-muted-foreground">Este campo não é validado nem enviado; qualquer texto é usado apenas nesta tela. A simulação PME considera de 2 a 29 vidas.</p>
              </div>
            )}
            {profileType === "adhesion" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label htmlFor="entity">Entidade ou administradora</Label><Input id="entity" value={entity} onChange={(event) => setEntity(event.target.value)} placeholder="Ex.: Qualicorp ou Allcare" autoComplete="off" /></div>
                <div className="space-y-2"><Label htmlFor="profession">Profissão ou categoria</Label><Input id="profession" value={profession} onChange={(event) => setProfession(event.target.value)} placeholder="Ex.: profissional da saúde" autoComplete="off" /></div>
                <p className="text-xs text-muted-foreground sm:col-span-2">Entidades e critérios de elegibilidade são exemplos. A operadora e a administradora confirmam a aceitação.</p>
              </div>
            )}
          </Card>
        )}

        {step === 1 && (
          <Card className="gap-5 p-4 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h2 id="step-title-1" className="text-lg font-semibold">Quem precisa de cobertura?</h2><p className="mt-1 text-sm text-muted-foreground">Informe as idades do titular e dos dependentes.</p></div>
              <Badge variant="outline">{beneficiaries.length} {beneficiaries.length === 1 ? "vida" : "vidas"}</Badge>
            </div>
            <div className="space-y-3">
              {beneficiaries.map((beneficiary, index) => {
                const parsedAge = beneficiary.age === "" ? null : Number(beneficiary.age);
                const ageBand = parsedAge !== null && Number.isInteger(parsedAge) && parsedAge >= 0 && parsedAge <= 120 ? getAgeBand(parsedAge) : null;
                return (
                  <div key={beneficiary.id} className="grid gap-3 rounded-2xl border border-border p-3 sm:grid-cols-[1fr_10rem_auto] sm:items-end">
                    <div><p className="mb-2 text-sm font-medium">{index === 0 ? "Titular" : "Dependente " + index}</p><Label htmlFor={"beneficiary-age-" + beneficiary.id}>Idade em anos</Label></div>
                    <div className="space-y-1">
                      <Input id={"beneficiary-age-" + beneficiary.id} type="number" min={0} max={120} step={1} inputMode="numeric" value={beneficiary.age} onChange={(event) => setBeneficiaries((current) => current.map((item) => item.id === beneficiary.id ? { ...item, age: event.target.value } : item))} aria-describedby={"beneficiary-band-" + beneficiary.id} placeholder="Ex.: 35" />
                      <p id={"beneficiary-band-" + beneficiary.id} className="text-xs text-muted-foreground" aria-live="polite">{ageBand ? "Faixa ANS: " + ageBand.label : "Digite uma idade de 0 a 120 anos"}</p>
                    </div>
                    {index > 0 ? <Button type="button" variant="ghost" size="icon" aria-label={"Remover dependente " + index} onClick={() => setBeneficiaries((current) => current.filter((item) => item.id !== beneficiary.id))}><Trash2 aria-hidden="true" className="size-4" /></Button> : <span className="hidden sm:block" aria-hidden="true" />}
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button type="button" variant="outline" onClick={() => setBeneficiaries((current) => [...current, makeBeneficiary()])} disabled={beneficiaries.length >= 29}><Plus aria-hidden="true" className="size-4" /> Adicionar dependente</Button>
              <p className="text-xs text-muted-foreground">A faixa etária demonstrativa segue as dez faixas da RN ANS 563/2022.</p>
            </div>
          </Card>
        )}

        {step === 2 && (
          <Card className="gap-5 p-4 sm:p-6">
            <div><h2 id="step-title-2" className="text-lg font-semibold">Preferências de cobertura</h2><p className="mt-1 text-sm text-muted-foreground">Ajuste o perfil para filtrar os exemplos disponíveis.</p></div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <fieldset className="space-y-2"><legend className="text-sm font-medium">Acomodação</legend><div className="grid grid-cols-2 gap-2">{(["ward", "private"] as const).map((value) => <Button key={value} type="button" variant={accommodation === value ? "default" : "outline"} aria-pressed={accommodation === value} onClick={() => setAccommodation(value)}>{ACCOMMODATION_LABEL[value]}</Button>)}</div></fieldset>
              <fieldset className="space-y-2"><legend className="text-sm font-medium">Coparticipação</legend><div className="grid grid-cols-3 gap-2">{(["none", "partial", "full"] as const).map((value) => <Button key={value} type="button" variant={copayment === value ? "default" : "outline"} aria-pressed={copayment === value} onClick={() => setCopayment(value)} className="px-2 text-xs">{COPAYMENT_LABEL[value]}</Button>)}</div></fieldset>
              <div className="space-y-2"><Label htmlFor="coverage">Abrangência</Label><AppSelect id="coverage" value={coverage} onValueChange={(value) => setCoverage(value as Coverage)} options={COVERAGE_OPTIONS} /></div>
            </div>
            <label className="flex min-h-11 items-center gap-3 rounded-xl border border-border px-3 py-2 text-sm"><Checkbox checked={includeDental} onCheckedChange={(checked) => setIncludeDental(checked === true)} /> Incluir odontologia na estimativa</label>
            <div className="space-y-3">
              <div><h3 className="text-sm font-semibold">Hospitais desejados</h3><p className="mt-1 text-xs text-muted-foreground">A lista serve para comparar exemplos de rede e não confirma credenciamento.</p></div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{HOSPITALS.map((hospital) => <label key={hospital} className="flex min-h-11 items-center gap-3 rounded-xl border border-border px-3 py-2 text-sm"><Checkbox checked={selectedHospitals.includes(hospital)} onCheckedChange={(checked) => toggleHospital(hospital, checked === true)} />{hospital}</label>)}</div>
            </div>
            <div className="space-y-3 rounded-2xl bg-muted/40 p-4">
              <div className="flex items-center justify-between gap-4"><Label htmlFor="budget-slider">Orçamento mensal máximo</Label><span className="font-semibold tabular-nums">{money(budget)}</span></div>
              <Slider id="budget-slider" min={300} max={6000} step={50} value={[budget]} onValueChange={(value) => setBudget(value[0] ?? budget)} aria-label="Orçamento mensal máximo" />
              <div className="flex justify-between text-xs text-muted-foreground"><span>{money(300)}</span><span>{money(6000)}</span></div>
            </div>
          </Card>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div><h2 id="step-title-3" className="text-lg font-semibold">Planos de exemplo</h2><p className="mt-1 text-sm text-muted-foreground">{PROFILE_LABEL[profileType]} · {REGION_LABEL[region]} · {beneficiaries.length} {beneficiaries.length === 1 ? "vida" : "vidas"}</p></div>
              <Button type="button" variant="outline" onClick={() => setStep(4)} disabled={comparedIds.length === 0}>Comparar selecionados ({comparedIds.length}/3)</Button>
            </div>
            <Card className="gap-4 p-4 print:hidden">
              <div className="flex items-start gap-2"><Search aria-hidden="true" className="mt-0.5 size-4 text-muted-foreground" /><div><h3 className="text-sm font-semibold">Filtrar e ordenar</h3><p className="mt-1 text-xs text-muted-foreground">Os resultados usam apenas os dados demonstrativos desta tela.</p></div></div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1.5"><Label htmlFor="carrier-filter">Operadora</Label><AppSelect id="carrier-filter" value={carrierFilter} onValueChange={setCarrierFilter} options={CARRIER_OPTIONS} size="sm" /></div>
                <div className="space-y-1.5"><Label htmlFor="accommodation-filter">Acomodação disponível</Label><AppSelect id="accommodation-filter" value={accommodationFilter} onValueChange={setAccommodationFilter} options={ACCOMMODATION_FILTERS} size="sm" /></div>
                <div className="space-y-1.5"><Label htmlFor="copayment-filter">Coparticipação disponível</Label><AppSelect id="copayment-filter" value={copaymentFilter} onValueChange={setCopaymentFilter} options={COPAYMENT_FILTERS} size="sm" /></div>
                <div className="space-y-1.5"><Label htmlFor="sort-mode">Ordenar por</Label><AppSelect id="sort-mode" value={sortMode} onValueChange={(value) => setSortMode(value as SortMode)} options={[{ value: "price", label: "Menor preço total" }, { value: "network", label: "Melhor rede desejada" }, { value: "per-life", label: "Menor valor por vida" }]} size="sm" /></div>
              </div>
              <div className="space-y-3 rounded-xl bg-muted/40 px-3 py-2.5">
                <div className="flex items-center justify-between gap-4"><Label htmlFor="budget-filter">Preço máximo</Label><span className="text-sm font-semibold tabular-nums">{money(budget)}</span></div>
                <Slider id="budget-filter" min={300} max={6000} step={50} value={[budget]} onValueChange={(value) => setBudget(value[0] ?? budget)} aria-label="Preço máximo dos resultados" />
              </div>
            </Card>
            {filteredResults.length === 0 ? (
              <Card className="items-center gap-3 px-5 py-10 text-center">
                <HeartPulse aria-hidden="true" className="size-8 text-muted-foreground" /><h3 className="font-semibold">Nenhum exemplo corresponde a estes filtros</h3>
                <p className="max-w-md text-sm text-muted-foreground">Aumente o orçamento máximo ou ajuste a região e as preferências para ver outras combinações simuladas.</p>
                <Button type="button" variant="outline" onClick={() => { setCarrierFilter("all"); setAccommodationFilter("all"); setCopaymentFilter("all"); setBudget(6000); }}>Limpar filtros</Button>
              </Card>
            ) : (
              <div className="grid min-w-0 gap-4 lg:grid-cols-2">
                {filteredResults.map(({ plan, pricing }, index) => (
                  <PlanCard key={plan.id} plan={plan} pricing={pricing} preferences={preferences} selectedHospitals={selectedHospitals}
                    isCheapest={index === 0 && sortMode === "price"}
                    isMostComplete={plan.completenessScore === Math.max(...filteredResults.map((result) => result.plan.completenessScore))}
                    isCompared={comparedIds.includes(plan.id)}
                    onCompare={(checked) => toggleCompared(plan.id, checked)}
                    onChoose={() => choosePlan(plan.id)} />
                ))}
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5">
            <div><h2 id="step-title-4" className="text-lg font-semibold">Compare até três planos</h2><p className="mt-1 text-sm text-muted-foreground">Volte aos resultados para adicionar ou remover planos da comparação.</p></div>
            {comparedResults.length === 0 ? (
              <Card className="gap-3 p-5"><p className="text-sm text-muted-foreground">Nenhum plano foi selecionado para comparação.</p><Button type="button" variant="outline" onClick={() => setStep(3)}>Ver resultados</Button></Card>
            ) : (
              <>
                <div className="hidden overflow-hidden rounded-2xl border border-border bg-card md:block">
                  <table className="w-full table-fixed border-collapse text-left text-sm">
                    <caption className="sr-only">Comparação dos planos demonstrativos selecionados</caption>
                    <thead><tr><th scope="col" className="w-36 border-b border-border p-3 text-xs text-muted-foreground">Detalhe</th>{comparedResults.map(({ plan }) => <th scope="col" key={plan.id} className="border-b border-border p-3 align-top"><span className="block text-xs font-medium text-muted-foreground">{plan.carrier}</span><span className="mt-1 block font-semibold">{plan.name}</span></th>)}</tr></thead>
                    <tbody>
                      {[
                        { label: "Total por mês", value: (result: (typeof comparedResults)[number]) => money(result.pricing.monthlyTotal) },
                        { label: "Média por vida", value: (result: (typeof comparedResults)[number]) => money(result.pricing.monthlyPerLife) },
                        { label: "Acomodação", value: () => ACCOMMODATION_LABEL[accommodation] },
                        { label: "Coparticipação", value: () => COPAYMENT_LABEL[copayment] },
                        { label: "Abrangência", value: () => COVERAGE_LABEL[coverage] },
                        { label: "Odontologia", value: (result: (typeof comparedResults)[number]) => result.plan.dentalIncluded || includeDental ? "Sim, exemplo" : "Não" },
                        { label: "Rede desejada", value: (result: (typeof comparedResults)[number]) => getNetworkMatch(result.plan, selectedHospitals) + " de " + selectedHospitals.length },
                        { label: "Carências", value: (result: (typeof comparedResults)[number]) => result.plan.waitingPeriodSummary },
                        { label: "Reajuste médio", value: (result: (typeof comparedResults)[number]) => result.plan.averageAnnualAdjustment.toFixed(1).replace(".", ",") + "% (exemplo)" },
                      ].map((row) => (
                        <tr key={row.label} className="border-b border-border last:border-0"><th scope="row" className="p-3 text-xs font-medium text-muted-foreground">{row.label}</th>{comparedResults.map((result) => <td key={result.plan.id} className="p-3 align-top text-sm">{row.value(result)}</td>)}</tr>
                      ))}
                      <tr><th scope="row" className="p-3 text-xs text-muted-foreground">Ação</th>{comparedResults.map(({ plan }) => <td key={plan.id} className="p-3"><Button type="button" size="sm" onClick={() => choosePlan(plan.id)}>Escolher</Button></td>)}</tr>
                    </tbody>
                  </table>
                </div>
                <div className="grid gap-3 md:hidden">
                  {comparedResults.map(({ plan, pricing }) => (
                    <Card key={plan.id} className="gap-4 p-4">
                      <div><p className="text-xs font-medium text-muted-foreground">{plan.carrier}</p><h3 className="mt-1 font-semibold">{plan.name}</h3></div>
                      <dl className="grid grid-cols-2 gap-3 text-sm">
                        <div><dt className="text-xs text-muted-foreground">Total mensal</dt><dd className="mt-1 font-semibold">{money(pricing.monthlyTotal)}</dd></div>
                        <div><dt className="text-xs text-muted-foreground">Média por vida</dt><dd className="mt-1 font-semibold">{money(pricing.monthlyPerLife)}</dd></div>
                        <div><dt className="text-xs text-muted-foreground">Acomodação</dt><dd className="mt-1">{ACCOMMODATION_LABEL[accommodation]}</dd></div>
                        <div><dt className="text-xs text-muted-foreground">Coparticipação</dt><dd className="mt-1">{COPAYMENT_LABEL[copayment]}</dd></div>
                        <div><dt className="text-xs text-muted-foreground">Abrangência</dt><dd className="mt-1">{COVERAGE_LABEL[coverage]}</dd></div>
                        <div><dt className="text-xs text-muted-foreground">Rede desejada</dt><dd className="mt-1">{getNetworkMatch(plan, selectedHospitals)} de {selectedHospitals.length}</dd></div>
                        <div className="col-span-2"><dt className="text-xs text-muted-foreground">Carências</dt><dd className="mt-1">{plan.waitingPeriodSummary}</dd></div>
                        <div><dt className="text-xs text-muted-foreground">Reajuste médio</dt><dd className="mt-1">{plan.averageAnnualAdjustment.toFixed(1).replace(".", ",")}% (exemplo)</dd></div>
                      </dl>
                      <Button type="button" onClick={() => choosePlan(plan.id)}>Escolher este plano</Button>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {step === 5 && (
          <div className="space-y-5">
            <div><h2 id="step-title-5" className="text-lg font-semibold">Resumo demonstrativo</h2><p className="mt-1 text-sm text-muted-foreground">Confira as vidas e a estimativa antes de compartilhar o exemplo.</p></div>
            {!chosenResult ? (
              <Card className="gap-3 p-5"><p className="text-sm text-muted-foreground">Escolha um plano nos resultados ou na comparação para montar o resumo.</p><Button type="button" onClick={() => setStep(3)}>Voltar aos resultados</Button></Card>
            ) : (
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] print:block">
                <Card className="gap-5 p-4 sm:p-6 print:border-0 print:p-0">
                  <div className="flex items-start justify-between gap-3"><div><Badge variant="secondary">{PROFILE_LABEL[profileType]}</Badge><h3 className="mt-3 text-xl font-semibold">{chosenResult.plan.name}</h3><p className="mt-1 text-sm text-muted-foreground">{chosenResult.plan.carrier}</p></div><ShieldCheck aria-hidden="true" className="size-6 shrink-0 text-primary" /></div>
                  <dl className="grid grid-cols-2 gap-3 rounded-2xl bg-muted/40 p-4 text-sm">
                    <div><dt className="text-xs text-muted-foreground">Mensalidade total demonstrativa</dt><dd className="mt-1 text-lg font-semibold">{money(finalMonthly)}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Primeira mensalidade estimada</dt><dd className="mt-1 text-lg font-semibold">{money(finalMonthly)}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Desconto demonstrativo</dt><dd className="mt-1 font-medium">{familyDiscount > 0 ? "5% para exemplo PME" : "Não aplicado"}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Região e cobertura</dt><dd className="mt-1 font-medium">{REGION_LABEL[region]} · {COVERAGE_LABEL[coverage]}</dd></div>
                  </dl>
                  <div>
                    <h4 className="text-sm font-semibold">Beneficiários demonstrativos</h4>
                    <ul className="mt-2 divide-y divide-border rounded-xl border border-border px-3">
                      {chosenResult.pricing.beneficiaries.map((person, index) => <li key={person.id} className="flex items-center justify-between gap-3 py-3 text-sm"><span>{index === 0 ? "Titular" : "Dependente " + index} · {person.age} anos <span className="text-muted-foreground">({person.ageBandLabel})</span></span><span className="shrink-0 font-medium tabular-nums">{money(person.monthlyPrice)}</span></li>)}
                    </ul>
                  </div>
                  <div className="rounded-xl border border-warning/30 bg-warning/5 p-3 text-sm"><p className="font-semibold">Valores simulados, sujeitos à análise da operadora.</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Rede, carências, elegibilidade, reajustes e valores definitivos dependem da proposta e do contrato da operadora. Nenhum dado foi vinculado a um lead ou salvo no sistema.</p></div>
                </Card>
                <aside className="space-y-3 print:hidden" aria-label="Ações do resumo">
                  <Card className="gap-3 p-4">
                    <h3 className="text-sm font-semibold">Compartilhar ou imprimir</h3>
                    <Button type="button" variant="outline" className="w-full" onClick={copySummary}><Copy aria-hidden="true" className="size-4" /> Copiar resumo</Button>
                    <Button type="button" className="w-full" onClick={openWhatsApp}><MessageCircle aria-hidden="true" className="size-4" /> Enviar por WhatsApp</Button>
                    <div className="space-y-1.5"><Label htmlFor="phone">Telefone com DDD (opcional)</Label><Input id="phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Ex.: 5521999999999" /></div>
                    <Button type="button" variant="outline" className="w-full" onClick={() => window.print()}><FileDown aria-hidden="true" className="size-4" /> Baixar PDF ou imprimir</Button>
                  </Card>
                  <Card className="gap-3 p-4">
                    <div><h3 className="text-sm font-semibold">Vincular a um lead</h3><p className="mt-1 text-xs text-muted-foreground">Prévia visual com nomes de demonstração. Nenhum vínculo será gravado.</p></div>
                    <Label htmlFor="lead-search">Buscar lead de exemplo</Label>
                    <Input id="lead-search" value={leadSearch} onChange={(event) => { setLeadSearch(event.target.value); setLeadLinkPreview(false); }} placeholder="Digite um nome" autoComplete="off" />
                    <div className="max-h-36 space-y-1 overflow-y-auto" role="listbox" aria-label="Leads demonstrativos">
                      {matchingLeads.map((lead) => <button key={lead.id} type="button" role="option" aria-selected={selectedLeadId === lead.id} onClick={() => { setSelectedLeadId(lead.id); setLeadLinkPreview(false); }} className={"flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " + (selectedLeadId === lead.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50")}><span><span className="block font-medium">{lead.name}</span><span className="text-xs text-muted-foreground">{lead.stage}</span></span>{selectedLeadId === lead.id && <Check aria-hidden="true" className="size-4 text-primary" />}</button>)}
                      {matchingLeads.length === 0 && <p className="px-2 py-3 text-xs text-muted-foreground">Nenhum lead demonstrativo encontrado.</p>}
                    </div>
                    <Button type="button" variant="outline" className="w-full" onClick={previewLeadLink}>Vincular a um lead</Button>
                    {leadLinkPreview && selectedLeadId && <p className="text-xs text-primary" role="status">Prévia pronta: {MOCK_LEADS.find((lead) => lead.id === selectedLeadId)?.name}. Nada foi salvo.</p>}
                  </Card>
                </aside>
              </div>
            )}
          </div>
        )}
      </section>

      <footer className="mt-6 flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <Button type="button" variant="ghost" onClick={() => { setError(""); setStep((current) => Math.max(0, current - 1) as Step); }} disabled={step === 0}><ChevronLeft aria-hidden="true" className="size-4" /> Voltar</Button>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {step === 4 && comparedResults.length > 0 && <p className="text-center text-xs text-muted-foreground sm:text-right">Escolha um plano na comparação para ver o resumo.</p>}
          {step < 3 && <Button type="button" onClick={nextStep}>Continuar <ChevronRight aria-hidden="true" className="size-4" /></Button>}
          {step === 3 && <Button type="button" variant="outline" onClick={() => setStep(2)}>Editar preferências</Button>}
          {step === 5 && <Button type="button" variant="outline" onClick={() => setStep(3)}>Escolher outro plano</Button>}
        </div>
      </footer>
    </main>
  );
}
