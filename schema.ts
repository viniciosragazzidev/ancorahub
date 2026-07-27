/**
 * Compatibilidade para referências antigas ao schema na raiz.
 *
 * A fonte de verdade do Drizzle é `src/shared/db/schema.ts`, configurada em
 * `drizzle.config.ts`. Não crie modelos neste arquivo: ele existe apenas para
 * evitar a manutenção de dois contratos de banco divergentes.
 */
export * from "./src/shared/db/schema";
