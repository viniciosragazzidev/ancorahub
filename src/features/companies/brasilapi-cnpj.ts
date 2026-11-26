/**
 * Resposta da BrasilAPI (GET /api/cnpj/v1/{cnpj}) no formato da tela /empresas. Puro: sem rede.
 * Só lemos os dados da empresa. O quadro de sócios (qsa) e contatos não entram no resultado.
 */
import { formatCnpj } from "./cnpj";

export type CnpjLookupData = {
  cnpj: string;
  legalName: string;
  tradeName: string | null;
  /** Situação cadastral como a Receita escreve (ATIVA, BAIXADA, INAPTA, SUSPENSA, NULA). */
  situation: string;
  situationLabel: string;
  active: boolean;
  cnae: string | null;
  city: string | null;
  size: string;
  openedAt: string | null;
};

type Raw = Record<string, unknown>;

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim().replace(/\s+/g, " ") : null;
}

const KEEP_LOWER = new Set(["de", "da", "do", "das", "dos", "e"]);

/** "SAO JOSE DOS CAMPOS" vira "Sao Jose dos Campos": a Receita manda tudo em caixa alta. */
export function titleCasePlace(value: string) {
  return value
    .toLocaleLowerCase("pt-BR")
    .split(" ")
    .map((word, index) => (index > 0 && KEEP_LOWER.has(word) ? word : word.charAt(0).toLocaleUpperCase("pt-BR") + word.slice(1)))
    .join(" ");
}

function sentenceCase(value: string) {
  const lower = value.toLocaleLowerCase("pt-BR");
  return lower.charAt(0).toLocaleUpperCase("pt-BR") + lower.slice(1);
}

/** 6201501 vira "6201-5/01". */
export function formatCnae(code: unknown) {
  const digits = String(code ?? "").replace(/\D/g, "");
  if (digits.length !== 7) return digits || null;
  return `${digits.slice(0, 4)}-${digits.slice(4, 5)}/${digits.slice(5)}`;
}

const SIZE_LABELS: Record<string, string> = {
  "MICRO EMPRESA": "Microempresa",
  ME: "Microempresa",
  "EMPRESA DE PEQUENO PORTE": "Empresa de pequeno porte",
  EPP: "Empresa de pequeno porte",
  DEMAIS: "Médio ou grande porte",
  "NAO INFORMADO": "Não informado",
};

export function sizeLabel(value: unknown) {
  const raw = text(value)?.toLocaleUpperCase("pt-BR");
  if (!raw) return "Não informado";
  return SIZE_LABELS[raw.normalize("NFD").replace(/\p{Diacritic}/gu, "")] ?? sentenceCase(raw);
}

export function isActiveSituation(situation: string | null | undefined) {
  return (situation ?? "").trim().toLocaleUpperCase("pt-BR") === "ATIVA";
}

/** Aviso quando o CNPJ não está ativo: a operadora não assina contrato PME com ele. Null quando está ativo. */
export function cnpjSituationWarning(situation: string | null | undefined) {
  return isActiveSituation(situation) ? null : "CNPJ não está ativo: a operadora não aceita contrato PME.";
}

/** Converte a resposta crua. Devolve null quando falta o mínimo (CNPJ e razão social). */
export function mapBrasilApiCnpj(raw: unknown): CnpjLookupData | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Raw;
  const cnpj = String(data.cnpj ?? "").replace(/\D/g, "");
  const legalName = text(data.razao_social);
  if (cnpj.length !== 14 || !legalName) return null;
  const situation = text(data.descricao_situacao_cadastral)?.toLocaleUpperCase("pt-BR") ?? "NÃO INFORMADA";
  const cnaeCode = formatCnae(data.cnae_fiscal);
  const cnaeDescription = text(data.cnae_fiscal_descricao);
  const city = text(data.municipio);
  const uf = text(data.uf)?.toLocaleUpperCase("pt-BR") ?? null;
  return {
    cnpj: formatCnpj(cnpj),
    legalName,
    tradeName: text(data.nome_fantasia),
    situation,
    situationLabel: sentenceCase(situation),
    active: isActiveSituation(situation),
    cnae: cnaeCode && cnaeDescription ? `${cnaeCode} ${sentenceCase(cnaeDescription)}` : cnaeDescription ? sentenceCase(cnaeDescription) : cnaeCode,
    city: city && uf ? `${titleCasePlace(city)}/${uf}` : city ? titleCasePlace(city) : uf,
    size: sizeLabel(data.porte ?? data.descricao_porte),
    openedAt: text(data.data_inicio_atividade),
  };
}
