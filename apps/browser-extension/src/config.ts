import crm from "../crm.json";

// Endereço do CRM. O build injeta `__CRM_BASE__` (variável CRM_BASE); sem ela, usa crm.json (fonte única do padrão).
declare const __CRM_BASE__: string | undefined;

export const CRM_BASE_PADRAO: string = crm.base;

export const CRM_BASE: string = typeof __CRM_BASE__ === "string" && __CRM_BASE__ ? __CRM_BASE__ : CRM_BASE_PADRAO;
