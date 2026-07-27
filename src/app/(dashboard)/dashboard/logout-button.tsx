"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { signOut } from "@/shared/auth/client";
import { toast } from "sonner";

export function LogoutButton() {
  const router = useRouter();
  async function handleLogout() {
    toast.info("Encerrando sua sessão...");
    try { await signOut(); toast.success("Sessão encerrada."); window.setTimeout(() => { router.replace("/login"); router.refresh(); }, 250); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível sair agora."); }
  }
  return <Button type="button" variant="outline" onClick={handleLogout}>Sair</Button>;
}
