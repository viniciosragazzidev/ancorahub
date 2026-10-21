export type WhatsAppActivityRow = {
  id: string;
  name: string;
  connected: boolean;
  leadCount: number | string;
};

export type WhatsAppActivitySummary = {
  connectedBrokerCount: number;
  totalLeads: number;
  brokers: Array<{ id: string; name: string; leadCount: number }>;
};

/** Summarizes the SQL aggregation while keeping only connected brokers in the list. */
export function summarizeWhatsAppActivity(rows: WhatsAppActivityRow[]): WhatsAppActivitySummary {
  const brokers = rows
    .filter((row) => row.connected)
    .map((row) => ({ id: row.id, name: row.name, leadCount: Math.max(0, Number(row.leadCount) || 0) }))
    .sort((a, b) => b.leadCount - a.leadCount || a.name.localeCompare(b.name, "pt-BR"));

  return {
    connectedBrokerCount: brokers.length,
    totalLeads: brokers.reduce((sum, broker) => sum + broker.leadCount, 0),
    brokers,
  };
}
