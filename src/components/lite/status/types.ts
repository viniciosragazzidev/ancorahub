/**
 * Contrato do status vivo (plano 2026-10-27-status-vivos, seção 2). Datas em ISO; a regra de gravidade mora no
 * provedor, nunca na tela. É o mesmo tipo que a rota /api/live-status devolve.
 */
export type LiveSeverity = "ok" | "info" | "atencao" | "critico";

export type LiveStatusEvent = {
  /** Quando acontece (ISO). */
  at: string;
  /** O que acontece, sem o "em": "Próxima requalificação automática", "A primeira expira". */
  label: string;
  /** Início da janela que termina em `at`: com ela, a barra de progresso aparece. */
  windowStartAt?: string;
  /** Texto quando a contagem chega a zero ("Rodando agora"). Padrão: "Rodando agora". */
  dueLabel?: string;
};

export type LiveStatus = {
  id: string;
  label: string;
  /** Número principal. Zero vira `emptyText`. */
  value: number;
  /** Frase do zero ("Nenhum lead frio agora"). */
  emptyText: string;
  /** Texto curto no lugar do número quando a contagem não é a informação (ex.: "5 de 7"). */
  valueText?: string;
  severity: LiveSeverity;
  nextEvent?: LiveStatusEvent;
  /** Sem evento calculável, o último ("Última rodada" + há 40 s). */
  lastEvent?: { at: string; label: string };
  /** Linha fixa no lugar do próximo evento (ex.: "Pausado até as 08:00" já vem dentro de nextEvent; isto é para estados sem hora). */
  note?: string;
  /** Uma frase com ponto final: o porquê ou o que acontece depois. */
  explanation: string;
  /** Tela onde se age, com o filtro já aplicado. Sem permissão de agir: sem link. */
  action?: { href: string; label: string };
  /** Até 3 quebras. */
  breakdown?: Array<{ label: string; value: number }>;
  generatedAt: string;
  /** O provedor não respondeu a tempo: é o último valor conhecido. */
  stale?: boolean;
};

/** Selo pequeno da faixa (motor de distribuição). */
export type LiveSeal = {
  id: string;
  label: string;
  severity: LiveSeverity;
  lastRunAt: string | null;
  nextRunAt: string | null;
  /** Frase curta do problema, só quando há ("2 leads falharam 3 vezes e pedem revisão."). */
  detail?: string;
  action?: { href: string; label: string };
  generatedAt: string;
};
