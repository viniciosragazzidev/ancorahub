/**
 * Valor em reais na entrada. Aceita "1.234,56", "1234.56", "R$ 1234", "1,5 mil", "2k", "1 234,5" e devolve
 * centavos inteiros (nunca número quebrado). Não aceita negativo.
 */

export type MotivoValorInvalido = "vazio" | "negativo" | "formato";

export type ValorLido =
  | { ok: true; centavos: number; exibicao: string }
  | { ok: false; motivo: MotivoValorInvalido; mensagem: string };

const MENSAGENS: Record<MotivoValorInvalido, string> = {
  vazio: "Informe o valor.",
  negativo: "O valor não pode ser negativo.",
  formato: "Não entendi o valor. Use, por exemplo, 1.234,56.",
};

const falha = (motivo: MotivoValorInvalido): ValorLido => ({ ok: false, motivo, mensagem: MENSAGENS[motivo] });

/** Separa a parte inteira e a decimal decidindo o que é milhar e o que é decimal. */
function partes(numero: string): { inteiro: string; fracao: string } | null {
  const virgulas = (numero.match(/,/g) ?? []).length;
  const pontos = (numero.match(/\./g) ?? []).length;
  let decimal: "," | "." | null = null;
  if (virgulas && pontos) decimal = numero.lastIndexOf(",") > numero.lastIndexOf(".") ? "," : ".";
  else if (virgulas === 1) decimal = ",";
  else if (pontos === 1) decimal = /\.\d{3}$/.test(numero) ? null : ".";
  else if (virgulas > 1 && !/^\d{1,3}(,\d{3})+$/.test(numero)) return null;
  else if (pontos > 1 && !/^\d{1,3}(\.\d{3})+$/.test(numero)) return null;
  const milhar = decimal === "," ? "." : ",";
  let texto = numero;
  if (decimal === null) texto = texto.replace(/[.,]/g, "");
  else {
    const corte = texto.lastIndexOf(decimal);
    const inteiro = texto.slice(0, corte);
    if (inteiro.includes(decimal)) return null;
    texto = `${inteiro.split(milhar).join("")}.${texto.slice(corte + 1)}`;
  }
  if (!/^\d*(\.\d*)?$/.test(texto) || texto === "." || texto === "") return null;
  const [inteiro = "", fracao = ""] = texto.split(".");
  return { inteiro: inteiro || "0", fracao };
}

/** Centavos inteiros ou motivo. */
export function lerValor(entrada: string | number | null | undefined): ValorLido {
  if (entrada === null || entrada === undefined) return falha("vazio");
  if (typeof entrada === "number") {
    if (!Number.isFinite(entrada)) return falha("formato");
    if (entrada < 0) return falha("negativo");
    const centavos = Math.round(entrada * 100);
    return { ok: true, centavos, exibicao: formatarValor(centavos) };
  }
  let texto = entrada.toLowerCase().replace(/r\$|brl|reais|real/g, "").replace(/[\s ]/g, "");
  if (!texto) return falha("vazio");
  if (texto.startsWith("-")) return falha("negativo");
  let multiplicador = 1;
  const sufixo = texto.match(/(mil|k)$/);
  if (sufixo) {
    multiplicador = 1000;
    texto = texto.slice(0, -sufixo[0].length);
  }
  if (!texto || /[^\d.,]/.test(texto)) return falha("formato");
  const lido = partes(texto);
  if (!lido) return falha("formato");
  // Inteiro com a fração toda, depois arredonda (meio para cima) para centavos.
  const escala = 10 ** lido.fracao.length;
  const numerador = Number(lido.inteiro + lido.fracao) * 100 * multiplicador;
  if (!Number.isSafeInteger(numerador)) return falha("formato");
  const centavos = Math.floor((2 * numerador + escala) / (2 * escala));
  return { ok: true, centavos, exibicao: formatarValor(centavos) };
}

/** Centavos ou null. */
export function valorEmCentavos(entrada: string | number | null | undefined): number | null {
  const lido = lerValor(entrada);
  return lido.ok ? lido.centavos : null;
}

function agrupar(inteiro: string) {
  return inteiro.replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** "R$ 1.234,56" a partir de centavos (espaço comum, não o espaço fino do Intl). */
export function formatarValor(centavos: number): string {
  const sinal = centavos < 0 ? "-" : "";
  const abs = Math.abs(Math.round(centavos));
  const inteiro = Math.floor(abs / 100).toString();
  const fracao = (abs % 100).toString().padStart(2, "0");
  return `${sinal}R$ ${agrupar(inteiro)},${fracao}`;
}

/**
 * Máscara enquanto digita: põe o ponto de milhar e deixa o usuário escrever a vírgula e até 2 casas. Digitando,
 * ponto é sempre o de milhar (quem apaga "1.234" até "1.23" não vira 1,23). Texto colado (`colado`) ou com
 * letras passa por `lerValor`: "R$ 1234.56" vira "1.234,56" e "1,5 mil" vira "1.500,00".
 */
export function mascararValorDigitado(entrada: string, opcoes: { colado?: boolean } = {}): string {
  const texto = entrada.replace(/[\s ]/g, "");
  if (!texto) return "";
  if (opcoes.colado || /[a-z$]/i.test(texto)) {
    const lido = lerValor(texto);
    if (lido.ok) return lido.exibicao.replace(/^R\$ /, "");
  }
  const limpo = texto.replace(/[^\d,]/g, "");
  const corte = limpo.indexOf(",");
  if (corte === -1) return agrupar(limpo);
  const inteiro = agrupar(limpo.slice(0, corte) || "0");
  const fracao = limpo.slice(corte + 1).replace(/,/g, "").slice(0, 2);
  return `${inteiro},${fracao}`;
}
