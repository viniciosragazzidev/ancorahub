"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import page from "@/components/lite/page/lite-page.module.css";
export default function IncentiveCampaignsError({ reset }: { reset: () => void }) {
  return <main className={page.stack}><section className={page.empty} role="alert"><h2 className={page.emptyTitle}>Campanhas indisponíveis</h2><p className={page.emptyText}>Confira com o administrador se o módulo de incentivos está liberado para seu perfil. Se estava funcionando, tente novamente.</p><div className="flex flex-wrap justify-center gap-2"><Button onClick={reset}>Tentar novamente</Button><Button variant="outline" render={<Link href="/campanhas-incentivo" />}>Ver campanhas</Button><Button variant="outline" render={<Link href="/dashboard" />}>Voltar ao início</Button></div></section></main>;
}
