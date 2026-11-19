import type { CallAncoraContact } from "./contacts";

/**
 * De onde vem a fila inicial de uma sessão do Call Âncora (lado do servidor).
 *
 * Hoje a base geral de frios ainda não existe (plano em
 * docs/implementations/active/2026-11-19-call-ancora-frios.md), então a fila começa vazia.
 * A "Lista de teste" de admin/dev continua sendo a única forma de carregar números.
 * Quando a base existir, um ColdBaseQueueSource implementa esta interface (com reserva por
 * corretor) e entra no lugar de [emptyColdBaseQueueSource], sem mudar o store nem o app.
 */
export interface CallAncoraQueueSource {
  readonly kind: "cold_base";
  /** Contatos da sessão deste corretor. Só marque `dialable: true` o que pode ser discado de verdade. */
  initialQueue(scope: { tenantId: string; brokerId: string }): CallAncoraContact[];
}

/** Base de frios ainda não ligada: fila vazia. */
export const emptyColdBaseQueueSource: CallAncoraQueueSource = {
  kind: "cold_base",
  initialQueue: () => [],
};
