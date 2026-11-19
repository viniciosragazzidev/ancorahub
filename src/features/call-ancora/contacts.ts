/** De onde veio o contato: a base geral de frios (em construção) ou a lista de teste de admin/dev. */
export type CallAncoraContactSource = "cold_base" | "test_list";

export type CallAncoraContact = {
  id: string;
  name: string;
  phone: string;
  source: CallAncoraContactSource;
  /**
   * O app Android só disca quando isto é true. Só o servidor define, a partir da fonte da
   * fila (ex.: frio marcado "não ligar" ou fora da janela fica false).
   */
  dialable: boolean;
};
