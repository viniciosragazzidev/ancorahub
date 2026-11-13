"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import page from "@/components/lite/page/lite-page.module.css";

export default function AdministrationError({ reset }: { reset: () => void }) {
  return <main className={page.stack}><section className={page.empty} role="alert"><h2 className={page.emptyTitle}>Não foi possível abrir a administração</h2><p className={page.emptyText}>Tente novamente. Se a preparação do ERP ainda estiver pendente, solicite sua conclusão ao administrador.</p><div className="flex flex-wrap justify-center gap-2"><Button onClick={reset}>Tentar novamente</Button><Button variant="outline" render={<Link href="/dashboard" />}>Voltar ao início</Button></div></section></main>;
}
