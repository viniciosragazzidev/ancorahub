import type { promotionalMaterialCategoryValues } from "@/shared/db/schema";

export type PromotionalMaterialCategory =
  (typeof promotionalMaterialCategoryValues)[number];

export type PromotionalMaterialActionState = {
  error?: string;
  success?: boolean;
};
