export type CallAncoraContactSource = "demo" | "test_list";

export type CallAncoraContact = {
  id: string;
  name: string;
  phone: string;
  /** De onde veio o contato. Só a lista de teste tem número real. */
  source: CallAncoraContactSource;
  /**
   * O app Android só disca quando isto é true. Só o servidor define, e só para a
   * "Lista de teste" de admin/dev. Contatos de demonstração nunca são discáveis.
   */
  dialable: boolean;
};

const DEMO = [
  ["demo-01", "Marina Duarte", "+55 00 0000-0001"],
  ["demo-02", "Rafael Nogueira", "+55 00 0000-0002"],
  ["demo-03", "Camila Freitas", "+55 00 0000-0003"],
  ["demo-04", "Eduardo Martins", "+55 00 0000-0004"],
  ["demo-05", "Patrícia Azevedo", "+55 00 0000-0005"],
  ["demo-06", "Lucas Moreira", "+55 00 0000-0006"],
  ["demo-07", "Fernanda Barros", "+55 00 0000-0007"],
  ["demo-08", "André Ribeiro", "+55 00 0000-0008"],
  ["demo-09", "Juliana Campos", "+55 00 0000-0009"],
  ["demo-10", "Thiago Costa", "+55 00 0000-0010"],
  ["demo-11", "Aline Monteiro", "+55 00 0000-0011"],
  ["demo-12", "Bruno Cardoso", "+55 00 0000-0012"],
  ["demo-13", "Renata Lopes", "+55 00 0000-0013"],
  ["demo-14", "Daniel Ferreira", "+55 00 0000-0014"],
  ["demo-15", "Sofia Almeida", "+55 00 0000-0015"],
  ["demo-16", "Pedro Henrique", "+55 00 0000-0016"],
  ["demo-17", "Isabela Rocha", "+55 00 0000-0017"],
  ["demo-18", "Gustavo Mendes", "+55 00 0000-0018"],
] as const;

/** Contatos de demonstração, sem relação com a base real da Âncora. Nunca discáveis. */
export const CALL_ANCORA_DEMO_CONTACTS: readonly CallAncoraContact[] = DEMO.map(([id, name, phone]) => ({
  id,
  name,
  phone,
  source: "demo",
  dialable: false,
}));
