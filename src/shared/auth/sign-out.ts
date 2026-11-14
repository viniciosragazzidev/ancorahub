"use client";

import { signOut } from "@/shared/auth/client";

/**
 * Sai da conta e vai para o login de verdade. Só chamar `signOut()` encerrava a sessão no servidor mas deixava a tela do
 * app montada até a próxima navegação (era preciso dar F5). A navegação completa garante que o proxy rode com o cookie já
 * limpo; mesmo se o servidor não responder, a pessoa cai no login e entra de novo do zero.
 */
export async function signOutAndGoToLogin() {
  try {
    await signOut();
  } catch {
    // Sem resposta do servidor: o login abaixo pede para entrar de novo.
  }
  window.location.replace("/login");
}
