import { redirect } from "next/navigation";

/** Tela antiga de visão geral (26/11/2026): os números vivem no Painel e na própria área. Link velho cai na área. */
export default function LegacyDashboardRedirect() {
  redirect("/conversas");
}
