import type { ConfirmLevel, AgentTopic, ToolRisk } from "./types";

/**
 * Metadados do catálogo, comuns ao servidor (política) e à gaveta (cartões). Nome em snake_case é o que o modelo vê;
 * `title` e `doing` são o que o diretor lê. Plano §4 e §12.
 */
export type CatalogEntry = {
  name: string;
  title: string;
  /** Texto do passo enquanto roda ("Procurando na equipe…"). */
  doing: string;
  topic: AgentTopic;
  risk: ToolRisk;
  roles: ReadonlyArray<"director" | "manager" | "supervisor" | "broker">;
  confirm: ConfirmLevel | ((input: Record<string, unknown>) => ConfirmLevel);
  /** Ação do dia a dia (§12) que esta ferramenta cobre. */
  covers?: string[];
};

const DIRECTOR = ["director"] as const;
const many = (key: string) => (input: Record<string, unknown>): ConfirmLevel =>
  Array.isArray(input[key]) && (input[key] as unknown[]).length > 1 ? "toque" : "direto";

export const AGENT_CATALOG = {
  pessoas_buscar: {
    name: "pessoas_buscar", title: "Buscar na equipe", doing: "Procurando na equipe…", topic: "consulta",
    risk: { readOnly: true }, roles: DIRECTOR, confirm: "direto",
  },
  plantao_agora: {
    name: "plantao_agora", title: "Plantões agora", doing: "Olhando os plantões de agora…", topic: "plantoes",
    risk: { readOnly: true }, roles: DIRECTOR, confirm: "direto", covers: ["A14"],
  },
  plantao_escala: {
    name: "plantao_escala", title: "Escala", doing: "Lendo a escala…", topic: "plantoes",
    risk: { readOnly: true }, roles: DIRECTOR, confirm: "direto", covers: ["A14"],
  },
  plantao_cadeiras_livres: {
    name: "plantao_cadeiras_livres", title: "Vagas livres", doing: "Procurando vagas livres…", topic: "plantoes",
    risk: { readOnly: true }, roles: DIRECTOR, confirm: "direto", covers: ["A1"],
  },
  plantao_escalar_em_vagas: {
    name: "plantao_escalar_em_vagas", title: "Escalar nos plantões", doing: "Escalando…", topic: "plantoes",
    // Fora do tipo ou acima do máximo é exceção: sempre pede o toque do diretor, mesmo com uma vaga só.
    risk: { readOnly: false, notifies: true }, roles: DIRECTOR,
    confirm: (input) => (input.fora_do_tipo === true || input.acima_do_maximo === true ? "toque" : many("ocorrencia_ids")(input)), covers: ["A1", "A2"],
  },
  plantao_tirar_de_vagas: {
    name: "plantao_tirar_de_vagas", title: "Tirar dos plantões", doing: "Tirando da escala…", topic: "plantoes",
    risk: { readOnly: false, notifies: true }, roles: DIRECTOR, confirm: many("ocorrencia_ids"), covers: ["A3", "A4"],
  },
  plantao_passar_cadeira: {
    name: "plantao_passar_cadeira", title: "Passar a cadeira", doing: "Passando a cadeira…", topic: "plantoes",
    risk: { readOnly: false, notifies: true }, roles: DIRECTOR, confirm: "toque", covers: ["A6"],
  },
  plantao_trocar_corretores: {
    name: "plantao_trocar_corretores", title: "Trocar de plantão", doing: "Trocando…", topic: "plantoes",
    risk: { readOnly: false, notifies: true }, roles: DIRECTOR, confirm: "toque", covers: ["A5"],
  },
  plantao_pausar: {
    name: "plantao_pausar", title: "Pausar no plantão", doing: "Mudando a pausa no plantão…", topic: "plantoes",
    risk: { readOnly: false }, roles: DIRECTOR, confirm: "direto", covers: ["A9"],
  },
  plantao_marcar_falta: {
    name: "plantao_marcar_falta", title: "Marcar falta", doing: "Registrando a falta…", topic: "plantoes",
    risk: { readOnly: false, notifies: true }, roles: DIRECTOR, confirm: "toque", covers: ["A7"],
  },
  plantao_liberar_presenca: {
    name: "plantao_liberar_presenca", title: "Liberar presença", doing: "Liberando a presença…", topic: "plantoes",
    risk: { readOnly: false }, roles: DIRECTOR, confirm: "toque", covers: ["A8"],
  },
  plantao_rodizio: {
    name: "plantao_rodizio", title: "Rodízio", doing: "Lendo o rodízio…", topic: "plantoes",
    risk: { readOnly: true }, roles: DIRECTOR, confirm: "direto", covers: ["A11", "A14"],
  },
  plantao_rodizio_ordenar: {
    name: "plantao_rodizio_ordenar", title: "Ordem do rodízio", doing: "Mudando a ordem do rodízio…", topic: "plantoes",
    risk: { readOnly: false }, roles: DIRECTOR, confirm: "direto", covers: ["A11"],
  },
  plantao_modo_online: {
    name: "plantao_modo_online", title: "Online no plantão", doing: "Mudando para online…", topic: "plantoes",
    risk: { readOnly: false }, roles: DIRECTOR, confirm: "direto", covers: ["A12"],
  },
  plantao_reenviar_convite: {
    name: "plantao_reenviar_convite", title: "Reenviar convite de presença", doing: "Reenviando o convite…", topic: "plantoes",
    risk: { readOnly: false, notifies: true }, roles: DIRECTOR, confirm: "toque", covers: ["A13"],
  },
  escala_mensal_situacao: {
    name: "escala_mensal_situacao", title: "Escala do mês", doing: "Lendo a escala do mês…", topic: "plantoes",
    risk: { readOnly: true }, roles: DIRECTOR, confirm: "direto", covers: ["A14", "A16"],
  },
  escala_mensal_publicar: {
    name: "escala_mensal_publicar", title: "Publicar a escala", doing: "Publicando a escala…", topic: "plantoes",
    risk: { readOnly: false, notifies: true, destructive: true }, roles: DIRECTOR, confirm: "forte", covers: ["A16"],
  },
  escala_tirar_dia: {
    name: "escala_tirar_dia", title: "Tirar o dia da escala", doing: "Tirando o dia da escala…", topic: "plantoes",
    risk: { readOnly: false, notifies: true, destructive: true }, roles: DIRECTOR, confirm: "forte", covers: ["A15"],
  },
  leads_buscar: {
    name: "leads_buscar", title: "Buscar leads", doing: "Procurando leads…", topic: "leads",
    risk: { readOnly: true }, roles: DIRECTOR, confirm: "direto", covers: ["B9"],
  },
  lead_detalhe: {
    name: "lead_detalhe", title: "Lead", doing: "Abrindo o lead…", topic: "leads",
    risk: { readOnly: true }, roles: DIRECTOR, confirm: "direto", covers: ["B9"],
  },
  plantao_leads_sem_dono: {
    name: "plantao_leads_sem_dono", title: "Leads esperando no plantão", doing: "Vendo os leads do plantão…", topic: "distribuicao",
    risk: { readOnly: true }, roles: DIRECTOR, confirm: "direto", covers: ["B1", "B9"],
  },
  plantao_dar_leads: {
    name: "plantao_dar_leads", title: "Passar leads do plantão", doing: "Passando os leads…", topic: "distribuicao",
    risk: { readOnly: false, notifies: true }, roles: DIRECTOR,
    confirm: (input) => ((Array.isArray(input.lead_ids) ? (input.lead_ids as unknown[]).length : Number(input.quantidade ?? 1)) > 3 ? "toque" : "direto"), covers: ["B1"],
  },
  lead_dar: {
    name: "lead_dar", title: "Dar o lead", doing: "Passando o lead…", topic: "distribuicao",
    risk: { readOnly: false, notifies: true }, roles: DIRECTOR, confirm: "direto", covers: ["B2"],
  },
  lead_tirar_corretor: {
    name: "lead_tirar_corretor", title: "Tirar o lead do corretor", doing: "Tirando o lead…", topic: "distribuicao",
    risk: { readOnly: false }, roles: DIRECTOR, confirm: many("lead_ids"), covers: ["B3"],
  },
  plantao_devolver_leads: {
    name: "plantao_devolver_leads", title: "Devolver leads", doing: "Devolvendo os leads…", topic: "distribuicao",
    risk: { readOnly: false, notifies: true }, roles: DIRECTOR, confirm: "direto",
  },
  carteira_transferir: {
    name: "carteira_transferir", title: "Transferir a carteira", doing: "Transferindo a carteira…", topic: "distribuicao",
    risk: { readOnly: false, notifies: true, destructive: true }, roles: DIRECTOR, confirm: "forte", covers: ["B4"],
  },
  lead_reenviar_oferta: {
    name: "lead_reenviar_oferta", title: "Reenviar a oferta", doing: "Reenviando a oferta…", topic: "distribuicao",
    risk: { readOnly: false, notifies: true }, roles: DIRECTOR, confirm: "direto", covers: ["B5"],
  },
  lead_mudar_etapa: {
    name: "lead_mudar_etapa", title: "Mudar a etapa", doing: "Mudando a etapa…", topic: "leads",
    risk: { readOnly: false }, roles: DIRECTOR,
    confirm: (input) => (Array.isArray(input.lead_ids) && (input.lead_ids as unknown[]).length > 1 ? "toque" : input.etapa === "lost" ? "toque" : "direto"), covers: ["B6"],
  },
  lead_anotar: {
    name: "lead_anotar", title: "Nota no lead", doing: "Anotando…", topic: "leads",
    risk: { readOnly: false, notifies: true }, roles: DIRECTOR, confirm: "direto", covers: ["B7"],
  },
  lead_tarefa: {
    name: "lead_tarefa", title: "Tarefa no lead", doing: "Criando a tarefa…", topic: "leads",
    risk: { readOnly: false, notifies: true }, roles: DIRECTOR, confirm: "direto", covers: ["B7"],
  },
  fila_distribuir_sem_dono: {
    name: "fila_distribuir_sem_dono", title: "Distribuir os sem dono", doing: "Distribuindo…", topic: "distribuicao",
    risk: { readOnly: false, notifies: true, destructive: true }, roles: DIRECTOR, confirm: "forte", covers: ["B8"],
  },
  corretor_diagnosticar: {
    name: "corretor_diagnosticar", title: "Diagnóstico do corretor", doing: "Verificando por que não recebe…", topic: "consulta",
    risk: { readOnly: true }, roles: DIRECTOR, confirm: "direto", covers: ["B10"],
  },
  unidades_buscar: {
    name: "unidades_buscar", title: "Unidades", doing: "Procurando a unidade…", topic: "consulta",
    risk: { readOnly: true }, roles: DIRECTOR, confirm: "direto", covers: ["C3"],
  },
  equipe_listar: {
    name: "equipe_listar", title: "Equipe", doing: "Lendo a equipe…", topic: "equipe",
    risk: { readOnly: true }, roles: DIRECTOR, confirm: "direto", covers: ["C7"],
  },
  membro_convidar: {
    name: "membro_convidar", title: "Convidar corretor", doing: "Convidando…", topic: "equipe",
    risk: { readOnly: false, notifies: true }, roles: DIRECTOR, confirm: "toque", covers: ["C1"],
  },
  convites_pendentes: {
    name: "convites_pendentes", title: "Convites pendentes", doing: "Lendo os convites…", topic: "equipe",
    risk: { readOnly: true }, roles: DIRECTOR, confirm: "direto", covers: ["C2"],
  },
  convite_reenviar: {
    name: "convite_reenviar", title: "Reenviar convite", doing: "Reenviando o convite…", topic: "equipe",
    risk: { readOnly: false, notifies: true }, roles: DIRECTOR, confirm: "direto", covers: ["C2"],
  },
  convite_revogar: {
    name: "convite_revogar", title: "Revogar convite", doing: "Revogando o convite…", topic: "equipe",
    risk: { readOnly: false, destructive: true }, roles: DIRECTOR, confirm: "toque", covers: ["C2"],
  },
  membro_trocar_unidade: {
    name: "membro_trocar_unidade", title: "Trocar de unidade", doing: "Trocando de unidade…", topic: "equipe",
    risk: { readOnly: false, notifies: true }, roles: DIRECTOR, confirm: "toque", covers: ["C3"],
  },
  membro_ativar: {
    name: "membro_ativar", title: "Ativar ou desativar acesso", doing: "Mudando o acesso…", topic: "equipe",
    risk: { readOnly: false, destructive: true }, roles: DIRECTOR, confirm: "toque", covers: ["C4"],
  },
  corretores_mensagem: {
    name: "corretores_mensagem", title: "Mensagem para corretores", doing: "Enviando a mensagem…", topic: "equipe",
    risk: { readOnly: false, notifies: true, external: true }, roles: DIRECTOR, confirm: "forte", covers: ["C5"],
  },
  aviso_inicio: {
    name: "aviso_inicio", title: "Aviso no Início", doing: "Publicando o aviso…", topic: "equipe",
    risk: { readOnly: false, notifies: true }, roles: DIRECTOR, confirm: "toque", covers: ["C6"],
  },
  conversa_assumir: {
    name: "conversa_assumir", title: "Assumir a conversa", doing: "Assumindo a conversa…", topic: "conversas",
    risk: { readOnly: false }, roles: DIRECTOR, confirm: "direto", covers: ["D1"],
  },
  conversa_devolver_ia: {
    name: "conversa_devolver_ia", title: "Devolver a conversa à IA", doing: "Devolvendo à IA…", topic: "conversas",
    risk: { readOnly: false, external: false }, roles: DIRECTOR, confirm: "toque", covers: ["D1"],
  },
  mensagem_cliente: {
    name: "mensagem_cliente", title: "Mensagem ao cliente", doing: "Enviando ao cliente…", topic: "conversas",
    risk: { readOnly: false, external: true }, roles: DIRECTOR, confirm: "forte", covers: ["D2"],
  },
  unidade_receber_leads: {
    name: "unidade_receber_leads", title: "Entrada de leads da unidade", doing: "Mudando a entrada de leads…", topic: "distribuicao",
    risk: { readOnly: false }, roles: DIRECTOR, confirm: "toque", covers: ["D3"],
  },
  filas_buscar: {
    name: "filas_buscar", title: "Filas", doing: "Lendo as filas…", topic: "consulta",
    risk: { readOnly: true }, roles: DIRECTOR, confirm: "direto", covers: ["D4"],
  },
  fila_modo: {
    name: "fila_modo", title: "Modo da fila", doing: "Mudando o modo da fila…", topic: "distribuicao",
    risk: { readOnly: false }, roles: DIRECTOR, confirm: "toque", covers: ["D4"],
  },
  operacao_saude: {
    name: "operacao_saude", title: "Saúde da operação", doing: "Verificando WhatsApp e IA…", topic: "consulta",
    risk: { readOnly: true }, roles: DIRECTOR, confirm: "direto", covers: ["D5"],
  },
  relatorio_plantao_enviar: {
    name: "relatorio_plantao_enviar", title: "Enviar o relatório do plantão", doing: "Enviando o relatório…", topic: "plantoes",
    risk: { readOnly: false, notifies: true }, roles: DIRECTOR, confirm: "toque", covers: ["D6"],
  },
  agente_historico: {
    name: "agente_historico", title: "O que o agente fez", doing: "Lendo o histórico…", topic: "sistema",
    risk: { readOnly: true }, roles: DIRECTOR, confirm: "direto",
  },
  corretor_pausar: {
    name: "corretor_pausar", title: "Pausar recebimento", doing: "Mudando o recebimento de leads…", topic: "equipe",
    risk: { readOnly: false }, roles: DIRECTOR, confirm: many("corretor_ids"), covers: ["A10"],
  },
  escolher: {
    name: "escolher", title: "Escolha", doing: "Esperando sua escolha…", topic: "sistema",
    risk: { readOnly: true }, roles: DIRECTOR, confirm: "direto",
  },
} satisfies Record<string, CatalogEntry>;

export type AgentToolName = keyof typeof AGENT_CATALOG;

export function catalogEntry(name: string): CatalogEntry | null {
  return (AGENT_CATALOG as Record<string, CatalogEntry>)[name] ?? null;
}
