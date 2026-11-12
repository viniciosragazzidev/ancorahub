"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import page from "@/components/lite/page/lite-page.module.css";
export default function ImplantationError({ reset }: { reset: () => void }) {
  return <main className={page.stack}><section className={page.empty} role="alert"><h2 className={page.emptyTitle}>Implantação indisponível</h2><p className={page.emptyText}>Confira com o administrador se o módulo está liberado para seu perfil. Se estava funcionando, tente novamente.</p><div className="flex flex-wrap justify-center gap-2"><Button onClick={reset}>Tentar novamente</Button><Button variant="outline" render={<Link href="/implantacoes" />}>Limpar filtros</Button><Button variant="outline" render={<Link href="/dashboard" />}>Voltar ao início</Button></div></section></main>;
}
