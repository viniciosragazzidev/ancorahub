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
    risk: { readOnly: false, notifies: true }, roles: DIRECTOR, confirm: many("ocorrencia_ids"), covers: ["A1", "A2"],
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
