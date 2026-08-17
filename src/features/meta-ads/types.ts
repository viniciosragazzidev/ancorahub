export type MetaConnectionStatus = "connected" | "disconnected" | "expired" | "error";

export type MetaConnectionInfo = {
  id: string;
  tenantId: string;
  businessId: string;
  businessName: string | null;
  status: MetaConnectionStatus;
  permissions: string[];
  expiresAt: Date | null;
  lastError: string | null;
  lastSyncedAt: Date | null;
  pagesCount: number;
  adAccountsCount: number;
  whatsappConnected: boolean;
};

export type MetaConnectionAssets = {
  pages: Array<{ id: string; name: string; status: string }>;
  adAccounts: Array<{ id: string; name: string; currency: string; status: string }>;
  pixels: Array<{ id: string; name: string; status: string }>;
  datasets: Array<{ id: string; name: string; status: string }>;
  leadForms: Array<{ id: string; name: string; status: string; pageId: string }>;
  campaigns: Array<{ id: string; name: string; status: string; adAccountId: string; isEligibleForCapture?: boolean }>;
  ads: Array<{ id: string; name: string; status: string; adSetId: string }>;
};

export type MetaDiscoveredAssets = {
  business: {
    id: string;
    name: string;
  };
  pages: Array<{
    id: string;
    name: string;
    accessToken?: string;
  }>;
  adAccounts: Array<{
    id: string;
    name: string;
    currency: string;
    accountStatus: number;
  }>;
  whatsapp: {
    wabaId: string | null;
    phoneNumberId: string | null;
    displayPhoneNumber: string | null;
    verifiedName: string | null;
  } | null;
  pixels: Array<{
    id: string;
    name: string;
  }>;
  datasets: Array<{
    id: string;
    name: string;
  }>;
  /** Granted OAuth scopes, checked server-side and never exposed with credentials. */
  permissions?: string[];
};

export type MetaSyncWarningCode = "missing_ads_read" | "asset_access_limited" | "invalid_asset" | "leadgen_subscription_missing";

export type MetaSyncWarning = {
  code: MetaSyncWarningCode;
  message: string;
};

export type MetaAdSummaryItem = {
  id: string;
  adId: string;
  name: string;
  status: string;
  leadsCount?: number;
  activeLeadsCount?: number;
};

export type MetaCampaignItem = {
  id: string;
  campaignId: string;
  adAccountId: string;
  adAccountName?: string | null;
  name: string;
  objective: string | null;
  status: string;
  dailyBudget: number | null;
  lifetimeBudget: number | null;
  startTime: Date | null;
  stopTime: Date | null;
  leadsCount?: number;
  conversationsCount?: number;
  salesCount?: number;
  revenueTotal?: number;
  conversionRate?: number;
  isEligibleForCapture?: boolean;
  ads?: MetaAdSummaryItem[];
};

export type MetaAdSetItem = {
  id: string;
  adSetId: string;
  campaignId: string;
  name: string;
  status: string;
};

export type MetaAdItem = {
  id: string;
  adId: string;
  adSetId: string;
  name: string;
  status: string;
};

export type MetaLeadFormItem = {
  id: string;
  formId: string;
  pageId: string;
  name: string;
  status: string;
  locale: string | null;
};

export type MetaSyncLogItem = {
  id: string;
  syncType: string;
  status: string;
  itemsSynced: number;
  errorDetails: string | null;
  durationMs: number | null;
  startedAt: Date;
  completedAt: Date | null;
};

export type MetaSyncAuditDiagnostic = {
  connection: {
    status: string;
    businessId: string | null;
    businessName: string | null;
    lastSyncedAt: Date | null;
    permissions: string[];
    grantedScopesCheck: {
      adsRead: boolean;
      leadsRetrieval: boolean;
      pagesShowList: boolean;
      pagesManageMetadata: boolean;
    };
  } | null;
  adAccounts: Array<{
    adAccountId: string;
    name: string;
    status: string;
    metaCampaignsCount: number;
    crmCampaignsCount: number;
    metaAdsCount: number;
    crmAdsCount: number;
    syncStatus: "MATCH" | "TRUNCATED" | "NOT_SYNCED" | "ERROR";
    errorMessage?: string;
  }>;
  pages: Array<{
    pageId: string;
    name: string;
    status: string;
    hasPageToken: boolean;
    leadgenSubscribed: boolean;
    metaLeadFormsCount: number;
    crmLeadFormsCount: number;
    syncStatus: "MATCH" | "EMPTY" | "NOT_SUBSCRIBED" | "ERROR";
    errorMessage?: string;
  }>;
  totals: {
    metaCampaignsTotal: number;
    crmCampaignsTotal: number;
    metaAdsTotal: number;
    crmAdsTotal: number;
    metaFormsTotal: number;
    crmFormsTotal: number;
    crmPixelsTotal: number;
    crmDatasetsTotal: number;
  };
};
