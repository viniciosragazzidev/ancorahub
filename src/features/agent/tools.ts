import { tool } from "ai";
import { z } from "zod";

import type { AgentBackend, AgentActionRecord, DutyNow } from "./backend";
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

const WEEKDAY_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function dutyDayLabel(dateKey: string) {
  return `${WEEKDAY_SHORT[new Date(`${dateKey}T12:00:00Z`).getUTCDay()]} ${dateKey.slice(8, 10)}/${dateKey.slice(5, 7)}`;
}

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "2026-12" → "dezembro de 2026" */
export function monthLabel(monthKey: string) {
  return `${MONTHS[Number(monthKey.slice(5, 7)) - 1] ?? monthKey} de ${monthKey.slice(0, 4)}`;
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

  function dutyLabel(duty: DutyNow) {
    const day = duty.running === false ? `${dutyDayLabel(duty.dutyDate)}, ` : "";
    return `${duty.scheduleName} (${day}${hhmm(duty.startsAt)}–${hhmm(duty.endsAt)})`;
  }

  /** O plantão de agora (ou o próximo, até 24 h) em que a pessoa está escalada. Vários sem plantao_id: pede escolha. */
  async function dutyFor(corretorId: string, plantaoId?: string) {
    const [duties, people] = await Promise.all([backend.dutySoon(), peopleMap()]);
    const name = people.get(corretorId)?.name ?? "Essa pessoa";
    const mine = duties
      .flatMap((duty) => duty.brokers.filter((broker) => broker.id === corretorId).map((broker) => ({ duty, broker })))
      .filter((item) => !plantaoId || item.duty.scheduleId === plantaoId)
      // O que está rodando vem antes do próximo.
      .sort((a, b) => Number(b.duty.running !== false) - Number(a.duty.running !== false));
    if (!mine.length) {
      return { ok: false as const, result: fail("fora_do_plantao", `${name} não está escalada em plantão agora nem nas próximas 24 h.`, "Confira a escala com plantao_escala.") };
    }
    const running = mine.filter((item) => item.duty.running !== false);
    const candidates = running.length ? running : mine;
    if (candidates.length > 1 && !plantaoId) {
      return {
        ok: false as const,
        result: fail("varios_plantoes", `${name} tem ${candidates.length} plantões: ${candidates.map((item) => dutyLabel(item.duty)).join("; ")}.`, "Pergunte qual com escolher (id = scheduleId) e chame de novo com plantao_id."),
      };
    }
    return { ok: true as const, duty: candidates[0]!.duty, broker: candidates[0]!.broker, name };
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

    plantao_passar_cadeira: tool({
      description:
        "A6: passa a cadeira de uma pessoa para outra no mesmo plantão (\"passa a cadeira da Ana de sexta para a Carla\"). " +
        "Use a ocorrencia_id de plantao_escala com o corretor_id de quem sai. As duas pessoas recebem aviso no app.",
      inputSchema: z.object({
        de_corretor_id: PERSON_ID.describe("Quem sai."),
        para_corretor_id: PERSON_ID.describe("Quem entra."),
        ocorrencia_id: OCCURRENCE_ID,
        fora_do_tipo: z.boolean().optional().describe("true só se o diretor aceitou plantão fora do tipo da unidade de quem entra."),
      }),
      execute: async (input, { toolCallId }): Promise<ToolResult> => write("plantao_passar_cadeira", toolCallId, input, async () => {
        const [people, seats] = await Promise.all([peopleMap(), seatsBetween(input.ocorrencia_id.slice(-10), input.ocorrencia_id.slice(-10))]);
        const from = people.get(input.de_corretor_id);
        const to = people.get(input.para_corretor_id);
        const seat = seats.find((item) => item.id === input.ocorrencia_id);
        if (!from || !to) return fail("pessoa", "Não achei uma das pessoas.", "Confira com pessoas_buscar.");
        if (to.role !== "broker" || to.status !== "active") return fail("pessoa", `${to.name} não é corretor ativo.`, "Escolha outra pessoa.");
        if (!seat || !seat.brokerIds.includes(from.id)) return fail("nao_estava", `${from.name} não está nesse plantão.`, "Confira com plantao_escala (corretor_id de quem sai).");
        if (seat.brokerIds.includes(to.id)) return fail("ja_estava", `${to.name} já está em ${seatLabel(seat)}.`, "Nada a passar.");
        if (seat.started) return fail("comecou", `${seatLabel(seat)} já começou: a cadeira não muda pela escala.`, "Pause quem sai no plantão.");
        if (!seat.allowedBrokerIds.includes(to.id) && !input.fora_do_tipo) {
          return fail("fora_do_tipo", `A unidade de ${to.name} não participa do tipo de ${seat.scheduleName}.`, "Pergunte ao diretor se pode escalar mesmo assim (fora_do_tipo: true).");
        }
        await backend.removeSeat(seat, from.id);
        try {
          await backend.addSeat(seat, to.id, Boolean(input.fora_do_tipo));
        } catch (error) {
          // Não deixa a cadeira vazia: quem saía volta.
          await backend.addSeat(seat, from.id, true).catch(() => null);
          throw error;
        }
        return {
          ok: true,
          message: `${seatLabel(seat)}: saiu ${from.name}, entrou ${to.name}.`,
          href: "/plantoes",
          data: { escalado: [{ ocorrencia_id: seat.id, rotulo: seatLabel(seat) }] },
          undo: { tool: "plantao_passar_cadeira", input: { de_corretor_id: to.id, para_corretor_id: from.id, ocorrencia_id: seat.id, fora_do_tipo: true }, label: "Desfazer" },
        };
      }),
    }),

    plantao_trocar_corretores: tool({
      description:
        "A5: troca duas pessoas de plantão (\"troca a Ana de sexta com o Bruno de sábado\"): quem estava em A vai para B e vice-versa. " +
        "Use as ocorrencia_id de plantao_escala (com o corretor_id de cada um). As duas recebem aviso no app.",
      inputSchema: z.object({
        corretor_a_id: PERSON_ID,
        ocorrencia_a_id: OCCURRENCE_ID.describe("Plantão onde a pessoa A está hoje."),
        corretor_b_id: PERSON_ID,
        ocorrencia_b_id: OCCURRENCE_ID.describe("Plantão onde a pessoa B está hoje."),
        fora_do_tipo: z.boolean().optional(),
      }),
      execute: async (input, { toolCallId }): Promise<ToolResult> => write("plantao_trocar_corretores", toolCallId, input, async () => {
        const dates = [input.ocorrencia_a_id.slice(-10), input.ocorrencia_b_id.slice(-10)].sort();
        const [people, seats] = await Promise.all([peopleMap(), seatsBetween(dates[0]!, dates[1]!)]);
        const a = people.get(input.corretor_a_id);
        const b = people.get(input.corretor_b_id);
        const seatA = seats.find((item) => item.id === input.ocorrencia_a_id);
        const seatB = seats.find((item) => item.id === input.ocorrencia_b_id);
        if (!a || !b) return fail("pessoa", "Não achei uma das pessoas.", "Confira com pessoas_buscar.");
        if (!seatA || !seatA.brokerIds.includes(a.id)) return fail("nao_estava", `${a.name} não está no plantão indicado.`, "Confira com plantao_escala.");
        if (!seatB || !seatB.brokerIds.includes(b.id)) return fail("nao_estava", `${b.name} não está no plantão indicado.`, "Confira com plantao_escala.");
        if (seatA.id === seatB.id) return fail("mesmo_plantao", "Os dois já estão no mesmo plantão.", "Nada a trocar.");
        if (seatB.brokerIds.includes(a.id)) return fail("ja_estava", `${a.name} já está em ${seatLabel(seatB)}.`, "Use plantao_passar_cadeira ou plantao_tirar_de_vagas.");
        if (seatA.brokerIds.includes(b.id)) return fail("ja_estava", `${b.name} já está em ${seatLabel(seatA)}.`, "Use plantao_passar_cadeira ou plantao_tirar_de_vagas.");
        if (seatA.started || seatB.started) return fail("comecou", "Um dos plantões já começou: a troca não muda pela escala.", "Pause no plantão quem não vai ficar.");
        const outside = (!seatB.allowedBrokerIds.includes(a.id) || !seatA.allowedBrokerIds.includes(b.id));
        if (outside && !input.fora_do_tipo) return fail("fora_do_tipo", "Um dos dois ficaria num plantão de tipo fora da unidade dele.", "Pergunte ao diretor se pode trocar mesmo assim (fora_do_tipo: true).");
        const force = Boolean(input.fora_do_tipo);
        // Ordem segura: tira os dois, põe cada um no lugar do outro; se algo falhar, volta tudo como estava.
        const undoSteps: Array<() => Promise<unknown>> = [];
        try {
          await backend.removeSeat(seatA, a.id); undoSteps.push(() => backend.addSeat(seatA, a.id, true));
          await backend.removeSeat(seatB, b.id); undoSteps.push(() => backend.addSeat(seatB, b.id, true));
          await backend.addSeat(seatB, a.id, force); undoSteps.push(() => backend.removeSeat(seatB, a.id));
          await backend.addSeat(seatA, b.id, force);
        } catch (error) {
          for (const step of undoSteps.reverse()) await step().catch(() => null);
          throw error;
        }
        return {
          ok: true,
          message: `Trocado: ${a.name} foi para ${seatLabel(seatB)}; ${b.name} foi para ${seatLabel(seatA)}.`,
          href: "/plantoes",
          data: { escalado: [{ ocorrencia_id: seatA.id, rotulo: seatLabel(seatA) }, { ocorrencia_id: seatB.id, rotulo: seatLabel(seatB) }] },
          undo: { tool: "plantao_trocar_corretores", input: { corretor_a_id: a.id, ocorrencia_a_id: seatB.id, corretor_b_id: b.id, ocorrencia_b_id: seatA.id, fora_do_tipo: true }, label: "Desfazer" },
        };
      }),
    }),

    plantao_pausar: tool({
      description:
        "A9: pausa ou retoma a pessoa SÓ no plantão em andamento (continua escalada, para de receber lead dali). " +
        "Ex.: \"pausa a Ana no plantão agora\", \"volta a Ana no plantão\". Para parar de receber em geral, use corretor_pausar.",
      inputSchema: z.object({
        corretor_id: PERSON_ID,
        pausado: z.boolean().describe("true pausa; false retoma."),
        plantao_id: z.string().max(120).optional().describe("Só se ela estiver em mais de um plantão agora (scheduleId de plantao_agora)."),
      }),
      execute: async (input, { toolCallId }): Promise<ToolResult> => write("plantao_pausar", toolCallId, input, async () => {
        const duties = await backend.dutyNow();
        const mine = duties.flatMap((duty) => duty.brokers.filter((broker) => broker.id === input.corretor_id).map((broker) => ({ duty, broker })))
          .filter((item) => !input.plantao_id || item.duty.scheduleId === input.plantao_id);
        const name = (await peopleMap()).get(input.corretor_id)?.name ?? "Essa pessoa";
        if (!mine.length) return fail("fora_do_plantao", `${name} não está em nenhum plantão em andamento agora.`, "Para parar de receber em geral, use corretor_pausar.");
        if (mine.length > 1 && !input.plantao_id) {
          return fail("varios_plantoes", `${name} está em ${mine.length} plantões agora: ${mine.map((item) => item.duty.scheduleName).join(", ")}.`, "Pergunte qual com escolher (id = scheduleId) e chame de novo com plantao_id.");
        }
        const target = mine[0]!;
        if (target.broker.pausedHere === input.pausado) {
          return { ok: true, message: `${name} já estava ${input.pausado ? "pausada" : "recebendo"} no ${target.duty.scheduleName}. Nada mudou.` };
        }
        await backend.pauseOnDuty(target.duty.scheduleId, target.broker.assignmentId, input.pausado);
        return {
          ok: true,
          message: input.pausado
            ? `${name} pausada no ${target.duty.scheduleName} (${hhmm(target.duty.startsAt)}–${hhmm(target.duty.endsAt)}). Continua escalada, sem receber lead dali.`
            : `${name} voltou a receber no ${target.duty.scheduleName}.`,
          href: "/plantoes",
          undo: { tool: "plantao_pausar", input: { corretor_id: input.corretor_id, pausado: !input.pausado, plantao_id: target.duty.scheduleId }, label: "Desfazer" },
        };
      }),
    }),

    plantao_marcar_falta: tool({
      description:
        "A7: marca ou desfaz falta da pessoa no plantão de agora ou no próximo das próximas 24 h (\"a Ana faltou hoje\", \"tira a falta da Ana\"). " +
        "Com falta ela não recebe lead desse plantão. A pessoa recebe aviso no app.",
      inputSchema: z.object({
        corretor_id: PERSON_ID,
        falta: z.boolean().describe("true marca a falta; false desfaz."),
        plantao_id: z.string().max(120).optional().describe("Só se ela tiver mais de um plantão nas próximas horas."),
      }),
      execute: async (input, { toolCallId }): Promise<ToolResult> => write("plantao_marcar_falta", toolCallId, input, async () => {
        const found = await dutyFor(input.corretor_id, input.plantao_id);
        if (!found.ok) return found.result;
        const { duty, broker, name } = found;
        if (input.falta && broker.presence === "absent") return { ok: true, message: `${name} já estava com falta em ${dutyLabel(duty)}. Nada mudou.` };
        if (!input.falta && broker.presence !== "absent") return { ok: true, message: `${name} não tem falta em ${dutyLabel(duty)}. Nada mudou.` };
        await backend.markAbsence(duty.scheduleId, broker.assignmentId, input.falta);
        return {
          ok: true,
          message: input.falta
            ? `Falta marcada: ${name}, ${dutyLabel(duty)}. Ela não recebe lead desse plantão.`
            : `Falta desfeita: ${name}, ${dutyLabel(duty)}. Ela precisa confirmar a presença para voltar a receber.`,
          href: "/plantoes",
          undo: { tool: "plantao_marcar_falta", input: { corretor_id: input.corretor_id, falta: !input.falta, plantao_id: duty.scheduleId }, label: "Desfazer" },
        };
      }),
    }),

    plantao_liberar_presenca: tool({
      description:
        "A8: libera a presença da pessoa no plantão de agora ou no próximo, sem o clique dela (\"libera a presença do Bruno, ele está aqui\"). " +
        "Plantão presencial sem foto pede o motivo (nota). Não tem Desfazer.",
      inputSchema: z.object({
        corretor_id: PERSON_ID,
        nota: z.string().max(300).optional().describe("Motivo, obrigatório em plantão presencial sem foto. Use as palavras do diretor."),
        plantao_id: z.string().max(120).optional(),
      }),
      execute: async (input, { toolCallId }): Promise<ToolResult> => write("plantao_liberar_presenca", toolCallId, input, async () => {
        const found = await dutyFor(input.corretor_id, input.plantao_id);
        if (!found.ok) return found.result;
        const { duty, broker, name } = found;
        if (broker.presence === "confirmed") return { ok: true, message: `${name} já está com presença confirmada em ${dutyLabel(duty)}. Nada mudou.` };
        const result = await backend.releasePresence(duty.scheduleId, broker.assignmentId, input.nota?.trim() || null);
        if (!result.ok) {
          return result.needsNote
            ? fail("precisa_motivo", `${dutyLabel(duty)} é presencial e ${name} não mandou a foto: preciso do motivo para liberar.`, "Pergunte o motivo ao diretor e chame de novo com nota.")
            : fail("erro", result.reason, "Nada foi alterado.");
        }
        return { ok: true, message: `Presença liberada: ${name}, ${dutyLabel(duty)}. Ela já pode receber leads desse plantão.`, href: "/plantoes" };
      }),
    }),

    plantao_rodizio: tool({
      description: "Lê o rodízio dos plantões em andamento: de quem é a vez, a ordem e quem está fora (pausa, falta). Para \"de quem é a vez?\" e antes de mudar a ordem.",
      inputSchema: z.object({}),
      execute: async (): Promise<ToolResult> => {
        const orders = await backend.queueOrders();
        if (!orders.length) return { ok: true, message: "Nenhum plantão em andamento agora.", data: { rodizios: [] } };
        const lines = orders.map((item) => {
          const order = item.order.map((broker) => `${broker.position}. ${broker.name}${broker.isNext ? " (é a vez)" : ""}`).join(", ") || "ninguém na vez";
          const blocked = item.blocked.length ? ` Fora: ${item.blocked.map((broker) => `${broker.name} (${broker.reason})`).join(", ")}.` : "";
          return `${item.scheduleName}${item.manual ? " (ordem manual)" : ""}: ${order}.${blocked}`;
        });
        return { ok: true, message: lines.join("\n"), data: { rodizios: orders }, href: "/plantoes" };
      },
    }),

    plantao_rodizio_ordenar: tool({
      description:
        "A11: muda a ordem do rodízio do plantão em andamento. \"Põe a Carla primeiro\": primeiros = [Carla]. \"Primeiro a Ana, depois o Bruno\": primeiros = [Ana, Bruno]. " +
        "Os outros seguem na ordem de hoje. \"Volta o rodízio pro automático\": voltar_automatico = true.",
      inputSchema: z.object({
        primeiros: z.array(PERSON_ID).max(20).optional().describe("Ids (de pessoas_buscar) na ordem que o diretor disse."),
        voltar_automatico: z.boolean().optional(),
        plantao_id: z.string().max(120).optional().describe("Só se houver mais de um plantão em andamento (scheduleId de plantao_rodizio)."),
        ordem_completa: z.array(PERSON_ID).max(200).optional().describe("Uso interno do Desfazer: a ordem inteira."),
      }),
      execute: async (input, { toolCallId }): Promise<ToolResult> => write("plantao_rodizio_ordenar", toolCallId, input, async () => {
        const orders = await backend.queueOrders();
        const wanted = input.primeiros ?? input.ordem_completa ?? [];
        const candidates = orders.filter((item) => (input.plantao_id ? item.scheduleId === input.plantao_id : wanted.length ? wanted.every((id) => item.order.some((broker) => broker.id === id)) : true));
        if (!candidates.length) {
          return fail("fora_do_rodizio", orders.length ? "Essa pessoa não está na vez de nenhum plantão agora (fora da escala, pausada ou com falta)." : "Nenhum plantão em andamento agora.", "Confira com plantao_rodizio.");
        }
        if (candidates.length > 1) return fail("varios_plantoes", `Há ${candidates.length} plantões em andamento: ${candidates.map((item) => item.scheduleName).join(", ")}.`, "Pergunte qual com escolher (id = scheduleId) e chame de novo com plantao_id.");
        const target = candidates[0]!;
        const current = target.order.map((broker) => broker.id);
        const previous = target.manual ? { ordem_completa: current, plantao_id: target.scheduleId } : { voltar_automatico: true, plantao_id: target.scheduleId };
        const name = (id: string) => target.order.find((broker) => broker.id === id)?.name ?? "Corretor";
        if (input.voltar_automatico) {
          if (!target.manual) return { ok: true, message: `${target.scheduleName} já está no rodízio automático. Nada mudou.` };
          await backend.resetQueueOrder(target.scheduleId, target.dutyDate);
          return { ok: true, message: `${target.scheduleName} voltou ao rodízio automático.`, href: "/plantoes", undo: { tool: "plantao_rodizio_ordenar", input: previous, label: "Desfazer" } };
        }
        if (!wanted.length) return fail("sem_ordem", "Não entendi quem vai na frente.", "Passe primeiros com os ids.");
        const next = [...wanted.filter((id) => current.includes(id)), ...current.filter((id) => !wanted.includes(id))];
        await backend.setQueueOrder(target.scheduleId, target.dutyDate, next);
        return {
          ok: true,
          message: `Rodízio de ${target.scheduleName}: ${next.slice(0, 6).map((id, index) => `${index + 1}. ${name(id)}`).join(", ")}${next.length > 6 ? "…" : ""}.`,
          href: "/plantoes",
          undo: { tool: "plantao_rodizio_ordenar", input: previous, label: "Desfazer" },
        };
      }),
    }),

    plantao_modo_online: tool({
      description: "A12: marca a pessoa como online num plantão presencial (confirma com um toque, sem foto) ou volta a seguir o plantão. \"A Ana vai fazer online hoje\".",
      inputSchema: z.object({
        corretor_id: PERSON_ID,
        online: z.boolean().describe("true: online; false: volta a seguir o modo do plantão."),
        plantao_id: z.string().max(120).optional(),
      }),
      execute: async (input, { toolCallId }): Promise<ToolResult> => write("plantao_modo_online", toolCallId, input, async () => {
        const found = await dutyFor(input.corretor_id, input.plantao_id);
        if (!found.ok) return found.result;
        const { duty, broker, name } = found;
        await backend.setOnlineMode(duty.scheduleId, broker.assignmentId, input.online);
        return {
          ok: true,
          message: input.online
            ? `${name} vai fazer ${dutyLabel(duty)} online: confirma a presença com um toque, sem foto.`
            : `${name} volta a seguir o modo do ${dutyLabel(duty)}.`,
          href: "/plantoes",
          undo: { tool: "plantao_modo_online", input: { corretor_id: input.corretor_id, online: !input.online, plantao_id: duty.scheduleId }, label: "Desfazer" },
        };
      }),
    }),

    plantao_reenviar_convite: tool({
      description: "A13: reenvia por WhatsApp o convite de confirmação de presença do plantão de agora ou do próximo (\"manda de novo o aviso de presença pra Ana\").",
      inputSchema: z.object({
        corretor_id: PERSON_ID,
        plantao_id: z.string().max(120).optional(),
      }),
      execute: async (input, { toolCallId }): Promise<ToolResult> => write("plantao_reenviar_convite", toolCallId, input, async () => {
        const found = await dutyFor(input.corretor_id, input.plantao_id);
        if (!found.ok) return found.result;
        const { duty, broker, name } = found;
        if (broker.presence === "confirmed") return { ok: true, message: `${name} já confirmou a presença em ${dutyLabel(duty)}. Não reenviei.` };
        const sent = await backend.sendPresenceInvite(duty.scheduleId, broker.assignmentId);
        return {
          ok: true,
          message: sent.delivered
            ? `Convite de presença reenviado para ${name} (${dutyLabel(duty)}).`
            : `Convite de presença de ${name} (${dutyLabel(duty)}) entrou na fila de envio do WhatsApp.`,
          href: "/plantoes",
        };
      }),
    }),

    escala_mensal_situacao: tool({
      description:
        "Situação da escala de um mês: rascunho ou publicada, quantos plantões e escalados, plantões abaixo do mínimo, problemas que impedem publicar. " +
        "Use antes de publicar (dá o plano_id) e para \"como está a escala de dezembro?\". mes em AAAA-MM.",
      inputSchema: z.object({ mes: z.string().regex(/^\d{4}-\d{2}$/, "Use AAAA-MM.") }),
      execute: async ({ mes }): Promise<ToolResult> => {
        const plan = await backend.monthPlan(mes);
        const label = monthLabel(mes);
        if (!plan) return { ok: true, message: `Não há escala de ${label}. Gere pela tela Plantões.`, href: "/plantoes", data: { plano: null } };
        const state = plan.status === "published" ? "publicada" : "em rascunho (falta publicar)";
        const extra = [
          plan.belowMinimum ? `${plan.belowMinimum} plantões abaixo do mínimo` : null,
          plan.problems.length ? `Impede publicar: ${plan.problems.join("; ")}` : null,
          plan.replacesPublished ? "publicar substitui a escala já publicada nas datas que não terminaram" : null,
        ].filter(Boolean).join(". ");
        return {
          ok: true,
          message: `Escala de ${label}: ${state}. ${plan.occurrences} plantões, ${plan.assigned} cadeiras ocupadas, ${plan.people} pessoas.${extra ? ` ${extra}.` : ""}`,
          href: "/plantoes",
          data: { plano: plan, rotulos: [{ id: plan.id, rotulo: `escala de ${label}` }] },
        };
      },
    }),

    escala_mensal_publicar: tool({
      description:
        "A16: publica o rascunho da escala do mês (grava a escala, avisa todos os escalados, tira quem saiu). Não tem Desfazer. " +
        "Use o plano_id de escala_mensal_situacao. O sistema mostra o cartão de confirmação.",
      inputSchema: z.object({ plano_id: z.string().min(1).max(80), mes: z.string().regex(/^\d{4}-\d{2}$/) }),
      execute: async (input, { toolCallId }): Promise<ToolResult> => write("escala_mensal_publicar", toolCallId, input, async () => {
        const plan = await backend.monthPlan(input.mes);
        const label = monthLabel(input.mes);
        if (!plan || plan.id !== input.plano_id) return fail("plano", `A escala de ${label} mudou desde a consulta.`, "Chame escala_mensal_situacao de novo.");
        if (plan.status === "published") return { ok: true, message: `A escala de ${label} já está publicada. Nada mudou.` };
        if (plan.problems.length) return fail("problemas", `A escala de ${label} ainda tem problemas: ${plan.problems.join("; ")}.`, "Corrija na tela Plantões antes de publicar.");
        await backend.publishPlan(plan.id);
        return {
          ok: true,
          message: `Escala de ${label} publicada: ${plan.occurrences} plantões, ${plan.people} pessoas avisadas.`,
          href: "/plantoes",
        };
      }),
    }),

    escala_tirar_dia: tool({
      description:
        "A15: tira um dia inteiro da escala (feriado): os plantões do dia que não começaram saem e os escalados recebem aviso. " +
        "voltar = true devolve o dia, mas só na próxima vez que a escala for gerada (as pessoas não voltam sozinhas). Data em AAAA-MM-DD.",
      inputSchema: z.object({ data: DATE, voltar: z.boolean().optional() }),
      execute: async (input, { toolCallId }): Promise<ToolResult> => write("escala_tirar_dia", toolCallId, input, async () => {
        const seats = input.voltar ? [] : await seatsBetween(input.data, input.data);
        const people = new Set(seats.filter((seat) => !seat.started).flatMap((seat) => seat.brokerIds));
        const message = await backend.excludeDay(input.data.slice(0, 7), input.data, Boolean(input.voltar));
        return {
          ok: true,
          message: input.voltar ? message : `${message}${people.size ? ` ${people.size} pessoas avisadas.` : ""}`,
          href: "/plantoes",
        };
      }),
    }),

    corretor_pausar: tool({
      description:
        "A10: pausa ou retoma o recebimento GERAL de leads de um ou mais corretores (vale para todos os plantões e filas). " +
        "Ex.: \"pausa o Bruno\", \"ativa o Bruno e a Carla\". Mais de um corretor pede confirmação (o sistema mostra o cartão).",
      inputSchema: z.object({
        corretor_ids: z.array(PERSON_ID).min(1).max(30),
        pausado: z.boolean().describe("true pausa; false volta a receber."),
      }),
      execute: async (input, { toolCallId }): Promise<ToolResult> => write("corretor_pausar", toolCallId, input, async () => {
        const people = await peopleMap();
        const brokers = input.corretor_ids.map((id) => people.get(id)).filter((person): person is Person => Boolean(person && person.role === "broker" && person.status === "active"));
        if (!brokers.length) return fail("pessoa", "Nenhum corretor ativo nessa lista.", "Confira com pessoas_buscar.");
        // Só quem muda de fato entra (e só esses voltam no Desfazer).
        const changing = brokers.filter((person) => (input.pausado ? person.availability === "available" : person.availability !== "available"));
        const names = (list: Person[]) => list.map((person) => person.name).join(", ");
        if (!changing.length) return { ok: true, message: `${names(brokers)} já ${brokers.length === 1 ? "estava" : "estavam"} ${input.pausado ? "pausado(s)" : "recebendo"}. Nada mudou.` };
        await backend.setAvailability(changing.map((person) => person.id), input.pausado ? "paused" : "available");
        return {
          ok: true,
          message: input.pausado
            ? `Pausado o recebimento de leads: ${names(changing)}.`
            : `Voltou a receber leads: ${names(changing)}.`,
          href: "/equipe",
          undo: { tool: "corretor_pausar", input: { corretor_ids: changing.map((person) => person.id), pausado: !input.pausado }, label: "Desfazer" },
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
