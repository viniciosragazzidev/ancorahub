/** Frases de exceção do Início (G4). Puras. Sem métrica nunca dizemos "em dia" por engano: quem chama só usa com dado. */

export function teamsNeedPhrase(count: number): string {
  if (count === 0) return "Todas as equipes em dia";
  if (count === 1) return "1 equipe precisa de atenção";
  return `${count} equipes precisam de atenção`;
}

export function brokersNeedPhrase(count: number): string {
  if (count === 0) return "Ninguém precisa de você agora";
  if (count === 1) return "1 corretor precisa de você";
  return `${count} corretores precisam de você`;
}
