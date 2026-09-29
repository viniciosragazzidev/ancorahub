// Drill-downs belong to the canonical dashboard namespace. The implementation
// remains shared with the compatibility reports route while old bookmarks are
// still supported.
export { default } from "../../../relatorios/drill/[drillId]/page";

// Next.js route segment configuration must be statically declared in this
// wrapper; it cannot be re-exported from the compatibility implementation.
export const dynamic = "force-dynamic";
