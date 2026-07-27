/**
 * Lista fixa de operadoras de planos de saúde padrão do mercado.
 * Esses nomes são usados como seed inicial e NÃO podem ser editados
 * pelos tenants — cada corretora ativa/desativa as operadoras com
 * que trabalha e configura os dados de contato.
 */
export const FIXED_CARRIERS = [
  "Amil",
  "Bradesco Saúde",
  "SulAmérica",
  "Unimed",
  "NotreDame Intermédica",
  "Hapvida",
  "Porto Seguro",
  "Qualicorp",
  "Allianz",
  "Prevent Senior",
  "São Francisco Saúde",
  "GreenLine",
  "Omint",
  "Care Plus",
  "Mediservice",
  "Assim Saúde",
  "Blue Med",
  "São Cristóvão",
  "Nordeste Saúde",
  "Ônix Saúde",
  "Nova Saúde",
  "Proasa Saúde",
  "Unimed Santos",
  "Ameplan Saúde",
  "Klini Saúde",
  "Bemstar Saúde",
] as const;

export type FixedCarrierName = (typeof FIXED_CARRIERS)[number];
