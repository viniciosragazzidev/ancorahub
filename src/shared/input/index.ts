/**
 * Entrada sem atrito (Postel: aceita bagunçado, devolve limpo). Funções puras para telefone, CPF/CNPJ, valor em
 * reais e data, mais a máscara de digitação. O hook React fica em `@/shared/input/use-campo-mascarado`.
 */
export * from "./telefone";
export * from "./documento";
export * from "./dinheiro";
export * from "./data";
export { aplicarMascara, mascarar, MODO_TECLADO, type EntradaMascara, type TipoMascara } from "./mascara";
