/**
 * Pontuação do lead (plano §7): matriz Perfil A–D × Interesse 1–4, no estilo RD Station, com decaimento semanal
 * do interesse. Pura. Usada para ordenar a fila de ligação e o Call Âncora e mostrada como "A3".
 * NUNCA usa condição de saúde (dado sensível, LGPD art. 11, e seleção de risco vedada pela ANS).
 * Os pesos são o ponto de partida: recalibrar com a taxa real de venda por célula depois de 8 semanas.
 */

export type LeadScoreInput = {
  now?: Date;
  /** individual | familiar | empresarial (memória da IA). */
  planType?: string | null;
  companyHasCnpj?: boolean;
  lives?: number | null;
  agesInformed?: boolean;
  /** A cidade caiu numa fila ativa (o lead tem fila). */
  cityServed?: boolean;
  operatorRequested?: boolean;
  /** Fora da área ou sem perfil: vai direto para D. */
  outOfProfile?: boolean;
  firstReplyMinutes?: number | null;
  replied?: boolean;
  readLast?: boolean;
  askedForCall?: boolean;
  openedQuote?: boolean;
  lastInteractionAt?: Date | string | null;
};

export type LeadScore = {
  profile: "A" | "B" | "C" | "D";
  interest: 1 | 2 | 3 | 4;
  label: string;
  profilePoints: number;
  interestPoints: number;
  /** Para ordenar: perfil primeiro, interesse depois (A4 = 44 … D1 = 11). */
  rank: number;
};

export function profilePoints(input: LeadScoreInput) {
  const plan = (input.planType ?? "").toLowerCase();
  let points = 0;
  if (/empres|pme/.test(plan)) points += input.companyHasCnpj === false ? 20 : 30;
  else if (/famil/.test(plan)) points += 20;
  else if (/indiv/.test(plan)) points += 10;
  if ((input.lives ?? 0) >= 2) points += 15;
  if (input.agesInformed) points += 15;
  if (input.cityServed) points += 15;
  if (input.operatorRequested) points += 10;
  return points;
}

export function interestPoints(input: LeadScoreInput) {
  let points = 0;
  if (input.replied) points += input.firstReplyMinutes !== null && input.firstReplyMinutes !== undefined && input.firstReplyMinutes <= 20 ? 25 : 15;
  if (input.readLast) points += 10;
  if (input.askedForCall) points += 30;
  if (input.openedQuote) points += 20;
  // −25% por semana sem interação.
  const last = input.lastInteractionAt ? new Date(input.lastInteractionAt) : null;
  if (last && !Number.isNaN(last.getTime())) {
    const weeks = Math.max(0, Math.floor(((input.now ?? new Date()).getTime() - last.getTime()) / (7 * 86_400_000)));
    points = points * Math.pow(0.75, weeks);
  }
  return Math.round(points);
}

export function scoreLead(input: LeadScoreInput): LeadScore {
  const profileValue = profilePoints(input);
  const interestValue = interestPoints(input);
  const profile: LeadScore["profile"] = input.outOfProfile ? "D" : profileValue >= 60 ? "A" : profileValue >= 40 ? "B" : profileValue >= 20 ? "C" : "D";
  const interest: LeadScore["interest"] = interestValue >= 50 ? 4 : interestValue >= 30 ? 3 : interestValue >= 15 ? 2 : 1;
  const profileRank = { A: 4, B: 3, C: 2, D: 1 }[profile];
  return { profile, interest, label: `${profile}${interest}`, profilePoints: profileValue, interestPoints: interestValue, rank: profileRank * 10 + interest };
}

/** Perfil A com interesse 3 ou 4 vai direto ao corretor, mesmo sem completar a qualificação (§7). */
export function goesStraightToBroker(score: LeadScore) {
  return score.profile === "A" && score.interest >= 3;
}

/** Lê a memória da IA (sem dado de saúde) para os campos do perfil. */
export function scoreInputFromMemory(memory: unknown): Pick<LeadScoreInput, "planType" | "companyHasCnpj" | "lives" | "agesInformed"> {
  const value = (key: string) => {
    const field = memory && typeof memory === "object" ? (memory as Record<string, { value?: unknown } | undefined>)[key] : undefined;
    return field && field.value !== undefined && field.value !== null && field.value !== "" ? String(field.value) : null;
  };
  const lives = Number.parseInt(value("numberOfLives") ?? "", 10);
  const cnpj = value("companyHasCnpj");
  return {
    planType: value("planType"),
    companyHasCnpj: cnpj === null ? undefined : !/^(n[aã]o|false|no)$/i.test(cnpj),
    lives: Number.isFinite(lives) ? lives : null,
    agesInformed: Boolean(value("age") || value("averageAge")),
  };
}
