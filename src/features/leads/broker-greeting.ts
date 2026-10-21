/** First line the broker sends to a new lead on WhatsApp (editable there before sending). */
export function brokerGreeting(leadName: string | null | undefined) {
  const name = (leadName ?? "").trim();
  const first = name.split(/\s+/)[0] || name;
  return first
    ? `Olá, ${first}! Sou seu corretor e vou seguir com seu atendimento por aqui.`
    : "Olá! Sou seu corretor e vou seguir com seu atendimento por aqui.";
}
