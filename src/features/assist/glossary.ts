/**
 * Words of the broker's day, explained in one or two sentences (plan §5, E7).
 * Used by <Term> wherever the word shows up, so the meaning is always one tap
 * away and always the same.
 */
export type GlossaryKey = "sla" | "offer" | "duty" | "step" | "mission" | "board" | "level" | "streak" | "evidence" | "return";

export const GLOSSARY: Record<GlossaryKey, { term: string; meaning: string; why: string }> = {
  sla: { term: "Prazo do primeiro contato", meaning: "O tempo que você tem, depois de receber o lead, para mandar a primeira mensagem ao cliente.", why: "Quem fala primeiro com o cliente fecha mais. Passar do prazo conta como atraso." },
  offer: { term: "Oferta de lead", meaning: "Um lead chegando para você aceitar. Ela expira em pouco tempo e passa para outro corretor.", why: "Aceitar rápido mostra que você está disponível e mantém você recebendo." },
  duty: { term: "Plantão", meaning: "O horário em que você está escalado para receber leads da sua unidade.", why: "Durante o plantão a fila manda leads para você; fora dele, só se você estiver disponível." },
  step: { term: "Etapa", meaning: "Em que ponto do atendimento o cliente está: novo, em atendimento, cotação, negociação, documentos.", why: "A gestão vê o funil da equipe por etapa. Etapa em dia é atendimento organizado." },
  mission: { term: "Missão", meaning: "Um objetivo do dia ou da semana, como responder todo lead em até 5 minutos.", why: "Concluir dá pontos de bônus na sua jornada." },
  board: { term: "Placar", meaning: "A posição de cada um pelos pontos da semana. Zera toda segunda.", why: "Você pode sair do placar em Configurações; continua vendo a sua posição." },
  level: { term: "Nível", meaning: "Sua carreira no app: soma de todos os pontos que você já ganhou. Nunca zera.", why: "Vai de Iniciante a Mestre conforme você atende bem ao longo do tempo." },
  streak: { term: "Sequência", meaning: "Dias seguidos de plantão com todo primeiro contato dentro do prazo.", why: "Dia sem plantão não quebra a sequência." },
  evidence: { term: "Ponto com evidência", meaning: "Só vale ponto o que ficou registrado de verdade, como a mensagem enviada ao cliente.", why: "Tocar em um botão sozinho não dá ponto. Assim o placar é justo para todo mundo." },
  return: { term: "Retorno", meaning: "Um lembrete para voltar a falar com o cliente num dia e horário combinados.", why: "Retorno feito no horário dá pontos e evita perder o cliente." },
};
