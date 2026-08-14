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

export class MetaGraphClient {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private assertMetaObjectId(value: string, label: string, validator: (candidate: string) => boolean = isMetaObjectId) {
    if (!validator(value)) {
      throw new MetaGraphApiError(`Identificador Meta invÃ¡lido para ${label}.`, 400, 100);
    }
  }

  private async fetchApi<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(`${GRAPH_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`);
    url.searchParams.append("access_token", this.accessToken);

    for (const [key, value] of Object.entries(params)) {
      url.searchParams.append(key, value);
    }

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      const errorPayload = await res.json().catch(() => ({}));
      const message = errorPayload?.error?.message || `Meta Graph API HTTP ${res.status}`;
      throw new MetaGraphApiError(message, res.status, errorPayload?.error?.code);
    }

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
      params.limit = "100";
    }
    for (const [key, value] of Object.entries(params)) {
      initialUrl.searchParams.append(key, value);
    }
    nextUrl = initialUrl.toString();

    while (nextUrl && allData.length < maxItems && pageCount < 40) {
      pageCount++;
      const res = await fetch(nextUrl, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      if (!res.ok) {
        const errorPayload = await res.json().catch(() => ({}));
        const message = errorPayload?.error?.message || `Meta Graph API HTTP ${res.status}`;
        throw new MetaGraphApiError(message, res.status, errorPayload?.error?.code);
      }

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
    this.assertMetaObjectId(pageId, "pÃ¡gina", isMetaPageId);
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
    daily_budget?: string;
    lifetime_budget?: string;
    start_time?: string;
    stop_time?: string;
  }>> {
    this.assertMetaObjectId(adAccountId, "conta de anÃºncios", isMetaAdAccountId);
    const formattedAccountId = normalizeMetaAdAccountId(adAccountId);
    return this.fetchAllPages<{
      id: string; name: string; objective?: string; status?: string; daily_budget?: string; lifetime_budget?: string; start_time?: string; stop_time?: string;
    }>(`/${formattedAccountId}/campaigns`, {
      fields: "id,name,objective,status,daily_budget,lifetime_budget,start_time,stop_time",
    });
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
    this.assertMetaObjectId(pageId, "pÃ¡gina", isMetaPageId);
    return this.fetchAllPages<{ id: string; name: string; status?: string; locale?: string }>(`/${pageId}/leadgen_forms`, {
      fields: "id,name,status,locale",
    });
  }

  /** Busca todos os pixels paginados de uma conta de anúncios */
  async fetchPixels(adAccountId: string): Promise<Array<{ id: string; name: string }>> {
    this.assertMetaObjectId(adAccountId, "conta de anÃºncios", isMetaAdAccountId);
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
