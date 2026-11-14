/**
 * Máscara leve para campos de texto, sem dependência: formata enquanto digita, mantém o cursor no lugar certo,
 * apagar um separador apaga o número ao lado (em vez de travar) e colar texto bagunçado funciona.
 * A parte pura fica aqui (testável sem DOM); o hook React está em use-campo-mascarado.ts.
 */
import { mascararDataDigitada } from "./data";
import { mascararValorDigitado } from "./dinheiro";
import { formatarCnpj, formatarCpf } from "./documento";
import { mascararTelefoneDigitado } from "./telefone";

export type TipoMascara = "telefone" | "cpf" | "cnpj" | "valor" | "data";

/** Teclado certo no celular para cada tipo. */
export const MODO_TECLADO: Record<TipoMascara, "tel" | "numeric" | "decimal"> = {
  telefone: "tel",
  cpf: "numeric",
  cnpj: "numeric",
  valor: "decimal",
  data: "numeric",
};

export function mascarar(tipo: TipoMascara, valor: string, opcoes: { colado?: boolean } = {}): string {
  switch (tipo) {
    case "telefone": return mascararTelefoneDigitado(valor);
    case "cpf": return formatarCpf(valor);
    case "cnpj": return formatarCnpj(valor);
    case "valor": return mascararValorDigitado(valor, opcoes);
    case "data": return mascararDataDigitada(valor);
  }
}

/** Caracteres que contam para o cursor: dígitos (e a vírgula no valor). Separadores da máscara não contam. */
function significantes(tipo: TipoMascara, valor: string) {
  return tipo === "valor" ? valor.replace(/[^\d,]/g, "") : valor.replace(/\D/g, "");
}

function contaAte(tipo: TipoMascara, valor: string, cursor: number) {
  return significantes(tipo, valor.slice(0, cursor)).length;
}

function posicaoDepois(tipo: TipoMascara, valor: string, quantos: number) {
  if (quantos <= 0) {
    const primeiro = valor.search(tipo === "valor" ? /[\d,]/ : /\d/);
    return primeiro === -1 ? valor.length : primeiro;
  }
  let vistos = 0;
  for (let i = 0; i < valor.length; i++) {
    if (significantes(tipo, valor[i]!).length) vistos++;
    if (vistos === quantos) return i + 1;
  }
  return valor.length;
}

export type EntradaMascara = {
  /** Valor que está no campo agora (já com a tecla ou a colagem). */
  valor: string;
  /** Posição do cursor no campo agora. */
  cursor: number;
  /** Valor que estava antes da tecla (o formatado anterior). */
  anterior: string;
  /** `InputEvent.inputType` (ex.: "insertText", "deleteContentBackward", "insertFromPaste"). */
  tipoEntrada?: string;
};

/** Aplica a máscara e diz onde o cursor deve ficar. Pura: o hook só repassa para o DOM. */
export function aplicarMascara(tipo: TipoMascara, { valor, cursor, anterior, tipoEntrada }: EntradaMascara): { valor: string; cursor: number } {
  let texto = valor;
  let pos = Math.max(0, Math.min(cursor, texto.length));
  const colado = Boolean(tipoEntrada?.startsWith("insertFrom")) || tipoEntrada === "insertReplacementText"
    || (!tipoEntrada && texto.length - anterior.length > 1);

  // No valor, o ponto digitado vira vírgula decimal (teclado do celular em inglês mostra ".").
  if (tipo === "valor" && tipoEntrada === "insertText" && texto[pos - 1] === "." && !texto.includes(",")) {
    texto = `${texto.slice(0, pos - 1)},${texto.slice(pos)}`;
  }

  // Apagou só um separador: apaga o número ao lado, senão a máscara devolve o separador e o campo trava.
  const apagando = tipoEntrada === "deleteContentBackward" ? "tras" : tipoEntrada === "deleteContentForward" ? "frente" : null;
  if (apagando && texto.length < anterior.length && significantes(tipo, texto) === significantes(tipo, anterior)) {
    if (apagando === "tras") {
      for (let i = pos - 1; i >= 0; i--) {
        if (significantes(tipo, texto[i]!).length) { texto = texto.slice(0, i) + texto.slice(i + 1); pos = i; break; }
      }
    } else {
      for (let i = pos; i < texto.length; i++) {
        if (significantes(tipo, texto[i]!).length) { texto = texto.slice(0, i) + texto.slice(i + 1); break; }
      }
    }
  }

  const formatado = mascarar(tipo, texto, { colado });
  const antes = significantes(tipo, texto);
  const depois = significantes(tipo, formatado);
  const n = contaAte(tipo, texto, pos);
  let alvo: number;
  if (antes === depois) alvo = n;
  else if (antes.startsWith(depois)) alvo = Math.min(n, depois.length);
  else if (antes.endsWith(depois)) alvo = Math.max(0, n - (antes.length - depois.length));
  else return { valor: formatado, cursor: formatado.length };
  return { valor: formatado, cursor: alvo >= depois.length ? formatado.length : posicaoDepois(tipo, formatado, alvo) };
}
