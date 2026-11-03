// Fonte única da credencial da extensão, no service worker.
// Cada sessão tem uma geração (uuid). Toda mudança (troca de código, rotação, saída, descarte por 401)
// é condicional à geração que o chamador conhece e roda numa fila única: nada grava ou apaga credencial
// de outra conta por ter chegado tarde.

export type Perfil = { nome: string; unidade: string; userId: string; sessionId: string };
export type Credencial = { geracao: string; token: string; tokenEm: number; perfil: Perfil | null };

export type Armazenamento = {
  ler(): Promise<Credencial | null>;
  gravar(credencial: Credencial | null): Promise<void>;
};

/** Operações da credencial. Todas são atômicas dentro do worker (uma por vez). */
export function criarCredencialStore(armazem: Armazenamento, aoMudar: () => void = () => undefined) {
  let fila: Promise<unknown> = Promise.resolve();

  function emFila<T>(tarefa: () => Promise<T>): Promise<T> {
    const proxima = fila.then(tarefa, tarefa);
    fila = proxima.catch(() => undefined);
    return proxima;
  }

  return {
    /** Leitura única: token, geração e perfil saem da mesma leitura. */
    ler: () => emFila(() => armazem.ler()),

    /** Nova sessão (troca de código). Substitui qualquer credencial anterior, de qualquer conta. */
    trocar: (token: string, perfil: Perfil | null, tokenEm: number) => emFila(async () => {
      const nova: Credencial = { geracao: crypto.randomUUID(), token, tokenEm, perfil };
      await armazem.gravar(nova);
      aoMudar();
      return nova;
    }),

    /** Rotação: troca o token só se a credencial ainda é a da geração pedida. */
    rotacionar: (geracao: string, token: string, tokenEm: number) => emFila(async () => {
      const atual = await armazem.ler();
      if (!atual || atual.geracao !== geracao) return null;
      const nova: Credencial = { ...atual, token, tokenEm };
      await armazem.gravar(nova);
      return nova;
    }),

    /** Remove a credencial só se ainda for a da geração pedida. Devolve se removeu. */
    sairSe: (geracao: string) => emFila(async () => {
      const atual = await armazem.ler();
      if (!atual || atual.geracao !== geracao) return false;
      await armazem.gravar(null);
      aoMudar();
      return true;
    }),
  };
}

export type CredencialStore = ReturnType<typeof criarCredencialStore>;

/** Armazenamento real: chrome.storage.session (só o worker e as páginas da extensão leem). */
export function armazenamentoDeSessao(): Armazenamento {
  return {
    async ler() {
      const { credencial } = await chrome.storage.session.get("credencial");
      return credencial && typeof credencial === "object" ? (credencial as Credencial) : null;
    },
    async gravar(credencial) {
      if (credencial) await chrome.storage.session.set({ credencial });
      else await chrome.storage.session.remove("credencial");
    },
  };
}
