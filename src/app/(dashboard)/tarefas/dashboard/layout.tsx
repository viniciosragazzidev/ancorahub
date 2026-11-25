import { redirectManagerAway } from "@/features/manager-scope/deny-manager";

/** Fora da gestão da unidade: o gestor não abre o painel de números de tarefas (10/11). A lista /tarefas é dele, escopada à unidade (25/11). */
export default async function ManagerBlockedLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await redirectManagerAway();
  return children;
}
