// Regras de tamanho e de saída da extensão, em funções puras (o build e o prebuild só chamam estas).

// Medidas em gzip, como a README da extensão registra (service worker + conteúdo: 30 KB; painel React: 200 KB).
export const LIMITES_EXTENSAO = [
  { nome: "service worker + conteúdo", arquivos: ["background-service-worker.js", "content-index.js"], limiteBytes: 30 * 1024 },
  { nome: "painel React", arquivos: ["panel/panel.js"], limiteBytes: 200 * 1024 },
];

/**
 * Tamanho gzip por arquivo (bytes) contra cada limite. Devolve uma linha por grupo que passou do limite.
 * Arquivo que não foi medido conta como zero: o build que não gerou um arquivo não passa silencioso aqui,
 * porque o grupo então fica sem nada para medir e o build em modo estrito já falhou antes.
 */
export function verificarLimites(gzipPorArquivo, limites = LIMITES_EXTENSAO) {
  return limites.flatMap(({ nome, arquivos, limiteBytes }) => {
    const total = arquivos.reduce((soma, arquivo) => soma + (gzipPorArquivo[arquivo] ?? 0), 0);
    return total > limiteBytes ? [`${nome}: ${(total / 1024).toFixed(1)} KB gzip (limite ${limiteBytes / 1024} KB)`] : [];
  });
}

/**
 * Código de saída do prebuild. Fora do modo estrito, o build do site segue (0) mesmo sem zip novo.
 * No modo estrito (CI, EXTENSION_STRICT=1) sem zip publicado, sai com o código da falha, nunca com 0.
 */
export function decidirSaidaPrebuild({ estrito, publicado, codigoFalha }) {
  if (publicado || !estrito) return 0;
  return codigoFalha || 1;
}
