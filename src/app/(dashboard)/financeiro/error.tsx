"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import page from "@/components/lite/page/lite-page.module.css";
export default function FinanceError({ reset }: { reset: () => void }) { return <main className={page.stack}><section className={page.empty} role="alert"><h2 className={page.emptyTitle}>Financeiro indisponível</h2><p className={page.emptyText}>Confira a liberação do módulo e seu escopo com o administrador. Nenhum lançamento será alterado nesta tela.</p><div className="flex flex-wrap justify-center gap-2"><Button onClick={reset}>Tentar novamente</Button><Button variant="outline" render={<Link href="/financeiro" />}>Limpar filtros</Button><Button variant="outline" render={<Link href="/dashboard" />}>Voltar ao início</Button></div></section></main>; }
