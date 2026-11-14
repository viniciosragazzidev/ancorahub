/**
 * Telefone brasileiro na entrada (Postel: aceita bagunçado, devolve limpo).
 *
 * Aceita +55, 0055, 0 de discagem (021...), código de operadora (0 15 21 ...), parênteses, espaços, pontos,
 * traços e celular antigo com 8 dígitos. Devolve:
 * - `e164`: 55 + DDD + número, só dígitos (E.164 sem o +), para comparar e para quem decidir gravar assim;
 * - `exibicao`: "(21) 99999-9999" ou "(21) 2222-3333".
 *
 * ATENÇÃO: o banco hoje guarda `leads.telefone` em formato MISTO por porta de entrada ("+55...", "55DDDnum" e
 * "DDDnum"). Nenhuma porta deve passar a gravar `e164` sem decisão explícita: as portas antigas usam as funções
 * "legado" abaixo, idênticas às cópias que existiam espalhadas (provado em telefone.test.ts).
 */

/** DDDs válidos no Brasil (Anatel). */
const DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19,
  21, 22, 24, 27, 28,
  31, 32, 33, 34, 35, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48, 49,
  51, 53, 54, 55,
  61, 62, 63, 64, 65, 66, 67, 68, 69,
  71, 73, 74, 75, 77, 79,
  81, 82, 83, 84, 85, 86, 87, 88, 89,
  91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

export type MotivoTelefoneInvalido = "vazio" | "curto" | "longo" | "ddd" | "formato" | "internacional";

export type TelefoneLido =
  | { ok: true; e164: string; nacional: string; ddd: string; celular: boolean; exibicao: string }
  | { ok: false; motivo: MotivoTelefoneInvalido; mensagem: string };

const MENSAGENS: Record<MotivoTelefoneInvalido, string> = {
  vazio: "Informe o telefone com DDD.",
  curto: "Faltam números. Informe o DDD e o telefone, ex.: (21) 99999-9999.",
  longo: "Número com dígitos a mais. Confira o DDD e o telefone.",
  ddd: "DDD não reconhecido. Confira os dois primeiros números.",
  formato: "Celular com DDD começa com 9 depois do DDD, ex.: (21) 99999-9999.",
  internacional: "Só aceitamos telefone do Brasil (+55).",
};

const so = (valor: string) => valor.replace(/\D/g, "");

function falha(motivo: MotivoTelefoneInvalido): TelefoneLido {
  return { ok: false, motivo, mensagem: MENSAGENS[motivo] };
}

/** Tira +55/0055, o 0 de discagem e o código de operadora. Devolve só DDD + número (ou o que sobrar). */
function paraNacional(entrada: string): { nacional: string; estrangeiro: boolean } {
  const texto = entrada.trim();
  let digitos = so(texto);
  if (texto.startsWith("+")) {
    return digitos.startsWith("55") ? { nacional: digitos.slice(2), estrangeiro: false } : { nacional: digitos, estrangeiro: true };
  }
  if (digitos.startsWith("00")) {
    digitos = digitos.slice(2);
    return digitos.startsWith("55") ? { nacional: digitos.slice(2), estrangeiro: false } : { nacional: digitos, estrangeiro: true };
  }
  if (digitos.startsWith("0")) {
    digitos = digitos.slice(1);
    // 0 + operadora (2) + DDD + número.
    if ((digitos.length === 12 || digitos.length === 13) && !digitos.startsWith("55")) digitos = digitos.slice(2);
  }
  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith("55")) digitos = digitos.slice(2);
  return { nacional: digitos, estrangeiro: false };
}

function exibir(nacional: string) {
  const ddd = nacional.slice(0, 2);
  const numero = nacional.slice(2);
  const corte = numero.length - 4;
  return `(${ddd}) ${numero.slice(0, corte)}-${numero.slice(corte)}`;
}

/** Lê um telefone digitado ou colado de qualquer jeito. Inválido volta com o motivo e uma mensagem pronta. */
export function lerTelefone(entrada: string | null | undefined): TelefoneLido {
  if (!entrada || !so(entrada)) return falha("vazio");
  const { nacional: bruto, estrangeiro } = paraNacional(entrada);
  if (estrangeiro) return falha("internacional");
  if (bruto.length < 10) return falha("curto");
  if (bruto.length > 11) return falha("longo");
  const ddd = Number(bruto.slice(0, 2));
  if (!DDDS.has(ddd)) return falha("ddd");
  let nacional = bruto;
  const primeiro = bruto[2]!;
  if (bruto.length === 11 && primeiro !== "9") return falha("formato");
  // Celular antigo com 8 dígitos (começa com 6 a 9): ganha o 9, como faz o WhatsApp.
  if (bruto.length === 10 && /[6-9]/.test(primeiro)) nacional = `${bruto.slice(0, 2)}9${bruto.slice(2)}`;
  if (nacional.length === 10 && !/[2-5]/.test(primeiro)) return falha("formato");
  const celular = nacional.length === 11;
  return { ok: true, e164: `55${nacional}`, nacional, ddd: nacional.slice(0, 2), celular, exibicao: exibir(nacional) };
}

/** 55 + DDD + número (só dígitos) ou null quando não é um telefone válido do Brasil. */
export function normalizarTelefone(entrada: string | null | undefined): string | null {
  const lido = lerTelefone(entrada);
  return lido.ok ? lido.e164 : null;
}

/** "(21) 99999-9999" para exibir. Se não der para ler, devolve o texto como veio (sem espaços nas pontas). */
export function formatarTelefone(entrada: string | null | undefined): string {
  const lido = lerTelefone(entrada);
  return lido.ok ? lido.exibicao : (entrada ?? "").trim();
}

/**
 * Mesmo telefone? Compara os 8 últimos dígitos, como já fazem a distribuição e os canais, e tolera o 9 a mais
 * ou a menos e o 55 presente ou ausente.
 */
export function mesmoTelefone(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = so(a ?? "");
  const y = so(b ?? "");
  if (x.length < 8 || y.length < 8) return false;
  return x.slice(-8) === y.slice(-8);
}

/**
 * Máscara enquanto digita: "(21) 99999-9999". Colar "+55 21 99999-9999", "021 99999 9999" ou "5521999999999"
 * também vira o formato nacional. Começando com "+", mantém o "+55 " na frente para não brigar com quem digita.
 */
export function mascararTelefoneDigitado(entrada: string): string {
  const texto = entrada.trimStart();
  const digitos = so(texto);
  if (!digitos) return texto.startsWith("+") ? "+" : "";
  if (texto.startsWith("+")) {
    if (!digitos.startsWith("55")) return `+${digitos.slice(0, 15)}`;
    const resto = digitos.slice(2);
    return resto ? `+55 ${progressivo(resto.slice(0, 11))}` : "+55";
  }
  // Com 0 na frente, espera completar para saber o que é discagem.
  if (digitos.startsWith("0") && digitos.length < 11) return digitos;
  const { nacional } = paraNacional(digitos);
  return progressivo(nacional.slice(0, 11));
}

function progressivo(d: string): string {
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

// ─── Legado: formatos que portas antigas gravam ou mostram hoje (não mudar sem decisão) ─────────────────────

/**
 * Cadastro manual e carteira anterior (antigo `normalizePhone` de features/leads/manual-create.ts): tira o 55 de
 * 12 ou 13 dígitos, põe o 9 em 10 dígitos e sempre devolve com 55. É o formato "55DDDnum" gravado em leads.telefone.
 */
export function telefoneCadastroManual(entrada: string): string {
  let digitos = entrada.replace(/\D/g, "");
  if (digitos.startsWith("55") && (digitos.length === 12 || digitos.length === 13)) digitos = digitos.slice(2);
  if (digitos.length === 10) digitos = `${digitos.slice(0, 2)}9${digitos.slice(2)}`;
  return `55${digitos}`;
}

/** Extensão do navegador (antigo `normalizePhone` de browser-extension/schemas.ts): "+" + dígitos, 00 vira +. */
export function telefoneComMais(entrada: string): string {
  const digitos = entrada.replace(/\D/g, "");
  if (!digitos) return "";
  if (digitos.startsWith("00")) return `+${digitos.slice(2)}`;
  return `+${digitos}`;
}

/** Número confirmado do canal da corretora (antigo `formatPhone` do tenant-channel-card): "+55 (21) 99999-9999". */
export function formatarTelefoneCanal(digitos: string | null): string | null {
  if (!digitos) return null;
  const nacional = digitos.startsWith("55") && digitos.length >= 12 ? digitos.slice(2) : digitos;
  if (nacional.length === 11) return `+55 (${nacional.slice(0, 2)}) ${nacional.slice(2, 7)}-${nacional.slice(7)}`;
  if (nacional.length === 10) return `+55 (${nacional.slice(0, 2)}) ${nacional.slice(2, 6)}-${nacional.slice(6)}`;
  return `+${digitos}`;
}
