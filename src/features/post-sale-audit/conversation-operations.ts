export type PostSaleMessageKind = "text" | "audio" | "image" | "document" | "video" | "sticker" | "location" | "contact";

export function postSaleMediaReply(kind: PostSaleMessageKind): string | null {
  if (kind === "audio") return "Recebi seu áudio. Para continuar a pesquisa, pode me responder por texto?";
  if (kind === "image") return "Recebi sua imagem. Para continuar a pesquisa, pode me responder por texto?";
  return null;
}

export async function retryPostSaleOperation<T>(operation: () => Promise<T>, onFailure: (error: unknown, attempt: 1 | 2) => void): Promise<T> {
  try {
    return await operation();
  } catch (firstError) {
    onFailure(firstError, 1);
    try {
      return await operation();
    } catch (secondError) {
      onFailure(secondError, 2);
      throw secondError;
    }
  }
}

export async function requestPostSaleTextOnceAtStep(input: {
  step: number;
  claimStep: (step: number) => Promise<boolean>;
  send: () => Promise<unknown>;
  releaseStep: (step: number) => Promise<unknown>;
  onFailure: (error: unknown, attempt: 1 | 2) => void;
}): Promise<boolean> {
  if (!await input.claimStep(input.step)) return false;
  try {
    await retryPostSaleOperation(input.send, input.onFailure);
    return true;
  } catch {
    await input.releaseStep(input.step).catch(() => undefined);
    return false;
  }
}

export function runPostSaleOptOutTransaction<Tx, Result>(input: {
  transaction: (work: (tx: Tx) => Promise<Result>) => Promise<Result>;
  insertOptOut: (tx: Tx) => Promise<unknown>;
  updateSurvey: (tx: Tx) => Promise<Result>;
}): Promise<Result> {
  return input.transaction(async (tx) => {
    await input.insertOptOut(tx);
    return input.updateSurvey(tx);
  });
}

export async function routePostSaleInboundSafely(
  route: () => Promise<boolean>,
  context: { tenantId: string; leadId: string; channelType: "waha" | "meta" },
  logger: (message: string, details: Record<string, string>) => void = (message, details) => console.error(message, details),
): Promise<boolean> {
  try {
    return await route();
  } catch (error) {
    logger("[post-sale-audit] inbound_route_failed", {
      ...context,
      error: error instanceof Error ? error.message.slice(0, 120) : "unknown",
    });
    return false;
  }
}
