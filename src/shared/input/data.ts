/**
 * Data na entrada: aceita 1/2/26, 01-02-2026, 01.02.2026, 01022026 (dia, mês, ano) e 2026-02-01 (ISO).
 * Devolve ISO "aaaa-mm-dd" e confere se o dia existe (31/02 não passa). Ano com 2 dígitos: até 10 anos à frente
 * do ano de referência fica no século atual; o resto vai para 1900 (nascimento "1/2/85" vira 1985).
 */

export type MotivoDataInvalida = "vazio" | "formato" | "inexistente";

export type DataLida =
  | { ok: true; iso: string; exibicao: string }
  | { ok: false; motivo: MotivoDataInvalida; mensagem: string };

const MENSAGENS: Record<MotivoDataInvalida, string> = {
  vazio: "Informe a data.",
  formato: "Use dia/mês/ano, ex.: 01/02/2026.",
  inexistente: "Essa data não existe. Confira o dia e o mês.",
};

const falha = (motivo: MotivoDataInvalida): DataLida => ({ ok: false, motivo, mensagem: MENSAGENS[motivo] });
const dois = (n: number) => String(n).padStart(2, "0");

function montar(ano: number, mes: number, dia: number): DataLida {
  if (mes < 1 || mes > 12 || dia < 1) return falha("inexistente");
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  if (dia > ultimo) return falha("inexistente");
  const iso = `${String(ano).padStart(4, "0")}-${dois(mes)}-${dois(dia)}`;
  return { ok: true, iso, exibicao: `${dois(dia)}/${dois(mes)}/${ano}` };
}

/** `referencia` (ano atual por padrão) decide o século de anos com 2 dígitos. */
export function lerData(entrada: string | null | undefined, referencia: { ano?: number } = {}): DataLida {
  const texto = (entrada ?? "").trim();
  if (!texto) return falha("vazio");
  const iso = texto.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s].*)?$/);
  if (iso) return montar(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  let partes = texto.match(/^(\d{1,2})\s*[/.\-\s]\s*(\d{1,2})\s*[/.\-\s]\s*(\d{2}|\d{4})$/)?.slice(1);
  if (!partes && /^\d{8}$/.test(texto)) partes = [texto.slice(0, 2), texto.slice(2, 4), texto.slice(4)];
  if (!partes && /^\d{6}$/.test(texto)) partes = [texto.slice(0, 2), texto.slice(2, 4), texto.slice(4)];
  if (!partes) return falha("formato");
  const [dia, mes, anoTexto] = partes as [string, string, string];
  let ano = Number(anoTexto);
  if (anoTexto.length === 2) {
    const atual = referencia.ano ?? new Date().getFullYear();
    const seculo = Math.floor(atual / 100) * 100;
    ano = seculo + ano <= atual + 10 ? seculo + ano : seculo - 100 + ano;
  }
  return montar(ano, Number(mes), Number(dia));
}

/** ISO "aaaa-mm-dd" ou null. */
export function dataIso(entrada: string | null | undefined, referencia?: { ano?: number }): string | null {
  const lida = lerData(entrada, referencia);
  return lida.ok ? lida.iso : null;
}

/** "dd/mm/aaaa" a partir de ISO (ou de qualquer formato aceito). Ilegível volta como veio. */
export function formatarData(entrada: string | null | undefined): string {
  const lida = lerData(entrada);
  return lida.ok ? lida.exibicao : (entrada ?? "").trim();
}

/**
 * Máscara enquanto digita: "dd/mm/aaaa". Colar "2026-02-01" ou "1/2/2026" vira "01/02/2026". Ano com 2 dígitos
 * ("1/2/26") não é convertido aqui, porque quem ainda está digitando "1/2/20..." seria atropelado: use `lerData`
 * ao sair do campo ou ao salvar.
 */
export function mascararDataDigitada(entrada: string): string {
  const texto = entrada.trim();
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(texto) || /^\d{1,2}[/.\-]\d{1,2}[/.\-]\d{4}$/.test(texto)) {
    const lida = lerData(texto);
    if (lida.ok) return lida.exibicao;
  }
  // "1/" vira "01/": dia ou mês com um dígito seguido de separador ganha o zero.
  const partes = texto.split(/\D+/);
  let digitos = "";
  partes.forEach((parte, indice) => {
    const fechada = indice < partes.length - 1;
    digitos += fechada && parte.length === 1 && digitos.length < 4 ? `0${parte}` : parte;
  });
  const d = digitos.slice(0, 8);
  const separadorNoFim = /\D$/.test(texto) && (d.length === 2 || d.length === 4);
  let saida: string;
  if (d.length <= 2) saida = d;
  else if (d.length <= 4) saida = `${d.slice(0, 2)}/${d.slice(2)}`;
  else saida = `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
  return separadorNoFim ? `${saida}/` : saida;
}
