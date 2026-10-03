import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SelectedFields } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";

import * as realSchema from "@/shared/db/schema";
import type { TenantContext } from "@/shared/auth/types";
import { getLeadQualityReport } from "./lead-quality-service";

const state: { db: unknown } = { db: null };

vi.mock("server-only", () => ({}));
vi.mock("@/shared/db", () => ({ schema: realSchema, getDatabase: () => state.db }));
vi.mock("@/features/custom-roles/service", () => ({
  listEffectiveCapabilities: async () => ["acessar_relatorios"],
}));
vi.mock("@/features/system-settings/queries", () => ({
  getFeatureFlag: async () => "true",
}));
vi.mock("./metric-scope", () => ({
  resolveReportDataScope: async (context: TenantContext) => ({
    tenantId: context.tenantId,
    leadScope: undefined,
  }),
}));

const context: TenantContext = {
  userId: "user-test",
  tenantId: "tenant-test",
  role: "director",
  jobTitle: "director",
  branchId: null,
};

describe("getLeadQualityReport query projections", () => {
  let compiledCohortSql = "";

  beforeEach(() => {
    const db = drizzle.mock({ schema: realSchema });
    const buildWith = db.with.bind(db);
    Object.assign(db, {
      with: (cohort: Parameters<typeof db.with>[0]) => {
        return {
          select: (fields: SelectedFields) => {
            compiledCohortSql = buildWith(cohort).select(fields).from(cohort).toSQL().sql;
            return {
              from: () => ({
                groupBy: () => ({
                  orderBy: async () => [
                    {
                      dimension: "summary",
                      key: "all",
                      label: "Total da seleção",
                      total: 0,
                      hot: 0,
                      warm: 0,
                      cold: 0,
                      unclassified: 0,
                      converted: 0,
                      hotWarmConverted: 0,
                      assigned: 0,
                      metaAttributed: 0,
                      averageFirstContactSeconds: null,
                    },
                  ],
                }),
              }),
            };
          },
        };
      },
      insert: () => ({ values: async () => undefined }),
    });
    state.db = db;
  });

  it("builds grouped analytics from the cohort's computed SQL fields", async () => {
    await expect(getLeadQualityReport(context, 30)).resolves.toMatchObject({
      enabled: true,
      summary: { total: 0 },
    });
    expect(compiledCohortSql).toContain('"meta_campaigns"."name" as "campaignName"');
    expect(compiledCohortSql).toContain('"meta_ad_sets"."name" as "adsetName"');
    expect(compiledCohortSql).toContain('"meta_ads"."name" as "adName"');
    expect(compiledCohortSql).toContain('"meta_lead_forms"."name" as "formName"');
    expect(compiledCohortSql).toContain('"lead_queues"."name" as "queueName"');
    expect(compiledCohortSql).toContain('"user"."name" as "brokerName"');
    expect(compiledCohortSql).toContain('MAX("campaignName")');
    expect(compiledCohortSql).toContain('MAX("brokerName")');
    expect(compiledCohortSql).not.toContain('MAX("name")');
  });
});
