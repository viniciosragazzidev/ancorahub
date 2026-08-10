import { z } from "zod";

const metaIdSchema = z.string().trim().regex(/^\d{5,40}$/, "Informe um identificador numérico válido.");
const optionalMetaIdSchema = metaIdSchema.optional().or(z.literal(""));
const optionalAdAccountIdSchema = z.string().trim().regex(/^(?:act_)?\d{5,40}$/, "Informe um identificador de conta de anúncios válido.").optional().or(z.literal(""));

/**
 * The browser submits only customer-owned Meta identifiers and a token.
 * Tenant, user, application secret, verify token and encryption key are never input fields.
 */
export const manualMetaConnectionInputSchema = z.object({
  businessId: metaIdSchema,
  wabaId: metaIdSchema,
  phoneNumberId: metaIdSchema,
  accessToken: z.string().trim().min(20, "Informe um token válido.").max(4096),
  facebookPageId: optionalMetaIdSchema,
  adAccountId: optionalAdAccountIdSchema,
  pixelId: optionalMetaIdSchema,
  datasetId: optionalMetaIdSchema,
});

export type ManualMetaConnectionInput = z.infer<typeof manualMetaConnectionInputSchema>;

export const manualMetaLeadAdsSourceInputSchema = z.object({
  pageId: metaIdSchema,
  adAccountId: optionalAdAccountIdSchema,
  branchId: z.string().trim().min(1).max(80).nullable(),
});

export type ManualMetaLeadAdsSourceInput = z.infer<typeof manualMetaLeadAdsSourceInputSchema>;

/**
 * The current tenant is derived from the authenticated server session. The
 * Director supplies only the Page owned by that tenant; no tenant identifier
 * is ever accepted from the browser.
 */
export const manualMetaLeadAdsDiscoveryInputSchema = z.object({
  pageId: metaIdSchema,
});

export type ManualMetaLeadAdsDiscoveryInput = z.infer<typeof manualMetaLeadAdsDiscoveryInputSchema>;
