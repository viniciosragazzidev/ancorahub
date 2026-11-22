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
  plantao_pausar: {
    name: "plantao_pausar", title: "Pausar no plantão", doing: "Mudando a pausa no plantão…", topic: "plantoes",
    risk: { readOnly: false }, roles: DIRECTOR, confirm: "direto", covers: ["A9"],
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
