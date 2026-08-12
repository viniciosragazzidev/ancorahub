import "server-only";

import type { MetaDiscoveredAssets } from "./types";

const GRAPH_API_VERSION = "v20.0";
const GRAPH_BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export class MetaGraphClient {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
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
      throw new Error(message);
    }

    return res.json() as Promise<T>;
  }

  /** Descobre ativos vinculados ao token recebido via Embedded Signup v4 */
  async discoverAssets(): Promise<MetaDiscoveredAssets> {
    try {
      // 1. Obter info do usuário / me e businesses
      const meRes = await this.fetchApi<{ id: string; name?: string }>("/me", { fields: "id,name" });

      // 2. Fetch businesses
      const businessesRes = await this.fetchApi<{ data: Array<{ id: string; name: string }> }>("/me/businesses", { fields: "id,name" }).catch(() => ({ data: [] }));
      const primaryBusiness = businessesRes.data[0] ?? { id: meRes.id, name: meRes.name || "Minha Empresa Meta" };

      // 3. Fetch Facebook Pages
      const pagesRes = await this.fetchApi<{ data: Array<{ id: string; name: string; access_token?: string }> }>("/me/accounts", { fields: "id,name,access_token" }).catch(() => ({ data: [] }));

      // 4. Fetch Ad Accounts
      const adAccountsRes = await this.fetchApi<{ data: Array<{ id: string; name: string; currency: string; account_status: number }> }>("/me/adaccounts", { fields: "id,name,currency,account_status" }).catch(() => ({ data: [] }));

      // 5. Fetch WhatsApp Business Accounts (WABA)
      const wabaRes = await this.fetchApi<{ data: Array<{ id: string; name?: string; phone_numbers?: { data: Array<{ id: string; display_phone_number: string; verified_name?: string }> } }> }>(
        `/${primaryBusiness.id}/whatsapp_business_accounts`,
        { fields: "id,name,phone_numbers{id,display_phone_number,verified_name}" }
      ).catch(() => ({ data: [] }));

      const primaryWaba = wabaRes.data[0];
      const primaryPhone = primaryWaba?.phone_numbers?.data[0];

      return {
        business: {
          id: primaryBusiness.id,
          name: primaryBusiness.name,
        },
        pages: pagesRes.data.map((p) => ({
          id: p.id,
          name: p.name,
          accessToken: p.access_token,
        })),
        adAccounts: adAccountsRes.data.map((a) => ({
          id: a.id,
          name: a.name || `Conta ${a.id}`,
          currency: a.currency || "BRL",
          accountStatus: a.account_status || 1,
        })),
        whatsapp: primaryWaba ? {
          wabaId: primaryWaba.id,
          phoneNumberId: primaryPhone?.id || null,
          displayPhoneNumber: primaryPhone?.display_phone_number || null,
          verifiedName: primaryPhone?.verified_name || null,
        } : null,
        pixels: [],
        datasets: [],
      };
    } catch (err: any) {
      console.error("[MetaGraphClient] Error discovering assets:", err);
      throw new Error(`Falha ao consultar ativos na Graph API da Meta: ${err?.message || "Token inválido ou sem permissões suficentes."}`);
    }
  }

  /** Busca campanhas de uma conta de anúncios */
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
    const formattedAccountId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
    const res = await this.fetchApi<{ data: Array<{
      id: string; name: string; objective?: string; status?: string; daily_budget?: string; lifetime_budget?: string; start_time?: string; stop_time?: string;
    }> }>(`/${formattedAccountId}/campaigns`, {
      fields: "id,name,objective,status,daily_budget,lifetime_budget,start_time,stop_time",
      limit: "100",
    });
    return res.data;
  }

  /** Busca conjuntos de anúncios (AdSets) de uma campanha */
  async fetchAdSets(campaignId: string): Promise<Array<{
    id: string;
    name: string;
    status?: string;
    targeting?: Record<string, unknown>;
  }>> {
    const res = await this.fetchApi<{ data: Array<{ id: string; name: string; status?: string; targeting?: Record<string, unknown> }> }>(`/${campaignId}/adsets`, {
      fields: "id,name,status,targeting",
      limit: "100",
    });
    return res.data;
  }

  /** Busca anúncios de um conjunto */
  async fetchAds(adSetId: string): Promise<Array<{
    id: string;
    name: string;
    status?: string;
  }>> {
    const res = await this.fetchApi<{ data: Array<{ id: string; name: string; status?: string }> }>(`/${adSetId}/ads`, {
      fields: "id,name,status",
      limit: "100",
    });
    return res.data;
  }

  /** Busca formulários de Lead Ads de uma página */
  async fetchLeadForms(pageId: string): Promise<Array<{
    id: string;
    name: string;
    status?: string;
    locale?: string;
  }>> {
    const res = await this.fetchApi<{ data: Array<{ id: string; name: string; status?: string; locale?: string }> }>(`/${pageId}/leadgen_forms`, {
      fields: "id,name,status,locale",
      limit: "100",
    });
    return res.data;
  }

  /** Uses one tenant-owned ad account, never a global account listing. */
  async fetchPixels(adAccountId: string): Promise<Array<{ id: string; name: string }>> {
    const formattedAccountId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
    const res = await this.fetchApi<{ data: Array<{ id: string; name?: string }> }>(`/${formattedAccountId}/adspixels`, {
      fields: "id,name",
      limit: "100",
    });
    return res.data.map((pixel) => ({ id: pixel.id, name: pixel.name || `Pixel ${pixel.id}` }));
  }

  /** Reads datasets only below the business confirmed for this tenant connection. */
  async fetchDatasets(businessId: string): Promise<Array<{ id: string; name: string }>> {
    const res = await this.fetchApi<{ data: Array<{ id: string; name?: string }> }>(`/${businessId}/datasets`, {
      fields: "id,name",
      limit: "100",
    });
    return res.data.map((dataset) => ({ id: dataset.id, name: dataset.name || `Dataset ${dataset.id}` }));
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
