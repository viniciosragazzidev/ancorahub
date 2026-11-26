import Link from "next/link";

import page from "@/components/lite/page/lite-page.module.css";

/**
 * Tarefas e Ligações fora do visual do diretor (corretor, supervisor e gestor): o diretor troca pelas abas da área
 * Leads (nav-registry); aqui a troca fica no topo da própria tela.
 */
export function TasksSectionNav({ current }: { current: "tarefas" | "ligacoes" }) {
  return (
    <nav className={page.countTabs} aria-label="Tarefas e ligações">
      <Link href="/tarefas" className={page.countTab} data-active={current === "tarefas" ? "true" : undefined} aria-current={current === "tarefas" ? "page" : undefined}>Tarefas</Link>
      <Link href="/tarefas/ligacoes" className={page.countTab} data-active={current === "ligacoes" ? "true" : undefined} aria-current={current === "ligacoes" ? "page" : undefined}>Ligações</Link>
    </nav>
  );
}
