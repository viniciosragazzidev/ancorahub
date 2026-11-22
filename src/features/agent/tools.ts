import { tool } from "ai";
import { z } from "zod";

import type { AgentBackend, AgentActionRecord } from "./backend";
import { matchPeople } from "./people-match";
import { hasFreeSeat, hhmm, matchesSeat, pickSeats, seatLabel, seatsOf, understaffed } from "./seats";
import type { Person, SeatOccurrence, ToolResult } from "./types";

/**
 * Ferramentas do agente do diretor (fase 0 + A14 + A1, plano §12). Cada uma devolve `ToolResult`: frase curta para o
 * modelo e para o diretor, dados com nomes legíveis e, nas escritas, Desfazer. Escrita recebe ids resolvidos, nunca nome.
 */
export type ToolEnv = {
  backend: AgentBackend;
  /** Última frase do diretor (vai para a trilha). */
  requestText: string | null;
  /** Se a chamada foi aprovada por toque (para a trilha). */
  approvedByUser: (toolCallId: string) => boolean;
};

const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use AAAA-MM-DD.");
const OCCURRENCE_ID = z.string().min(12).max(160).regex(/:\d{4}-\d{2}-\d{2}$/, "Use o ocorrencia_id devolvido por plantao_escala ou plantao_cadeiras_livres.");
const PERSON_ID = z.string().min(1).max(80);
const DAY_MS = 86_400_000;
const SP_OFFSET_MS = 3 * 3_600_000;

/** Data de hoje em São Paulo (sem horário de verão desde 2019). */
export function spDateKey(date: Date) {
  return new Date(date.getTime() - SP_OFFSET_MS).toISOString().slice(0, 10);
}

function addDays(dateKey: string, days: number) {
  return new Date(Date.parse(`${dateKey}T12:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

function dayLabel(dateKey: string) {
  return `${dateKey.slice(8, 10)}/${dateKey.slice(5, 7)}`;
}

function nameOf(people: Map<string, Person>, id: string) {
  return people.get(id)?.name ?? "Corretor";
}

function fail(code: string, message: string, fix: string): ToolResult {
  return { ok: false, message, error: { code, fix } };
}

function personLine(person: Person) {
  const unit = person.branchName ? `, ${person.branchName}` : "";
  const state = person.status !== "active" ? " (inativo)" : person.availability === "paused" ? " (pausado)" : "";
  return `${person.name}${unit}${state}`;
}

const ROLE_LABEL: Record<Person["role"], string> = { director: "diretor", manager: "gestor", supervisor: "supervisor", broker: "corretor" };

export function buildAgentTools(env: ToolEnv) {
  const { backend } = env;

  async function peopleMap() {
    return new Map((await backend.listPeople()).map((person) => [person.id, person]));
  }

  async function seatsBetween(from: string, until: string) {
    return backend.listSeats({ from, until });
  }

  /** Escrita com idempotência (reenvio devolve o que já foi feito) e trilha em agent_actions. */
  async function write(
    name: string,
    toolCallId: string,
    input: Record<string, unknown>,
    run: () => Promise<ToolResult>,
  ): Promise<ToolResult> {
    const previous = await backend.recorded(toolCallId).catch(() => null);
    if (previous) return { ok: previous.status === "done", message: previous.message, actionId: previous.id };
    const started = Date.now();
    let result: ToolResult;
    try {
      result = await run();
    } catch (error) {
      result = fail("erro", error instanceof Error ? error.message : "Não foi possível concluir.", "Nada foi alterado. Tente de novo.");
    }
    const entry: AgentActionRecord = {
      toolCallId,
      tool: name,
      requestText: env.requestText,
      input,
      approval: env.approvedByUser(toolCallId) ? "user" : "auto",
      status: result.ok ? "done" : "failed",
      message: result.message,
      undo: result.ok ? result.undo ?? null : null,
      durationMs: Date.now() - started,
    };
    const actionId = await backend.record(entry).catch(() => null);
    // Sem trilha não há como desfazer depois: o Desfazer só aparece quando o registro existe.
    return { ...result, actionId, undo: actionId ? result.undo : undefined };
  }

  return {
    pessoas_buscar: tool({
      description:
        "Acha pessoas da equipe pelo nome (ou parte dele). Use SEMPRE antes de qualquer ação sobre uma pessoa, para obter o id. " +
        "Se vier mais de um candidato, chame `escolher` com eles; não escolha sozinho. Ex.: { texto: \"Ana\" }.",
      inputSchema: z.object({
        texto: z.string().min(1).max(80).describe("Nome ou parte do nome, como o diretor disse."),
        incluir_inativos: z.boolean().optional(),
      }),
      execute: async ({ texto, incluir_inativos }): Promise<ToolResult> => {
        const people = await backend.listPeople();
        const match = matchPeople(texto, people, { includeInactive: incluir_inativos });
        if (match.kind === "none") {
          const extra = match.inactive.length ? ` Inativos com esse nome: ${match.inactive.map(personLine).join("; ")}.` : "";
          return fail("nao_encontrado", `Não achei "${texto}" na equipe ativa.${extra}`, "Peça o nome completo ao diretor.");
        }
        const found = match.kind === "one" ? [match.person] : match.people;
        const data = found.map((person) => ({ id: person.id, nome: person.name, papel: ROLE_LABEL[person.role], unidade: person.branchName, status: person.status, recebimento: person.availability }));
        return match.kind === "one"
          ? { ok: true, message: `Achei ${personLine(match.person)} (${ROLE_LABEL[match.person.role]}).`, data: { pessoas: data, unico: true } }
          : { ok: true, message: `Há ${found.length} pessoas com esse nome: ${found.map(personLine).join("; ")}. Pergunte qual com \`escolher\`.`, data: { pessoas: data, unico: false } };
      },
    }),

    plantao_agora: tool({
      description: "Plantões em andamento agora, com quem está escalado, presença (confirmada, pendente, faltou) e pausas. Para \"quem está no plantão agora?\".",
      inputSchema: z.object({}),
      execute: async (): Promise<ToolResult> => {
        const duties = await backend.dutyNow();
        if (!duties.length) return { ok: true, message: "Nenhum plantão em andamento agora.", data: { plantoes: [] }, href: "/plantoes" };
        const presenceLabel = { confirmed: "presente", pending: "presença pendente", absent: "faltou", expired: "não confirmou", none: "sem confirmação" } as const;
        const lines = duties.map((duty) => {
          const people = duty.brokers.length
            ? duty.brokers.map((broker) => `${broker.name} (${presenceLabel[broker.presence]}${broker.pausedHere || broker.pausedGlobal ? ", pausado" : ""})`).join(", ")
            : "ninguém escalado";
          const short = duty.brokers.length < duty.minimumBrokers ? ` Abaixo do mínimo de ${duty.minimumBrokers}.` : "";
          return `${duty.scheduleName} (${hhmm(duty.startsAt)}–${hhmm(duty.endsAt)}): ${people}.${short}`;
        });
        return { ok: true, message: lines.join("\n"), data: { plantoes: duties }, href: "/plantoes" };
      },
    }),

    plantao_escala: tool({
      description:
        "Lê a escala (plantões por data, quem está em cada um, vagas livres, ocorrencia_id). Use para \"escala de sábado\", \"quantas cadeiras a Ana tem no mês?\" " +
        "(passe corretor_id), \"onde falta gente?\" (so_faltando_gente) e para achar o plantão certo antes de escalar ou tirar alguém num dia " +
        "(de = ate = o dia; turno e plantao_texto se o diretor disse \"da manhã\", \"PME\"). Datas em AAAA-MM-DD; sem datas, os próximos 7 dias.",
      inputSchema: z.object({
        de: DATE.optional(),
        ate: DATE.optional(),
        corretor_id: PERSON_ID.optional().describe("Id vindo de pessoas_buscar: lista só os plantões dela."),
        so_faltando_gente: z.boolean().optional(),
        turno: z.enum(["manha", "tarde", "noite"]).optional(),
        plantao_texto: z.string().max(60).optional().describe("Parte do nome do plantão ou do tipo, ex.: Manhã, PME."),
      }),
      execute: async ({ de, ate, corretor_id, so_faltando_gente, turno, plantao_texto }): Promise<ToolResult> => {
        const today = spDateKey(backend.now());
        const from = de ?? today;
        const until = ate ?? addDays(from, 6);
        if (until < from) return fail("datas", "A data final vem antes da inicial.", "Troque de/ate.");
        if (Date.parse(until) - Date.parse(from) > 62 * DAY_MS) return fail("periodo_longo", "Período longo demais.", "Peça até 2 meses por vez.");
        const [allSeats, people] = await Promise.all([seatsBetween(from, until), peopleMap()]);
        if (!allSeats.length) return { ok: true, message: `Não há escala mensal para ${dayLabel(from)} a ${dayLabel(until)}.`, href: "/plantoes", data: { ocorrencias: [] } };
        const seats = allSeats.filter((item) => matchesSeat(item, { shift: turno ?? null, text: plantao_texto ?? null }));
        if (!seats.length) return { ok: true, message: `Nenhum plantão${plantao_texto ? ` "${plantao_texto}"` : ""}${turno ? ` de ${turno === "manha" ? "manhã" : turno}` : ""} de ${dayLabel(from)} a ${dayLabel(until)}.`, href: "/plantoes", data: { ocorrencias: [] } };
        if (corretor_id) {
          const mine = seatsOf(seats, corretor_id, backend.now());
          const name = nameOf(people, corretor_id);
          return {
            ok: true,
            message: mine.total
              ? `${name} tem ${mine.total} ${mine.total === 1 ? "cadeira" : "cadeiras"} de ${dayLabel(from)} a ${dayLabel(until)}${mine.next.length ? `. Próximas: ${mine.next.slice(0, 8).map(seatLabel).join("; ")}` : ""}.`
              : `${name} não tem cadeira de ${dayLabel(from)} a ${dayLabel(until)}.`,
            data: { total: mine.total, proximas: mine.next.map((item) => ({ ocorrencia_id: item.id, rotulo: seatLabel(item) })) },
            href: "/plantoes",
          };
        }
        const list = so_faltando_gente ? understaffed(seats) : seats.filter((item) => !item.ended);
        const rows = list.slice(0, 40).map((item) => ({
          ocorrencia_id: item.id,
          rotulo: seatLabel(item),
          escalados: item.brokerIds.map((id) => nameOf(people, id)),
          vagas_livres: item.maximumBrokers === null ? null : Math.max(0, item.maximumBrokers - item.brokerIds.length),
          minimo: item.minimumBrokers,
          rascunho: item.source === "draft",
        }));
        if (!rows.length) return { ok: true, message: so_faltando_gente ? "Nenhum plantão abaixo do mínimo nesse período." : "Nenhum plantão nesse período.", data: { ocorrencias: [] }, href: "/plantoes" };
        const text = rows.slice(0, 15).map((row) => `${row.rotulo}: ${row.escalados.length ? row.escalados.join(", ") : "ninguém"}${row.escalados.length < row.minimo ? ` (mínimo ${row.minimo})` : ""}`).join("\n");
        return { ok: true, message: `${text}${rows.length > 15 ? `\n… e mais ${rows.length - 15}.` : ""}`, data: { ocorrencias: rows }, href: "/plantoes" };
      },
    }),

    plantao_cadeiras_livres: tool({
      description:
        "Para \"dê N cadeiras para X\": acha as próximas N vagas livres nos plantões em que a pessoa ainda não está (uma por plantão, sem choque de horário). " +
        "Não grava nada: mostre a lista e, em seguida, chame plantao_escalar_em_vagas com exatamente esses ocorrencia_id. Filtros só se o diretor pediu.",
      inputSchema: z.object({
        corretor_id: PERSON_ID.describe("Id vindo de pessoas_buscar."),
        quantidade: z.number().int().min(1).max(20),
        dias_semana: z.array(z.number().int().min(0).max(6)).max(7).optional().describe("0=domingo … 6=sábado"),
        turno: z.enum(["manha", "tarde", "noite"]).optional(),
        modalidade: z.enum(["online", "presencial"]).optional(),
        plantao_texto: z.string().max(60).optional().describe("Parte do nome do plantão ou do tipo, ex.: PME."),
        de: DATE.optional(),
        ate: DATE.optional(),
        incluir_fora_do_tipo: z.boolean().optional().describe("Só se o diretor aceitar plantão de tipo fora da unidade da pessoa."),
        varias_no_mesmo_dia: z.boolean().optional().describe("Só se o diretor pedir mais de uma cadeira no mesmo dia. Padrão: uma por dia."),
      }),
      execute: async (input): Promise<ToolResult> => {
        const today = spDateKey(backend.now());
        const from = input.de && input.de > today ? input.de : today;
        const until = input.ate ?? addDays(from, 45);
        const [people, seats] = await Promise.all([peopleMap(), seatsBetween(from, until)]);
        const person = people.get(input.corretor_id);
        if (!person) return fail("pessoa", "Não achei essa pessoa na equipe.", "Use o id devolvido por pessoas_buscar.");
        if (person.role !== "broker") return fail("papel", `${person.name} não é corretor.`, "Só corretor ocupa cadeira de plantão.");
        if (person.status !== "active") return fail("inativo", `${person.name} está inativo.`, "Ative a pessoa antes de escalar.");
        if (!seats.length) return fail("sem_escala", `Não há escala mensal de ${dayLabel(from)} a ${dayLabel(until)}.`, "Gere e publique a escala do mês em Plantões.");
        const pick = pickSeats(seats, person.id, input.quantidade, {
          weekdays: input.dias_semana,
          shift: input.turno ?? null,
          attendanceMode: input.modalidade ?? null,
          scheduleText: input.plantao_texto ?? null,
          from,
          until,
          includeOutsideType: input.incluir_fora_do_tipo,
          maxPerDay: input.varias_no_mesmo_dia ? 3 : 1,
        });
        const vagas = pick.picked.map((choice) => ({
          ocorrencia_id: choice.occurrence.id,
          rotulo: seatLabel(choice.occurrence),
          fora_do_tipo: choice.outsideType,
          rascunho: choice.occurrence.source === "draft",
        }));
        if (!vagas.length) {
          const hint = pick.outsideTypeAvailable ? ` Há ${pick.outsideTypeAvailable} vagas em plantões de tipo fora da unidade dela; posso usar se você quiser.` : "";
          return fail("sem_vagas", `Não achei vaga livre para ${person.name} nesse período.${hint}`, "Pergunte se pode ampliar o período, mudar o filtro ou usar plantões fora do tipo.");
        }
        const short = vagas.length < input.quantidade ? ` Só achei ${vagas.length} de ${input.quantidade}.` : "";
        const draft = vagas.some((vaga) => vaga.rascunho) ? " Algumas estão só no rascunho do mês (falta publicar)." : "";
        return {
          ok: true,
          message: `Vagas para ${person.name}:${short}${draft}\n${vagas.map((vaga) => `• ${vaga.rotulo}${vaga.fora_do_tipo ? " (fora do tipo)" : ""}`).join("\n")}`,
          data: { corretor: { id: person.id, nome: person.name }, vagas },
        };
      },
    }),

    plantao_escalar_em_vagas: tool({
      description:
        "Escala a pessoa nos plantões indicados (uma cadeira em cada). Use os ocorrencia_id de plantao_cadeiras_livres ou plantao_escala. " +
        "A pessoa recebe aviso no app. Mais de uma vaga pede confirmação do diretor (o sistema mostra o cartão; não pergunte de novo em texto).",
      inputSchema: z.object({
        corretor_id: PERSON_ID,
        ocorrencia_ids: z.array(OCCURRENCE_ID).min(1).max(20),
        fora_do_tipo: z.boolean().optional().describe("true só se o diretor aceitou plantão fora do tipo da unidade."),
      }),
      execute: async (input, { toolCallId }): Promise<ToolResult> => write("plantao_escalar_em_vagas", toolCallId, input, async () => {
        const ids = [...new Set(input.ocorrencia_ids)];
        const dates = ids.map((id) => id.slice(-10)).sort();
        const [people, seats] = await Promise.all([peopleMap(), seatsBetween(dates[0]!, dates.at(-1)!)]);
        const person = people.get(input.corretor_id);
        if (!person || person.role !== "broker" || person.status !== "active") return fail("pessoa", "Essa pessoa não pode ser escalada (não é corretor ativo).", "Confira com pessoas_buscar.");
        const byId = new Map(seats.map((seat) => [seat.id, seat]));
        const done: SeatOccurrence[] = [];
        const problems: string[] = [];
        for (const id of ids) {
          const seat = byId.get(id);
          if (!seat) { problems.push(`${dayLabel(id.slice(-10))}: plantão não está na escala`); continue; }
          if (seat.brokerIds.includes(person.id)) { problems.push(`${seatLabel(seat)}: já estava`); continue; }
          if (!hasFreeSeat(seat)) { problems.push(`${seatLabel(seat)}: lotado`); continue; }
          try {
            await backend.addSeat(seat, person.id, Boolean(input.fora_do_tipo));
            done.push(seat);
          } catch (error) {
            problems.push(`${seatLabel(seat)}: ${error instanceof Error ? error.message : "não foi possível"}`);
          }
        }
        if (!done.length) return fail("nada_feito", `Não escalei ${person.name}. ${problems.join("; ")}.`, "Nada foi alterado. Procure outras vagas com plantao_cadeiras_livres.");
        const plural = done.length === 1 ? "cadeira" : "cadeiras";
        return {
          ok: true,
          message: `${person.name} ganhou ${done.length} ${plural}:\n${done.map((seat) => `• ${seatLabel(seat)}`).join("\n")}${problems.length ? `\nNão deu: ${problems.join("; ")}.` : ""}`,
          warning: problems.length ? problems.join("; ") : undefined,
          data: { corretor: { id: person.id, nome: person.name }, escalado: done.map((seat) => ({ ocorrencia_id: seat.id, rotulo: seatLabel(seat) })) },
          href: "/plantoes",
          undo: { tool: "plantao_tirar_de_vagas", input: { corretor_id: person.id, ocorrencia_ids: done.map((seat) => seat.id) }, label: "Desfazer" },
        };
      }),
    }),

    plantao_tirar_de_vagas: tool({
      description:
        "Tira a pessoa dos plantões indicados (ocorrencia_id de plantao_escala). Não tira de plantão que já começou. A pessoa recebe aviso no app.",
      inputSchema: z.object({
        corretor_id: PERSON_ID,
        ocorrencia_ids: z.array(OCCURRENCE_ID).min(1).max(40),
      }),
      execute: async (input, { toolCallId }): Promise<ToolResult> => write("plantao_tirar_de_vagas", toolCallId, input, async () => {
        const ids = [...new Set(input.ocorrencia_ids)];
        const dates = ids.map((id) => id.slice(-10)).sort();
        const [people, seats] = await Promise.all([peopleMap(), seatsBetween(dates[0]!, dates.at(-1)!)]);
        const name = nameOf(people, input.corretor_id);
        const byId = new Map(seats.map((seat) => [seat.id, seat]));
        const done: SeatOccurrence[] = [];
        const problems: string[] = [];
        for (const id of ids) {
          const seat = byId.get(id);
          if (!seat || !seat.brokerIds.includes(input.corretor_id)) { problems.push(`${seat ? seatLabel(seat) : dayLabel(id.slice(-10))}: não estava`); continue; }
          if (seat.started) { problems.push(`${seatLabel(seat)}: já começou (para ela parar de receber agora, pause no plantão pela tela Plantões)`); continue; }
          try {
            await backend.removeSeat(seat, input.corretor_id);
            done.push(seat);
          } catch (error) {
            problems.push(`${seatLabel(seat)}: ${error instanceof Error ? error.message : "não foi possível"}`);
          }
        }
        if (!done.length) return fail("nada_feito", `Não tirei ${name}. ${problems.join("; ")}.`, "Nada foi alterado.");
        return {
          ok: true,
          message: `${name} saiu de ${done.length} ${done.length === 1 ? "plantão" : "plantões"}:\n${done.map((seat) => `• ${seatLabel(seat)}`).join("\n")}${problems.length ? `\nNão deu: ${problems.join("; ")}.` : ""}`,
          warning: problems.length ? problems.join("; ") : undefined,
          data: { corretor: { id: input.corretor_id, nome: name }, removido: done.map((seat) => ({ ocorrencia_id: seat.id, rotulo: seatLabel(seat) })) },
          href: "/plantoes",
          undo: { tool: "plantao_escalar_em_vagas", input: { corretor_id: input.corretor_id, ocorrencia_ids: done.map((seat) => seat.id), fora_do_tipo: true }, label: "Desfazer" },
        };
      }),
    }),

    // Ferramenta do cliente (sem execute): a gaveta mostra as opções e devolve a escolhida (elicitation do MCP).
    escolher: tool({
      description: "Pergunta ao diretor qual opção ele quer quando há ambiguidade (ex.: duas Anas). Mostra botões; a resposta volta como { id, rotulo }.",
      inputSchema: z.object({
        pergunta: z.string().min(3).max(140),
        opcoes: z.array(z.object({ id: z.string().min(1).max(160), rotulo: z.string().min(1).max(120), detalhe: z.string().max(120).optional() })).min(2).max(8),
      }),
      outputSchema: z.object({ id: z.string(), rotulo: z.string() }),
    }),
  };
}

export type AgentTools = ReturnType<typeof buildAgentTools>;
