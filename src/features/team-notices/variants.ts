/**
 * Text rotation for team notices sent by the company number (anti-ban): the
 * same information in different wording, so the team never receives a run of
 * identical messages. Pure, no I/O. Version 0 of each notice is the original
 * wording, which the rest of the CRM also shows for the Meta template.
 * No invisible characters or random filler: WhatsApp recognizes those tricks.
 */

export type NoticeFields =
  | { purpose: "brokerLeadNotification" | "newLeadAssignment"; broker: string; lead: string; product: string; link: string | null }
  | { purpose: "leadAssignmentConfirmed"; broker: string; lead: string; phone: string; interest: string; leadType: string; dependents: string; city: string; link: string | null }
  | { purpose: "leadAssignmentUnavailable" | "leadAssignmentExpired"; broker: string }
  | { purpose: "leadFeedbackReminder"; broker: string; lead: string }
  | { purpose: "taskReminder"; name: string; task: string; when: string }
  | { purpose: "brokerAccountActivated"; name: string; company: string; loginUrl: string }
  | { purpose: "dutyPresenceConfirmation"; broker: string; hour: string; link: string | null }
  | { purpose: "brokerInvitation"; name: string; company: string; link: string };

/**
 * Where the first-access link goes in an invite sent by the company number.
 * The secret link is only put in at send time, so it is never stored in text.
 */
export const INVITE_LINK_PLACEHOLDER = "{{link_convite}}";

/** The invite text with its secret link (appended when a library message has no place for it). */
export function withInviteLink(text: string, link: string) {
  return text.includes(INVITE_LINK_PLACEHOLDER)
    ? text.split(INVITE_LINK_PLACEHOLDER).join(link)
    : `${text.trim()}\n\n${link}`;
}

/** "Bom dia" / "Boa tarde" / "Boa noite" for a local hour (0–23). */
export function timeOfDayGreeting(hour: number) {
  if (hour >= 5 && hour < 12) return "Bom dia";
  if (hour >= 12 && hour < 18) return "Boa tarde";
  return "Boa noite";
}

/** Local hour in the operation's time zone. */
export function localHour(date: Date, timeZone = "America/Sao_Paulo") {
  const hour = new Intl.DateTimeFormat("en-US", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(date);
  return Number(hour) % 24;
}

const tail = (link: string | null, label: string) => (link ? `\n\n${label}${link}` : "");

/** Every built-in version of a notice; index 0 is the original wording. */
export function builtInNoticeVariants(fields: NoticeFields, hour: number): string[] {
  const hi = timeOfDayGreeting(hour);
  switch (fields.purpose) {
    case "brokerLeadNotification": {
      const { broker, lead, product, link } = fields;
      return [
        `⚡ *Novo Lead Atribuído!*\n\nOlá *${broker}*, um novo lead foi atribuído a você:\n\n👤 *Cliente:* ${lead}\n🏥 *Interesse:* ${product}${tail(link, "👉 *Acesse no CRM:* ")}`,
        `${hi}, *${broker}*! Chegou um lead novo pra você 🙌\n\n*${lead}* · ${product}${tail(link, "Abra no CRM: ")}`,
        `Oi *${broker}*, tudo certo? O lead *${lead}* agora está com você.\n\nInteresse: ${product}${tail(link, "👉 ")}`,
        `📌 *Lead novo na sua carteira*\n\n${broker}, você recebeu *${lead}* (${product}).${tail(link, "Detalhes no CRM: ")}`,
      ];
    }
    case "newLeadAssignment": {
      const { broker, lead, product, link } = fields;
      return [
        `🚨 *Novo Lead Disponível!*\n\nOlá *${broker}*, o lead *${lead}* está disponível para atendimento.\n\n🏥 *Interesse:* ${product}${tail(link, "👉 *Aceitar o lead:* ")}`,
        `${hi}, *${broker}*! Tem um lead disponível pra você: *${lead}* (${product}).${tail(link, "Para aceitar: ")}`,
        `Oi *${broker}*! O lead *${lead}* está esperando atendimento.\n\nInteresse: ${product}${tail(link, "👉 Aceite aqui: ")}`,
        `🔔 *Lead disponível*\n\n${broker}, *${lead}* aguarda um corretor.\nInteresse: ${product}${tail(link, "Aceitar no CRM: ")}`,
      ];
    }
    case "leadAssignmentConfirmed": {
      const { broker, lead, phone, interest, leadType, dependents, city, link } = fields;
      return [
        `✅ *Atribuição Confirmada*\n\nOlá *${broker}*, você assumiu o atendimento de *${lead}*.\n\n📞 *Telefone:* ${phone}\n📋 *Tipo:* ${leadType}\n🏥 *Interesse:* ${interest}\n👥 *Dependentes:* ${dependents}\n📍 *Cidade:* ${city}${tail(link, "👉 *Abrir conversa:* ")}`,
        `${hi}, *${broker}*! O atendimento de *${lead}* é seu.\n\n📞 ${phone}\n📋 ${leadType} · ${interest}\n👥 Dependentes: ${dependents}\n📍 ${city}${tail(link, "Conversa: ")}`,
        `Tudo certo, *${broker}* ✅ Você ficou com *${lead}*.\n\nTelefone: ${phone}\nTipo: ${leadType}\nInteresse: ${interest}\nDependentes: ${dependents}\nCidade: ${city}${tail(link, "👉 ")}`,
        `📋 *Dados do lead ${lead}*\n\n${broker}, seguem as informações:\n• Telefone: ${phone}\n• Interesse: ${interest}\n• Tipo: ${leadType}\n• Dependentes: ${dependents}\n• Cidade: ${city}${tail(link, "Abrir conversa: ")}`,
      ];
    }
    case "leadAssignmentUnavailable": {
      const { broker } = fields;
      return [
        `ℹ️ *Aviso de Atribuição*\n\nOlá *${broker}*, este lead já foi atribuído a outro corretor ou expirou.`,
        `Oi *${broker}*, esse lead já foi para outro corretor ou o prazo acabou.`,
        `${hi}, *${broker}*. Esse lead não está mais disponível: outro corretor assumiu ou o tempo expirou.`,
        `ℹ️ ${broker}, não deu tempo: o lead já foi atribuído a outra pessoa ou expirou.`,
      ];
    }
    case "leadAssignmentExpired": {
      const { broker } = fields;
      return [
        `⏳ *Tempo Expirado*\n\nOlá *${broker}*, o tempo para aceitar o lead expirou e a oportunidade foi repassada.`,
        `Oi *${broker}*, o prazo para aceitar o lead acabou e ele foi repassado.`,
        `${hi}, *${broker}*. A oferta de lead expirou e seguiu para o próximo corretor.`,
        `⏳ ${broker}, o tempo de aceite terminou; o lead foi para outra pessoa.`,
      ];
    }
    case "leadFeedbackReminder": {
      const { broker, lead } = fields;
      return [
        `📝 *Registre o atendimento*\n\nOlá *${broker}*, falta registrar o feedback do atendimento de *${lead}* no CRM.`,
        `Oi *${broker}*! Consegue registrar no CRM como foi o atendimento de *${lead}*?`,
        `${hi}, *${broker}*. Ficou pendente o feedback de *${lead}* no CRM.`,
        `📝 ${broker}, lembrete: o atendimento de *${lead}* ainda está sem feedback no CRM.`,
      ];
    }
    case "taskReminder": {
      const { name, task, when } = fields;
      return [
        `⏰ *Lembrete de Tarefa*\n\nOlá *${name}*, você tem uma tarefa pendente:\n📌 *${task}*\n📅 *Horário:* ${when}`,
        `Oi *${name}*! Lembrete da sua tarefa: *${task}* (${when}).`,
        `${hi}, *${name}*. Você tem uma tarefa marcada: *${task}*\nQuando: ${when}`,
        `⏰ ${name}, não esqueça: *${task}* · ${when}`,
      ];
    }
    case "brokerInvitation": {
      const { name, company, link } = fields;
      return [
        `Olá *${name}*! 👋\n\nVocê recebeu um convite para criar seu acesso no sistema *${company}*.\n\nAcesse o link abaixo para definir sua senha e entrar no sistema:\n${link}\n\n_Este link é individual e seguro._`,
        `${hi}, *${name}*! Seu acesso ao *${company}* está pronto para ser criado.\n\nDefina sua senha por aqui: ${link}\n\n_O link é só seu._`,
        `Oi *${name}*, tudo bem? Você foi convidado(a) para o CRM da *${company}*.\n\nPara criar seu acesso: ${link}`,
        `🔑 *Primeiro acesso*\n\n${name}, crie sua senha do *${company}* pelo link abaixo (individual):\n${link}`,
      ];
    }
    case "brokerAccountActivated": {
      const { name, company, loginUrl } = fields;
      return [
        `Olá *${name}*! 👋\n\nSua conta no *${company}* foi ativada com sucesso.\n\nAcesse o CRM pelo link:\n${loginUrl}`,
        `${hi}, *${name}*! Seu acesso ao *${company}* está ativo.\n\nEntre por aqui: ${loginUrl}`,
        `Oi *${name}*, tudo pronto: sua conta no *${company}* foi ativada ✅\n\n${loginUrl}`,
        `✅ *Conta ativada*\n\n${name}, você já pode entrar no CRM do *${company}*:\n${loginUrl}`,
      ];
    }
    case "dutyPresenceConfirmation": {
      const { broker, hour: start, link } = fields;
      return [
        `📅 *Confirme seu plantão*\n\nOlá *${broker}*, seu plantão começa${start ? ` às *${start}*` : " em breve"}. Confirme que está disponível para receber leads.${tail(link, "👉 *Confirmar presença:* ")}`,
        `${hi}, *${broker}*! Seu plantão começa${start ? ` às ${start}` : " em breve"}. Pode confirmar que está disponível?${tail(link, "")}`,
        `Oi *${broker}*, o plantão${start ? ` das ${start}` : ""} está chegando. Confirme sua presença para receber leads.${tail(link, "👉 ")}`,
        `📅 ${broker}, confirme sua presença no plantão${start ? ` (${start})` : ""} para entrar na distribuição.${tail(link, "Confirmar: ")}`,
      ];
    }
  }
}

function stableHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  return hash;
}

/**
 * Picks one version for a message. Stable per seed (a retry keeps its text)
 * and never the version this person received last, when there is another.
 */
export function pickNoticeVariant<T extends { key: string }>(pool: readonly T[], seed: string, lastKey: string | null): T | null {
  if (!pool.length) return null;
  const others = pool.length > 1 ? pool.filter((item) => item.key !== lastKey) : pool;
  const candidates = others.length ? others : pool;
  return candidates[stableHash(seed) % candidates.length]!;
}

/** At most this many library messages rotate for one notice. */
export const MAX_NOTICE_FREE_MESSAGES = 5;
