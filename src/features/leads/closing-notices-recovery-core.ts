export type ClosingNoticeAttempt = {
  status: string;
  sentAt: Date | string | null;
  queuedAt: Date | string | null;
  failedAt: Date | string | null;
  createdAt: Date | string | null;
};

export type ClosingNoticeRecoveryPlan = {
  sendCongratulations: boolean;
  directorPhones: string[];
};

export function planClosingNoticeRecovery(input: {
  brokerKey: string | null;
  directorKeys: Array<{ phone: string; key: string }>;
  existingKeys: ReadonlySet<string>;
}): ClosingNoticeRecoveryPlan {
  return {
    sendCongratulations: Boolean(input.brokerKey && !input.existingKeys.has(input.brokerKey)),
    directorPhones: input.directorKeys
      .filter((recipient) => !input.existingKeys.has(recipient.key))
      .map((recipient) => recipient.phone),
  };
}

function formatTimestamp(value: Date | string | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value;
  return `${part("day")}/${part("month")} ${part("hour")}:${part("minute")}`;
}

export function formatClosingNoticeAttempt(attempt: ClosingNoticeAttempt | null | undefined) {
  if (!attempt) return "não enviado";
  const timestamp = formatTimestamp(
    attempt.status === "sent" ? attempt.sentAt : attempt.status === "failed" ? attempt.failedAt : attempt.queuedAt,
  ) ?? formatTimestamp(attempt.createdAt);
  if (attempt.status === "sent") return `enviado${timestamp ? ` ${timestamp}` : ""}`;
  if (["queued", "pending", "processing"].includes(attempt.status)) return `na fila${timestamp ? ` ${timestamp}` : ""}`;
  if (attempt.status === "failed") return `falhou${timestamp ? ` ${timestamp}` : ""}`;
  return `registrado${timestamp ? ` ${timestamp}` : ""}`;
}

export function formatDirectorNoticeStatus(
  recipients: Array<{ attempt: ClosingNoticeAttempt | null; label?: string }>,
) {
  if (recipients.length === 0) return "sem destinatários configurados";
  if (recipients.length === 1) return formatClosingNoticeAttempt(recipients[0].attempt);
  if (recipients.some((recipient) => recipient.label)) {
    return recipients.map(({ label, attempt }) => `${label ?? "Destino"}: ${formatClosingNoticeAttempt(attempt)}`).join(" · ");
  }

  const groups = new Map<string, { count: number; latest: string | null }>();
  for (const recipient of recipients) {
    const label = formatClosingNoticeAttempt(recipient.attempt);
    const group = groups.get(label) ?? { count: 0, latest: null };
    group.count += 1;
    const timestamp = recipient.attempt
      ? formatTimestamp(recipient.attempt.status === "sent"
        ? recipient.attempt.sentAt
        : recipient.attempt.status === "failed"
          ? recipient.attempt.failedAt
          : recipient.attempt.queuedAt) ?? formatTimestamp(recipient.attempt.createdAt)
      : null;
    if (timestamp && (!group.latest || timestamp > group.latest)) group.latest = timestamp;
    groups.set(label, group);
  }

  return [...groups.entries()].map(([label, group]) => {
    if (group.count === 1) return label;
    const state = label.replace(/ \d{2}\/\d{2} \d{2}:\d{2}$/, "");
    const pluralState = state === "enviado" ? "enviados" : state === "na fila" ? "na fila" : state === "não enviado" ? "não enviados" : state;
    return `${group.count} ${pluralState}${group.latest ? `; último ${group.latest}` : ""}`;
  }).join(" · ");
}

export function formatClosingNoticePreview(input: {
  congratulations: ClosingNoticeAttempt | null;
  directorRecipients: Array<{ attempt: ClosingNoticeAttempt | null; label?: string }>;
}) {
  return `Parabéns: ${formatClosingNoticeAttempt(input.congratulations)} · Direção: ${formatDirectorNoticeStatus(input.directorRecipients)}`;
}

export function hasPendingClosingNoticeDelivery(input: {
  brokerKey: string | null;
  directorKeys: string[];
  existingKeys: ReadonlySet<string>;
}) {
  return Boolean(input.brokerKey && !input.existingKeys.has(input.brokerKey))
    || input.directorKeys.some((key) => !input.existingKeys.has(key));
}
