"use client";

/**
 * /ferramentas no Lite (28/11/2026, artifact "Comercial", direção limpa): as mesmas ferramentas do catálogo em linhas
 * num cartão só, com ícone, nome, descrição e seta. Materiais das operadoras continua só para o diretor.
 */
import Link from "next/link";

import { ComercialPage, cm } from "@/features/comercial-lite/comercial-kit";

const TOOLS = [
  {
    name: "Validador de comprovante",
    description: "Confere o comprovante de pagamento contra a proposta e o boleto antes de liberar adiantamento ao corretor.",
    href: "/ferramentas/validador-comprovante",
    icon: "receipt" as const,
    directorOnly: false,
  },
  {
    name: "Materiais das operadoras",
    description: "Importa tabelas, manuais, redes e cotações das operadoras e cataloga cada informação por operadora, plano e área para a Cotação Express.",
    href: "/ferramentas/materiais-operadoras",
    icon: "books" as const,
    directorOnly: true,
  },
];

function ToolIcon({ icon }: { icon: "receipt" | "books" }) {
  return icon === "receipt"
    ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" /><path d="M9 8h6M9 12h6" /></svg>
    : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 4h4v16H5zM10 4h4v16h-4z" /><path d="m15 5 3.5-1 2.5 15-3.5 1z" /></svg>;
}

export function ToolsLite({ isDirector }: { isDirector: boolean }) {
  const tools = TOOLS.filter((tool) => isDirector || !tool.directorOnly);
  return (
    <ComercialPage title="Ferramentas" summary="Atalhos que ajudam a fechar a venda.">
      <section className={cm.card} aria-label="Ferramentas disponíveis">
        {tools.map((tool) => (
          <Link key={tool.href} href={tool.href} className={cm.toolRow} aria-label={`Abrir ${tool.name}`}>
            <span className={cm.toolIcon}><ToolIcon icon={tool.icon} /></span>
            <span style={{ minWidth: 0 }}><span className={cm.t1}>{tool.name}</span><span className={cm.toolDesc}>{tool.description}</span></span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" style={{ color: "var(--c-text-muted)" }}><path d="m9 6 6 6-6 6" /></svg>
          </Link>
        ))}
      </section>
    </ComercialPage>
  );
}
