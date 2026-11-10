import { redirectManagerAway } from "@/features/manager-scope/deny-manager";

/** Fora da gestão da unidade: o gestor não abre esta área (10/11, gestor na versão antiga). */
export default async function ManagerBlockedLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await redirectManagerAway();
  return children;
}
