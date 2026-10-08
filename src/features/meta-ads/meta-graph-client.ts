import "server-only";

import type { MetaDiscoveredAssets } from "./types";
import { isMetaAdAccountId, isMetaObjectId, isMetaPageId, normalizeMetaAdAccountId } from "./meta-id-validation";

const GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION?.trim() || "v25.0";
const GRAPH_BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;
const META_PLATFORM_APP_ID = process.env.META_LEAD_ADS_APP_ID || process.env.META_APP_ID || process.env.NEXT_PUBLIC_META_LEAD_ADS_APP_ID || "780859815090303";

export class MetaGraphApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: number,
  ) {
    super(message);
    this.name = "MetaGraphApiError";
  }
}

/** The permission error returned by Marketing API when a selected ad account was not granted to this token. */
export function isMetaAdsReadPermissionError(error: unknown) {
  return error instanceof MetaGraphApiError
    && error.code === 200
    && /ads_(?:read|management)/i.test(error.message);
}

export function isMetaPermissionError(error: unknown) {
  return error instanceof MetaGraphApiError && [10, 100, 190, 200].includes(error.code ?? 0);
}

/** 4/17/32/613 are user, app and page limits; 80000-80014 are the Business Use Case limits (80004 = ads management). */
export function isMetaRateLimitError(error: unknown): error is MetaGraphApiError {
  if (!(error instanceof MetaGraphApiError)) return false;
  const code = error.code ?? 0;
  return [4, 17, 32, 613].includes(code) || (code >= 80000 && code <= 80014);
}

/** Stop syncing once any usage meter passes this percentage, before Meta blocks the token. */
export const META_USAGE_STOP_PERCENT = 75;
const META_REQUEST_SPACING_MS = 200;
const META_DEFAULT_PAGE_LIMIT = 50;
const META_EXCLUDE_DELETED_FILTER = JSON.stringify([{ field: "effective_status", operator: "NOT_IN", value: ["ARCHIVED", "DELETED"] }]);

export type MetaUsageReading = { percent: number; metric: string; regainMinutes: number | null };

function parseJsonHeader(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function readPercent(source: unknown, label: string, fields: readonly string[], reading: MetaUsageReading) {
  if (!source || typeof source !== "object") return;
  const record = source as Record<string, unknown>;
  for (const field of fields) {
    const value = Number(record[field]);
    if (Number.isFinite(value) && value > reading.percent) {
      reading.percent = value;
      reading.metric = `${label}.${field}`;
    }
  }
  const regain = Number(record.estimated_time_to_regain_access);
  if (Number.isFinite(regain) && regain > 0) reading.regainMinutes = Math.max(reading.regainMinutes ?? 0, regain);
}

/**
 * Highest usage percentage across x-business-use-case-usage, x-app-usage and
 * x-ad-account-usage, plus Meta's estimated_time_to_regain_access (minutes) when sent.
 */
export function readMetaUsageHeaders(headers: Headers): MetaUsageReading {
  const reading: MetaUsageReading = { percent: 0, metric: "", regainMinutes: null };
  const usageFields = ["call_count", "total_cputime", "total_time"] as const;

  const businessUseCase = parseJsonHeader(headers.get("x-business-use-case-usage"));
  if (businessUseCase && typeof businessUseCase === "object") {
    for (const entries of Object.values(businessUseCase as Record<string, unknown>)) {
      for (const entry of Array.isArray(entries) ? entries : []) readPercent(entry, "x-business-use-case-usage", usageFields, reading);
    }
  }
  readPercent(parseJsonHeader(headers.get("x-app-usage")), "x-app-usage", usageFields, reading);
  const adAccount = parseJsonHeader(headers.get("x-ad-account-usage"));
  for (const entry of Array.isArray(adAccount) ? adAccount : [adAccount]) readPercent(entry, "x-ad-account-usage", ["acc_id_util_pct"], reading);
  return reading;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class MetaGraphClient {
  private accessToken: string;
  private usage: MetaUsageReading = { percent: 0, metric: "", regainMinutes: null };
  private lastRequestAt = 0;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  /** Spaces consecutive Graph calls and stops before the usage meters reach Meta's block. */
  private async beforeRequest() {
    if (this.usage.percent > META_USAGE_STOP_PERCENT) {
      const regain = this.usage.regainMinutes ? ` estimated_time_to_regain_access: ${this.usage.regainMinutes} min.` : "";
      throw new MetaGraphApiError(
        `Meta request limit reached (uso preventivo: ${this.usage.metric} em ${Math.round(this.usage.percent)}%, limite de segurança ${META_USAGE_STOP_PERCENT}%).${regain}`,
        429,
        17,
      );
    }
    const wait = this.lastRequestAt + META_REQUEST_SPACING_MS - Date.now();
    if (wait > 0) await sleep(wait);
    this.lastRequestAt = Date.now();
  }

  private async readFailure(res: Response): Promise<MetaGraphApiError> {
    const errorPayload = await res.json().catch(() => ({}));
    const code: number | undefined = errorPayload?.error?.code;
    const base = errorPayload?.error?.message || `Meta Graph API HTTP ${res.status}`;
    const error = new MetaGraphApiError(base, res.status, code);
    if (isMetaRateLimitError(error) && this.usage.regainMinutes) {
      return new MetaGraphApiError(`${base} (estimated_time_to_regain_access: ${this.usage.regainMinutes} min)`, res.status, code);
    }
    return error;
  }

  /**
   * Sync listing without ARCHIVED/DELETED objects. If Meta rejects the filter,
   * the same listing is retried unfiltered (rate limits are never retried).
   */
  private async fetchAllPagesActive<T>(endpoint: string, params: Record<string, string>): Promise<T[]> {
    try {
      return await this.fetchAllPages<T>(endpoint, { ...params, filtering: META_EXCLUDE_DELETED_FILTER });
    } catch (error) {
      if (isMetaRateLimitError(error)) throw error;
      return this.fetchAllPages<T>(endpoint, { ...params });
    }
  }

  private assertMetaObjectId(value: string, label: string, validator: (candidate: string) => boolean = isMetaObjectId) {
    if (!validator(value)) {
      throw new MetaGraphApiError(`Identificador Meta invalido para ${label}.`, 400, 100);
    }
  }

  private async fetchApi<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(`${GRAPH_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`);
    url.searchParams.append("access_token", this.accessToken);

    for (const [key, value] of Object.entries(params)) {
      url.searchParams.append(key, value);
    }

    await this.beforeRequest();
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
    });
    this.usage = readMetaUsageHeaders(res.headers);

    if (!res.ok) throw await this.readFailure(res);

    return res.json() as Promise<T>;
  }

  /**
   * Helper to fetch all paginated pages from Meta Graph API using paging.next.
   * Guarantees that accounts with hundreds of campaigns or forms are not truncated.
   */
  private async fetchAllPages<T>(endpoint: string, params: Record<string, string> = {}, maxItems = 3000): Promise<T[]> {
    let allData: T[] = [];
    let nextUrl: string | null = null;
    let pageCount = 0;

    const initialUrl = new URL(`${GRAPH_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`);
    initialUrl.searchParams.append("access_token", this.accessToken);
    if (!params.limit) {
      params.limit = String(META_DEFAULT_PAGE_LIMIT);
    }
    const maxPages = Math.ceil(maxItems / Number(params.limit));
    for (const [key, value] of Object.entries(params)) {
      initialUrl.searchParams.append(key, value);
    }
    nextUrl = initialUrl.toString();

    while (nextUrl && allData.length < maxItems && pageCount < maxPages) {
      pageCount++;
      await this.beforeRequest();
      const res = await fetch(nextUrl, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      this.usage = readMetaUsageHeaders(res.headers);

      if (!res.ok) throw await this.readFailure(res);

      const payload = (await res.json()) as { data?: T[]; paging?: { next?: string } };
      if (Array.isArray(payload.data)) {
        allData = allData.concat(payload.data);
      }
      nextUrl = payload.paging?.next || null;
    }

    return allData;
  }

  /**
   * Reads the scopes actually granted to this user token. The token itself is
   * never returned or written to logs. This is the authority for deciding
   * whether Marketing assets can be synchronized.
   */
  async fetchGrantedPermissions(): Promise<string[]> {
    const response = await this.fetchApi<{ data: Array<{ permission?: string; status?: string }> }>("/me/permissions");
    return response.data
      .filter((entry) => entry.status === "granted" && typeof entry.permission === "string")
      .map((entry) => entry.permission!);
  }

  /**
   * Confirms that this platform app, not merely another app on the Page, is
   * subscribed to the Lead Ads event. This is the delivery precondition for
   * a Page-level Lead Ads source.
   */
  async fetchLeadgenSubscription(pageId: string): Promise<boolean> {
    this.assertMetaObjectId(pageId, "pagina", isMetaPageId);
    const response = await this.fetchApi<{
      data?: Array<{ id?: string; subscribed_fields?: string[] }>;
    }>(`/${pageId}/subscribed_apps`, { fields: "id,subscribed_fields" });

    return response.data?.some((app) => app.id === META_PLATFORM_APP_ID && app.subscribed_fields?.includes("leadgen")) ?? false;
  }

  /**
   * Provides candidates from the current OAuth grant for an explicit Director
   * review. Nothing in this list is persisted or synchronized until it is
   * selected in the wizard and revalidated in confirmMetaConnection.
   */
  async discoverAssets(): Promise<MetaDiscoveredAssets> {
    try {
      // 1. Obter info do usuário / me e businesses
      const meRes = await this.fetchApi<{ id: string; name?: string }>("/me", { fields: "id,name" });

      // 2. Fetch businesses (paginado)
      const businessesData = await this.fetchAllPages<{ id: string; name: string }>("/me/businesses", { fields: "id,name" }).catch(() => []);
      const primaryBusiness = businessesData[0] ?? { id: meRes.id, name: meRes.name || "Minha Empresa Meta" };

      // 3. Fetch Facebook Pages (paginado)
      const pagesData = await this.fetchAllPages<{ id: string; name: string }>("/me/accounts", { fields: "id,name" }).catch(() => []);

      // 4. Fetch Ad Accounts (paginado)
      const adAccountsData = await this.fetchAllPages<{ id: string; name: string; currency: string; account_status: number }>("/me/adaccounts", { fields: "id,name,currency,account_status" }).catch(() => []);

      return {
        business: {
          id: primaryBusiness.id,
          name: primaryBusiness.name,
        },
        pages: pagesData.map((p) => ({
          id: p.id,
          name: p.name,
        })),
        adAccounts: adAccountsData.map((a) => ({
          id: a.id,
          name: a.name || `Conta ${a.id}`,
          currency: a.currency || "BRL",
          accountStatus: a.account_status || 1,
        })),
        whatsapp: null,
        pixels: [],
        datasets: [],
      };
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error("Token inválido ou sem permissões suficientes.");
      console.error("[MetaGraphClient] Error discovering assets:", err);
      throw new Error(`Falha ao consultar ativos na Graph API da Meta: ${err?.message || "Token inválido ou sem permissões suficientes."}`);
    }
  }

  /** Busca todas as campanhas paginadas de uma conta de anúncios */
  async fetchCampaigns(adAccountId: string): Promise<Array<{
    id: string;
    name: string;
    objective?: string;
    status?: string;
    effective_status?: string;
    daily_budget?: string;
    lifetime_budget?: string;
    start_time?: string;
    stop_time?: string;
  }>> {
    this.assertMetaObjectId(adAccountId, "conta de anuncios", isMetaAdAccountId);
    const formattedAccountId = normalizeMetaAdAccountId(adAccountId);
    return this.fetchAllPagesActive<{
      id: string; name: string; objective?: string; status?: string; effective_status?: string; daily_budget?: string; lifetime_budget?: string; start_time?: string; stop_time?: string;
    }>(`/${formattedAccountId}/campaigns`, {
      fields: "id,name,objective,status,effective_status,daily_budget,lifetime_budget,start_time,stop_time",
    });
  }

  /** Busca todos os conjuntos da conta em uma paginação, incluindo a campanha-pai. */
  async fetchAdSetsForAccount(adAccountId: string): Promise<Array<{
    id: string;
    name: string;
    status?: string;
    targeting?: Record<string, unknown>;
    campaign_id?: string;
  }>> {
    this.assertMetaObjectId(adAccountId, "conta de anuncios", isMetaAdAccountId);
    const formattedAccountId = normalizeMetaAdAccountId(adAccountId);
    // `targeting` is a heavy nested field and nothing reads it, so it is not requested.
    return this.fetchAllPagesActive<{
      id: string; name: string; status?: string; targeting?: Record<string, unknown>; campaign_id?: string;
    }>(`/${formattedAccountId}/adsets`, {
      fields: "id,name,status,campaign_id",
    });
  }

  /** Busca todos os anúncios da conta em uma paginação, incluindo os vínculos pai. */
  async fetchAdsForAccount(adAccountId: string): Promise<Array<{
    id: string;
    name: string;
    status?: string;
    adset_id?: string;
    campaign_id?: string;
    creative?: { object_story_spec?: unknown };
  }>> {
    this.assertMetaObjectId(adAccountId, "conta de anuncios", isMetaAdAccountId);
    const formattedAccountId = normalizeMetaAdAccountId(adAccountId);
    const fields = "id,name,status,adset_id,campaign_id,creative{object_story_spec}";
    try {
      return await this.fetchAllPagesActive<{
        id: string; name: string; status?: string; adset_id?: string; campaign_id?: string; creative?: { object_story_spec?: unknown };
      }>(`/${formattedAccountId}/ads`, { fields });
    } catch (error) {
      // Some Meta permissions/API versions reject creative expansion. Keep the
      // existing ad sync working and leave form linkage to captured attribution.
      if (isMetaRateLimitError(error)) throw error;
      return this.fetchAllPagesActive<{
        id: string; name: string; status?: string; adset_id?: string; campaign_id?: string; creative?: { object_story_spec?: unknown };
      }>(`/${formattedAccountId}/ads`, {
        fields: "id,name,status,adset_id,campaign_id",
      });
    }
  }

  /** Busca conjuntos de anúncios (AdSets) paginados de uma campanha */
  async fetchAdSets(campaignId: string): Promise<Array<{
    id: string;
    name: string;
    status?: string;
    targeting?: Record<string, unknown>;
  }>> {
    return this.fetchAllPages<{ id: string; name: string; status?: string; targeting?: Record<string, unknown> }>(`/${campaignId}/adsets`, {
      fields: "id,name,status,targeting",
    });
  }

  /** Busca todos os anúncios paginados de um conjunto */
  async fetchAds(adSetId: string): Promise<Array<{
    id: string;
    name: string;
    status?: string;
  }>> {
    return this.fetchAllPages<{ id: string; name: string; status?: string }>(`/${adSetId}/ads`, {
      fields: "id,name,status",
    });
  }

  /** Busca todos os formulários de Lead Ads paginados de uma página */
  async fetchLeadForms(pageId: string): Promise<Array<{
    id: string;
    name: string;
    status?: string;
    locale?: string;
  }>> {
    this.assertMetaObjectId(pageId, "pagina", isMetaPageId);
    return this.fetchAllPages<{ id: string; name: string; status?: string; locale?: string }>(`/${pageId}/leadgen_forms`, {
      fields: "id,name,status,locale",
    });
  }

  /** Busca todos os pixels paginados de uma conta de anúncios */
  async fetchPixels(adAccountId: string): Promise<Array<{ id: string; name: string }>> {
    this.assertMetaObjectId(adAccountId, "conta de anuncios", isMetaAdAccountId);
    const formattedAccountId = normalizeMetaAdAccountId(adAccountId);
    const rawPixels = await this.fetchAllPages<{ id: string; name?: string }>(`/${formattedAccountId}/adspixels`, {
      fields: "id,name",
    });
    return rawPixels.map((pixel) => ({ id: pixel.id, name: pixel.name || `Pixel ${pixel.id}` }));
  }

  /** Busca todos os datasets paginados da empresa */
  async fetchDatasets(businessId: string): Promise<Array<{ id: string; name: string }>> {
    this.assertMetaObjectId(businessId, "empresa");
    const rawDatasets = await this.fetchAllPages<{ id: string; name?: string }>(`/${businessId}/datasets`, {
      fields: "id,name",
    });
    return rawDatasets.map((dataset) => ({ id: dataset.id, name: dataset.name || `Dataset ${dataset.id}` }));
  }

  /** Busca detalhes de um lead gerado via Lead Ads */
  async fetchLeadDetails(leadgenId: string): Promise<{
    id: string;
    created_time: string;
    field_data: Array<{ name: string; values: string[] }>;
    ad_id?: string;
    ad_name?: string;
    adset_id?: string;
    adset_name?: string;
    campaign_id?: string;
    campaign_name?: string;
    form_id?: string;
    page_id?: string;
  }> {
    return this.fetchApi<{
      id: string;
      created_time: string;
      field_data: Array<{ name: string; values: string[] }>;
      ad_id?: string;
      ad_name?: string;
      adset_id?: string;
      adset_name?: string;
      campaign_id?: string;
      campaign_name?: string;
      form_id?: string;
      page_id?: string;
    }>(`/${leadgenId}`, {
      fields: "id,created_time,field_data,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id,page_id",
    });
  }
}
