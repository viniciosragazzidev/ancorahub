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
};

export type MetaCampaignItem = {
  id: string;
  campaignId: string;
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
