// Endereço do CRM. O build injeta `__CRM_BASE__` (variável CRM_BASE); sem ela, usa o endereço atual.
declare const __CRM_BASE__: string | undefined;

export const CRM_BASE_PADRAO = "https://crm.ancorasaude.cloud";

export const CRM_BASE: string = typeof __CRM_BASE__ === "string" && __CRM_BASE__ ? __CRM_BASE__ : CRM_BASE_PADRAO;
