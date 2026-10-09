export function formatDateTime(value: Date | string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function stageLabel(status: string) {
  switch (status) {
    case "in_contact":
      return "Em atendimento";
    case "quote_sent":
      return "Cotação enviada";
    case "negotiation":
      return "Em negociação";
    case "converted":
      return "Venda realizada";
    case "documentation_pending":
      return "Documentação pendente";
    case "lost":
      return "Perdido";
    case "distributed":
    case "new":
      return "Novo lead";
    default:
      return "Contato iniciado";
  }
}

/** yyyy-mm-dd in the local calendar (what the follow-up date field stores). */
export function toLocalDateKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
