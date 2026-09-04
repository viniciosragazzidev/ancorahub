"use client";

import { Button } from "@/components/ui/button";
import { signOut } from "@/shared/auth/client";
import { toast } from "@/components/ui/sonner";

export function LogoutButton() {
  async function handleLogout() {
    toast.info("Encerrando sua sessão...");
    try {
      await signOut();
    } catch {
      // signOut may fail if the server is unreachable, but we still redirect
      // so the user can re-authenticate cleanly.
    }
    // Hard navigation guarantees the proxy middleware runs with a cleared cookie.
    window.location.href = "/login";
  }
  return <Button type="button" variant="outline" onClick={handleLogout}>Sair</Button>;
}
