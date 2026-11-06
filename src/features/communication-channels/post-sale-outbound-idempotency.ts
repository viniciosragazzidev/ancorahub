export async function resolvePostSaleOutboundInsert(input: {
  insertedId?: string;
  readRacedRow?: () => Promise<{ id: string; status: string } | null>;
  intendedStatus: string;
}) {
  if (input.insertedId) return { id: input.insertedId, status: input.intendedStatus, duplicate: false };
  const racedRow = await input.readRacedRow?.();
  if (!racedRow) throw new Error("A mensagem já foi criada, mas não foi possível confirmar o registro idempotente.");
  return { id: racedRow.id, status: racedRow.status, duplicate: true };
}
