"use client";

import { useMemo, useState } from "react";

import { toast } from "@/components/ui/sonner";
import {
  MOCK_LEADS,
  MOCK_PLANS,
  type Accommodation,
  type Copayment,
  type Coverage,
  type ProfileType,
  type Region,
} from "@/features/broker-workspace/quote-simulator/mock-data";
import { calculatePlanPricing, type PricingPreferences } from "@/features/broker-workspace/quote-simulator/pricing";

import {
  ageInputs,
  BUDGET_MAX,
  getNetworkMatch,
  makeBeneficiary,
  MAX_COMPARED,
  MAX_LIVES,
  money,
  type Beneficiary,
  type PlansView,
  type SortMode,
  type Step,
} from "./constants";

/** All state, pricing and handlers of the quote simulator. Prices come from the unchanged pricing module. */
export function useQuoteSimulator() {
  const [step, setStep] = useState<Step>(0);
  const [plansView, setPlansView] = useState<PlansView>("list");
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
  const preferences = useMemo<PricingPreferences>(
    () => ({ profileType, region, accommodation, copayment, coverage, includeDental }),
    [profileType, region, accommodation, copayment, coverage, includeDental],
  );
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
    if (step === 0) {
      if (profileType === "adhesion" && (!entity.trim() || !profession.trim())) {
        setError("Informe a entidade e a profissão para o perfil de adesão.");
        return false;
      }
      if (profileType === "pme" && beneficiaries.length > MAX_LIVES) {
        setError("A demonstração de PME aceita até 29 vidas.");
        return false;
      }
      if (!parsedBeneficiaries || parsedBeneficiaries.length === 0) {
        setError("Informe uma idade inteira entre 0 e 120 anos para cada beneficiário.");
        return false;
      }
      if (profileType === "pme" && (parsedBeneficiaries.length < 2 || parsedBeneficiaries.length > MAX_LIVES)) {
        setError("Para a simulação PME, informe de 2 a 29 beneficiários.");
        return false;
      }
    }
    setError("");
    return true;
  }

  function nextStep() {
    if (!validateCurrentStep()) return;
    setStep((current) => Math.min(3, current + 1) as Step);
  }

  function previousStep() {
    setError("");
    setStep((current) => Math.max(0, current - 1) as Step);
  }

  function goToStep(target: number) {
    setError("");
    setStep(Math.min(3, Math.max(0, target)) as Step);
  }

  function updateAge(id: string, age: string) {
    setBeneficiaries((current) => current.map((item) => (item.id === id ? { ...item, age } : item)));
  }

  function addBeneficiary() {
    setBeneficiaries((current) => (current.length >= MAX_LIVES ? current : [...current, makeBeneficiary()]));
  }

  function removeBeneficiary(id: string) {
    setBeneficiaries((current) => current.filter((item) => item.id !== id));
  }

  function toggleCompared(id: string, checked: boolean) {
    setComparedIds((current) => {
      if (!checked) return current.filter((item) => item !== id);
      if (current.includes(id)) return current;
      if (current.length >= MAX_COMPARED) {
        toast.info("Compare até três planos por vez.");
        return current;
      }
      return [...current, id];
    });
  }

  function choosePlan(id: string) {
    setChosenPlanId(id);
    setStep(3);
    setError("");
  }

  function clearFilters() {
    setCarrierFilter("all");
    setAccommodationFilter("all");
    setCopaymentFilter("all");
    setBudget(BUDGET_MAX);
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

  return {
    step, plansView, setPlansView,
    profileType, setProfileType, region, setRegion, entity, setEntity, profession, setProfession, mockCnpj, setMockCnpj,
    beneficiaries, updateAge, addBeneficiary, removeBeneficiary,
    accommodation, setAccommodation, copayment, setCopayment, coverage, setCoverage, includeDental, setIncludeDental,
    budget, setBudget, selectedHospitals, setSelectedHospitals,
    carrierFilter, setCarrierFilter, accommodationFilter, setAccommodationFilter, copaymentFilter, setCopaymentFilter,
    sortMode, setSortMode, comparedIds, toggleCompared, chosenPlanId,
    error, setError, phone, setPhone, leadSearch, setLeadSearch, selectedLeadId, setSelectedLeadId,
    leadLinkPreview, setLeadLinkPreview,
    preferences, allResults, filteredResults, chosenResult, comparedResults, matchingLeads, familyDiscount, finalMonthly,
    nextStep, previousStep, goToStep, choosePlan, clearFilters, copySummary, openWhatsApp, previewLeadLink,
  };
}

export type QuoteSimulator = ReturnType<typeof useQuoteSimulator>;
