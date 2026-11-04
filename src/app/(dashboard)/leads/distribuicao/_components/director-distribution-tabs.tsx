/** As abas da distribuição ficam na barra da área Distribuição (nav-registry); aqui fica só a regra de acesso às filas. */
export function canViewDistributionQueues(role: string) {
  return role === "director";
}
