import { z } from "zod";

const person = z.object({
  nome: z.string().nullable(),
  documento: z.string().nullable().describe("CPF ou CNPJ só com dígitos, completo como aparece na proposta"),
});

export const proposalExtractionSchema = z.object({
  operadora: z.string().nullable().describe("Nome da operadora do plano (ex.: Amil, Bradesco Saúde)"),
  numeroProposta: z.string().nullable(),
  valorTotal: z.number().nullable().describe("Valor total mensal a pagar, em reais (ex.: 535.98)"),
  titular: person.describe("Titular ou proponente pessoa física"),
  empresa: z
    .object({ razaoSocial: z.string().nullable(), cnpj: z.string().nullable() })
    .nullable()
    .describe("Empresa contratante, só em plano PME/empresarial"),
  responsavelLegal: person.nullable(),
  emailContato: z.string().nullable().describe("E-mail de contato do cliente/empresa informado na proposta"),
  telefoneContato: z.string().nullable(),
  corretor: z
    .object({ nome: z.string().nullable(), documento: z.string().nullable(), email: z.string().nullable() })
    .nullable()
    .describe("Corretor ou vendedor que fez a venda"),
});

export const proofExtractionSchema = z.object({
  instituicao: z.string().nullable().describe("Banco ou carteira que emitiu o comprovante (ex.: 99Pay, Itaú)"),
  status: z.string().nullable().describe("Situação escrita no comprovante (ex.: Concluído, Agendado, Em processamento)"),
  valor: z.number().nullable().describe("Valor pago em reais"),
  dataPagamento: z.string().nullable().describe("Data do pagamento ou da criação, formato yyyy-mm-dd"),
  vencimento: z.string().nullable().describe("Data de vencimento do boleto, formato yyyy-mm-dd"),
  beneficiarioNome: z.string().nullable(),
  beneficiarioDocumento: z.string().nullable().describe("CPF/CNPJ do beneficiário exatamente como aparece, com asteriscos"),
  pagadorNome: z.string().nullable(),
  pagadorDocumento: z.string().nullable().describe("CPF/CNPJ do pagador exatamente como aparece, com asteriscos"),
  linhaDigitavel: z.string().nullable().describe("Linha digitável ou código de barras, se aparecer"),
});

export const boletoExtractionSchema = z.object({
  valor: z.number().nullable(),
  vencimento: z.string().nullable().describe("formato yyyy-mm-dd"),
  beneficiarioNome: z.string().nullable(),
  beneficiarioCnpj: z.string().nullable(),
  pagadorNome: z.string().nullable(),
  pagadorDocumento: z.string().nullable(),
  linhaDigitavel: z.string().nullable(),
});

export type ProposalExtraction = z.infer<typeof proposalExtractionSchema>;
export type ProofExtraction = z.infer<typeof proofExtractionSchema>;
export type BoletoExtraction = z.infer<typeof boletoExtractionSchema>;

export type DocumentKind = "proposta" | "comprovante" | "boleto";

export type ExtractedDocument =
  | { kind: "proposta"; data: ProposalExtraction }
  | { kind: "comprovante"; data: ProofExtraction }
  | { kind: "boleto"; data: BoletoExtraction };

export type CheckStatus = "ok" | "warn" | "fail" | "skip";

export type ValidationCheck = {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
};

export type ValidationVerdict = "aprovavel" | "revisar" | "recusar";

export type ValidationResult = {
  verdict: ValidationVerdict;
  checks: ValidationCheck[];
};
