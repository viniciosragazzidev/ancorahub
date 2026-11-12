"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import page from "@/components/lite/page/lite-page.module.css";
export default function ImportsError({ reset }: { reset: () => void }) { return <main className={page.stack}><section className={page.empty} role="alert"><h2 className={page.emptyTitle}>Importação indisponível</h2><p className={page.emptyText}>Confira se Importações e Implantação estão liberadas para seu cargo e se o lote pertence ao seu escopo.</p><div className="flex flex-wrap justify-center gap-2"><Button onClick={reset}>Tentar novamente</Button><Button variant="outline" render={<Link href="/administracao/importacoes" />}>Voltar aos lotes</Button></div></section></main>; }
