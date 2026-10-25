"use client";

/**
 * Estado e navegação dos filtros de /leads, compartilhados pela tela atual e pela versão Lite (chave do diretor).
 * A URL é a fonte da verdade; os mesmos parâmetros, a mesma memória no localStorage e a mesma navegação suave.
 */
import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  hasLeadFilterQuery,
  parseLeadFilterPreferences,
  type LeadFilterPreferences,
} from "@/features/leads/lead-filter-preferences";

export type LeadFilterBranch = { id: string; name: string };
export type LeadFilterBroker = { id: string; name: string };
export type LeadFilterTag = { id: string; name: string; colorHue: number };

export type LeadsFiltersProps = {
  initialSearch?: string;
  initialStatus?: string;
  initialBranch?: string;
  initialTipo?: string;
  initialOrigem?: string;
  /** Brokers do not filter by origin or campaign. */
  hideOriginFilters?: boolean;
  initialQualification?: string;
  initialCorretor?: string;
  initialPageSize?: string;
  initialEligibleCampaigns?: string;
  initialTag?: string;
  storageKey: string;
  branches: LeadFilterBranch[];
  brokers: LeadFilterBroker[];
  /** The tenant's lead tags (filter by tag). */
  tags?: LeadFilterTag[];
};

export const qualificationLabels: Record<string, string> = {
  unqualified: "Sem Qualificação",
  warm: "Morna",
  hot: "Quente",
  disqualified: "Desqualificado",
};

export type LeadFilterChip = { id: string; label: string; value: string };

export function useLeadFilters({
  initialSearch,
  initialStatus,
  initialBranch,
  initialTipo,
  initialOrigem,
  initialQualification,
  initialCorretor,
  initialPageSize,
  initialEligibleCampaigns,
  initialTag,
  storageKey,
  branches,
  brokers,
  tags = [],
}: LeadsFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  // States
  const [search, setSearch] = useState(initialSearch ?? "");
  const [status, setStatus] = useState(initialStatus ?? "");
  // Keep the clicked pill responsive while the server-rendered table is
  // revalidating. The URL remains the source of truth once navigation lands.
  const [optimisticStatus, setOptimisticStatus] = useState<string | null>(null);
  const [branch, setBranch] = useState(initialBranch ?? "");
  const [tipo, setTipo] = useState(initialTipo ?? "");
  const [origem, setOrigem] = useState(initialOrigem ?? "");
  const [qualification, setQualification] = useState(initialQualification ?? "");
  const [corretor, setCorretor] = useState(initialCorretor ?? "");
  const [tag, setTag] = useState(initialTag ?? "");
  const [pageSize, setPageSize] = useState(initialPageSize ?? "20");
  const [eligibleCampaigns, setEligibleCampaigns] = useState(initialEligibleCampaigns === "1");
  const [restored, setRestored] = useState(false);

  const currentPreferences = (): LeadFilterPreferences => ({
    search, status, branch, tipo, origem, qualification, corretor, tag, pageSize, eligibleCampaigns,
  });

  function buildUrl(preferences: LeadFilterPreferences) {
    const currentQuery = typeof window === "undefined" ? searchParams.toString() : window.location.search;
    const params = new URLSearchParams(currentQuery);
    params.delete("page");

    if (preferences.search) params.set("search", preferences.search); else params.delete("search");
    if (preferences.status) params.set("status", preferences.status); else params.delete("status");
    if (preferences.branch) params.set("branch", preferences.branch); else params.delete("branch");
    if (preferences.tipo) params.set("tipo", preferences.tipo); else params.delete("tipo");
    if (preferences.origem) params.set("origem", preferences.origem); else params.delete("origem");
    if (preferences.qualification) params.set("qualification", preferences.qualification); else params.delete("qualification");
    if (preferences.corretor) params.set("corretor", preferences.corretor); else params.delete("corretor");
    if (preferences.tag) params.set("tag", preferences.tag); else params.delete("tag");
    if (preferences.eligibleCampaigns) params.set("eligibleCampaigns", "1"); else params.delete("eligibleCampaigns");
    if (preferences.pageSize !== "20") params.set("pageSize", preferences.pageSize); else params.delete("pageSize");

    const queryStr = params.toString();
    return `/leads${queryStr ? `?${queryStr}` : ""}`;
  }

  useEffect(() => {
    if (restored || hasLeadFilterQuery(searchParams)) return;
    setRestored(true);
    const stored = parseLeadFilterPreferences(window.localStorage.getItem(storageKey));
    if (!stored) return;
    const target = buildUrl(stored);
    if (`${window.location.pathname}${window.location.search}` !== target) {
      // A soft replace (24/10): window.location.replace reloaded the whole app, layout included.
      router.replace(target, { scroll: false });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restored, searchParams, storageKey]);

  // Keep controls aligned with URL changes (pagination, sorting, browser back)
  // without remounting the whole leads workspace.
  const serializedSearchParams = searchParams.toString();
  useEffect(() => {
    const params = new URLSearchParams(serializedSearchParams);
    const nextStatus = params.get("status") ?? "";
    setSearch(params.get("search") ?? "");
    setStatus(nextStatus);
    setOptimisticStatus(null);
    setBranch(params.get("branch") ?? "");
    setTipo(params.get("tipo") ?? "");
    setOrigem(params.get("origem") ?? "");
    setQualification(params.get("qualification") ?? "");
    setCorretor(params.get("corretor") ?? "");
    setTag(params.get("tag") ?? "");
    setEligibleCampaigns(params.get("eligibleCampaigns") === "1");
    setPageSize(params.get("pageSize") ?? "20");
  }, [serializedSearchParams]);

  function navigateTo(target: string) {
    // Update the address bar immediately so rapid filter changes cannot appear
    // stuck while the App Router waits for the next server payload.
    if (`${window.location.pathname}${window.location.search}` !== target) {
      window.history.replaceState(window.history.state, "", target);
    }
    startTransition(() => {
      router.replace(target, { scroll: false });
    });
  }

  const activeCount = [
    status,
    branch,
    tipo,
    origem,
    qualification,
    corretor,
    tag,
    eligibleCampaigns ? "eligible-campaigns" : "",
    pageSize !== "20" ? pageSize : "",
  ].filter(Boolean).length;

  const hasAnyFilter = Boolean(search || activeCount > 0);

  function applyFilters(overridePrefs?: LeadFilterPreferences) {
    const preferences = overridePrefs ?? currentPreferences();
    window.localStorage.setItem(storageKey, JSON.stringify(preferences));
    setOpen(false);
    navigateTo(buildUrl(preferences));
  }

  function handleReset() {
    setSearch("");
    setStatus("");
    setBranch("");
    setTipo("");
    setOrigem("");
    setQualification("");
    setCorretor("");
    setTag("");
    setEligibleCampaigns(false);
    setPageSize("20");

    window.localStorage.removeItem(storageKey);
    navigateTo("/leads");
  }

  // Active filter chips (status is displayed in the quick pills bar above, so omitted here to avoid duplication)
  const chips: LeadFilterChip[] = [];
  if (search) chips.push({ id: "search", label: "Busca", value: `"${search}"` });
  if (tipo) chips.push({ id: "tipo", label: "Tipo", value: tipo === "PME" ? "PJ" : tipo });
  if (origem) chips.push({ id: "origem", label: "Origem", value: origem === "manual" ? "Manual" : "Webhook" });
  if (eligibleCampaigns) chips.push({ id: "eligibleCampaigns", label: "Meta", value: "Elegíveis agora" });
  if (qualification) chips.push({ id: "qualification", label: "Qualificação", value: qualificationLabels[qualification] ?? qualification });
  if (branch) chips.push({ id: "branch", label: "Filial", value: branches.find((b) => b.id === branch)?.name ?? "Filial" });
  if (corretor) chips.push({ id: "corretor", label: "Corretor", value: brokers.find((b) => b.id === corretor)?.name ?? "Corretor" });
  if (tag) chips.push({ id: "tag", label: "Tag", value: tags.find((item) => item.id === tag)?.name ?? "Tag" });
  if (pageSize !== "20") chips.push({ id: "pageSize", label: "Por página", value: `${pageSize}/pág.` });

  function handleRemoveChip(chipId: string) {
    const updated = { ...currentPreferences() };
    if (chipId === "search") { setSearch(""); updated.search = ""; }
    if (chipId === "tipo") { setTipo(""); updated.tipo = ""; }
    if (chipId === "origem") { setOrigem(""); updated.origem = ""; }
    if (chipId === "eligibleCampaigns") { setEligibleCampaigns(false); updated.eligibleCampaigns = false; }
    if (chipId === "qualification") { setQualification(""); updated.qualification = ""; }
    if (chipId === "branch") { setBranch(""); updated.branch = ""; }
    if (chipId === "corretor") { setCorretor(""); updated.corretor = ""; }
    if (chipId === "tag") { setTag(""); updated.tag = ""; }
    if (chipId === "pageSize") { setPageSize("20"); updated.pageSize = "20"; }

    window.localStorage.setItem(storageKey, JSON.stringify(updated));
    navigateTo(buildUrl(updated));
  }

  /** Clique numa pílula de etapa: aplica na hora, com a pílula marcada antes da navegação terminar. */
  function selectStatusPill(pillId: string) {
    setOptimisticStatus(pillId);
    setStatus(pillId);
    applyFilters({ ...currentPreferences(), status: pillId });
  }

  return {
    open, setOpen,
    search, setSearch,
    status, setStatus,
    optimisticStatus, setOptimisticStatus,
    branch, setBranch,
    tipo, setTipo,
    origem, setOrigem,
    qualification, setQualification,
    corretor, setCorretor,
    tag, setTag,
    pageSize, setPageSize,
    eligibleCampaigns, setEligibleCampaigns,
    currentPreferences,
    activeCount,
    hasAnyFilter,
    applyFilters,
    handleReset,
    chips,
    handleRemoveChip,
    selectStatusPill,
  };
}
