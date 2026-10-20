import { onlyDigits, parseLinhaDigitavel } from "./boleto";
import {
  findOperatorByMaskedCnpj,
  maskedDocumentMatches,
  normalizeText,
  operatorNameMatches,
} from "./documents";
import type {
  BoletoExtraction,
  ProofExtraction,
  ProposalExtraction,
  ValidationCheck,
  ValidationResult,
} from "./types";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function money(value: number | null | undefined) {
  return value == null ? "sem valor" : brl.format(value);
}

function sameAmount(a: number | null | undefined, b: number | null | undefined) {
  return a != null && b != null && Math.abs(a - b) < 0.01;
}

function formatDate(iso: string | null | undefined) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso ?? "sem data";
  const [year, month, day] = iso.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

function firstName(value: string | null | undefined) {
  return normalizeText(value).split(/\s+/)[0] ?? "";
}

function checkAmount(proposal: ProposalExtraction, proof: ProofExtraction): ValidationCheck {
  const base = { id: "valor", label: "Valor pago igual ao total da proposta" };
  if (proof.valor == null || proposal.valorTotal == null) {
    return { ...base, status: "warn", detail: "Não foi possível ler o valor no comprovante ou na proposta." };
  }
  if (sameAmount(proof.valor, proposal.valorTotal)) {
    return { ...base, status: "ok", detail: `${money(proof.valor)} nos dois documentos.` };
  }
  return {
    ...base,
    status: "fail",
    detail: `Comprovante de ${money(proof.valor)}, proposta de ${money(proposal.valorTotal)}.`,
  };
}

function checkStatus(proof: ProofExtraction): ValidationCheck {
  const base = { id: "status", label: "Pagamento concluído, não agendado" };
  const status = normalizeText(proof.status);
  if (!status) return { ...base, status: "warn", detail: "O comprovante não informa a situação do pagamento." };
  if (/agend|program|pendente|process|aguard/.test(status)) {
    return {
      ...base,
      status: "fail",
      detail: `Situação "${proof.status}". Agendamento pode ser cancelado depois e não comprova pagamento.`,
    };
  }
  return { ...base, status: "ok", detail: `Situação "${proof.status}".` };
}

function checkBeneficiary(
  proposal: ProposalExtraction,
  proof: ProofExtraction,
  boleto: BoletoExtraction | null,
): ValidationCheck {
  const base = { id: "beneficiario", label: "Beneficiário é a operadora" };

  if (boleto?.beneficiarioCnpj) {
    const matches = maskedDocumentMatches(proof.beneficiarioDocumento, boleto.beneficiarioCnpj);
    if (matches === true) return { ...base, status: "ok", detail: "CNPJ do beneficiário igual ao do boleto original." };
    if (matches === false) {
      return { ...base, status: "fail", detail: "CNPJ do beneficiário no comprovante é diferente do boleto original." };
    }
  }

  const operators = findOperatorByMaskedCnpj(proof.beneficiarioDocumento);
  const expected = proposal.operadora;
  if (operators.length > 0) {
    const sameOperator = !expected || operators.some((operator) => operatorNameMatches(expected, operator.name));
    return sameOperator
      ? { ...base, status: "ok", detail: `CNPJ do beneficiário confere com ${operators[0].name}.` }
      : {
          ...base,
          status: "fail",
          detail: `CNPJ do beneficiário é de ${operators[0].name}, mas a proposta é de ${expected}.`,
        };
  }

  if (operatorNameMatches(expected, proof.beneficiarioNome)) {
    return {
      ...base,
      status: "warn",
      detail: `Nome "${proof.beneficiarioNome}" bate com a operadora, mas o CNPJ não pôde ser conferido. Envie o boleto original.`,
    };
  }
  return {
    ...base,
    status: "fail",
    detail: `Beneficiário "${proof.beneficiarioNome ?? "não informado"}" não corresponde à operadora ${expected ?? "da proposta"}.`,
  };
}

function checkPayer(proposal: ProposalExtraction, proof: ProofExtraction): ValidationCheck {
  const base = { id: "pagador", label: "Pagador é o cliente da proposta" };

  const brokerMatch = maskedDocumentMatches(proof.pagadorDocumento, proposal.corretor?.documento);
  const brokerNameMatch =
    !proof.pagadorDocumento &&
    firstName(proof.pagadorNome).length >= 3 &&
    firstName(proof.pagadorNome) === firstName(proposal.corretor?.nome);
  if (brokerMatch === true || brokerNameMatch) {
    return {
      ...base,
      status: "fail",
      detail: "O pagamento foi feito pelo próprio corretor. Isso não comprova que o cliente pagou.",
    };
  }

  const candidates = [
    { label: "titular", doc: proposal.titular.documento },
    { label: "empresa", doc: proposal.empresa?.cnpj },
    { label: "responsável legal", doc: proposal.responsavelLegal?.documento },
  ].filter((candidate) => onlyDigits(candidate.doc).length >= 11);

  if (!proof.pagadorDocumento || !/\d/.test(proof.pagadorDocumento)) {
    return { ...base, status: "warn", detail: "O comprovante não mostra o documento do pagador." };
  }
  const hit = candidates.find((candidate) => maskedDocumentMatches(proof.pagadorDocumento, candidate.doc) === true);
  if (hit) return { ...base, status: "ok", detail: `Documento do pagador confere com o ${hit.label}.` };
  return {
    ...base,
    status: "warn",
    detail: `Documento do pagador (${proof.pagadorDocumento}) não confere com titular, empresa ou responsável. Confirme quem pagou.`,
  };
}

function checkLinhaDigitavel(proof: ProofExtraction, boleto: BoletoExtraction | null): ValidationCheck[] {
  const presence = { id: "linha-presente", label: "Comprovante mostra a linha digitável" };
  const reference = proof.dataPagamento ? new Date(`${proof.dataPagamento.slice(0, 10)}T12:00:00Z`) : new Date();
  const parsed = parseLinhaDigitavel(proof.linhaDigitavel, reference);

  if (!parsed) {
    return [
      {
        ...presence,
        status: "warn",
        detail: "Sem linha digitável não dá para ligar o pagamento ao boleto. Peça o comprovante em PDF do banco.",
      },
    ];
  }

  const checks: ValidationCheck[] = [{ ...presence, status: "ok", detail: "Linha digitável encontrada." }];
  checks.push(
    parsed.valid
      ? { id: "linha-valida", label: "Dígitos verificadores da linha", status: "ok", detail: "Todos os dígitos conferem." }
      : {
          id: "linha-valida",
          label: "Dígitos verificadores da linha",
          status: "fail",
          detail: "A linha digitável tem dígito verificador errado. Pode ter sido digitada ou editada.",
        },
  );

  if (parsed.amount != null) {
    checks.push(
      sameAmount(parsed.amount, proof.valor)
        ? { id: "linha-valor", label: "Valor dentro da linha", status: "ok", detail: `${money(parsed.amount)}.` }
        : {
            id: "linha-valor",
            label: "Valor dentro da linha",
            status: "fail",
            detail: `A linha digitável é de ${money(parsed.amount)}, o comprovante diz ${money(proof.valor)}.`,
          },
    );
  }

  if (parsed.dueDate && proof.vencimento) {
    checks.push(
      parsed.dueDate === proof.vencimento.slice(0, 10)
        ? { id: "linha-vencimento", label: "Vencimento dentro da linha", status: "ok", detail: formatDate(parsed.dueDate) }
        : {
            id: "linha-vencimento",
            label: "Vencimento dentro da linha",
            status: "warn",
            detail: `A linha indica ${formatDate(parsed.dueDate)}, o comprovante diz ${formatDate(proof.vencimento)}.`,
          },
    );
  }

  if (boleto?.linhaDigitavel) {
    const same = onlyDigits(boleto.linhaDigitavel) === parsed.digits;
    checks.push({
      id: "linha-boleto",
      label: "Mesma linha do boleto original",
      status: same ? "ok" : "fail",
      detail: same ? "O pagamento é exatamente deste boleto." : "O comprovante é de outro boleto.",
    });
  }

  return checks;
}

function checkBoleto(proposal: ProposalExtraction, boleto: BoletoExtraction | null): ValidationCheck {
  const base = { id: "boleto", label: "Boleto original confere com a proposta" };
  if (!boleto) {
    return { ...base, status: "skip", detail: "Boleto original não enviado. A checagem fica mais fraca sem ele." };
  }
  const parsed = parseLinhaDigitavel(boleto.linhaDigitavel);
  const amount = boleto.valor ?? parsed?.amount ?? null;
  if (!sameAmount(amount, proposal.valorTotal)) {
    return {
      ...base,
      status: "warn",
      detail: `Boleto de ${money(amount)}, proposta de ${money(proposal.valorTotal)}.`,
    };
  }
  if (parsed && !parsed.valid) {
    return { ...base, status: "fail", detail: "A linha digitável do boleto tem dígito verificador errado." };
  }
  return { ...base, status: "ok", detail: `Boleto de ${money(amount)}.` };
}

function checkContact(proposal: ProposalExtraction): ValidationCheck {
  const base = { id: "contato", label: "Contato da proposta é do cliente" };
  const email = normalizeText(proposal.emailContato);
  if (!email) return { ...base, status: "warn", detail: "A proposta não tem e-mail de contato." };

  const brokerEmail = normalizeText(proposal.corretor?.email);
  const brokerFirst = firstName(proposal.corretor?.nome);
  const clientFirst = firstName(proposal.titular.nome ?? proposal.responsavelLegal?.nome);
  const localPart = email.split("@")[0] ?? "";
  const looksLikeBroker =
    (brokerEmail && brokerEmail === email) ||
    (brokerFirst.length >= 4 && localPart.includes(brokerFirst) && !(clientFirst && localPart.includes(clientFirst)));

  if (looksLikeBroker) {
    return {
      ...base,
      status: "warn",
      detail: `O e-mail ${proposal.emailContato} parece ser do corretor. Boletos e avisos da operadora vão para ele, não para o cliente.`,
    };
  }
  return { ...base, status: "ok", detail: `E-mail ${proposal.emailContato}.` };
}

function checkPaymentDate(proof: ProofExtraction): ValidationCheck | null {
  if (!proof.dataPagamento || !proof.vencimento) return null;
  const paid = proof.dataPagamento.slice(0, 10);
  const due = proof.vencimento.slice(0, 10);
  return paid <= due
    ? { id: "data", label: "Pago até o vencimento", status: "ok", detail: `Pago em ${formatDate(paid)}, vence ${formatDate(due)}.` }
    : {
        id: "data",
        label: "Pago até o vencimento",
        status: "warn",
        detail: `Pago em ${formatDate(paid)}, depois do vencimento ${formatDate(due)}.`,
      };
}

export function validatePaymentProof(input: {
  proposal: ProposalExtraction;
  proof: ProofExtraction;
  boleto?: BoletoExtraction | null;
}): ValidationResult {
  const boleto = input.boleto ?? null;
  const checks: ValidationCheck[] = [
    checkAmount(input.proposal, input.proof),
    checkStatus(input.proof),
    checkBeneficiary(input.proposal, input.proof, boleto),
    checkPayer(input.proposal, input.proof),
    ...checkLinhaDigitavel(input.proof, boleto),
    checkBoleto(input.proposal, boleto),
    checkContact(input.proposal),
  ];
  const dateCheck = checkPaymentDate(input.proof);
  if (dateCheck) checks.push(dateCheck);

  const verdict = checks.some((check) => check.status === "fail")
    ? "recusar"
    : checks.some((check) => check.status === "warn")
      ? "revisar"
      : "aprovavel";

  return { verdict, checks };
}
