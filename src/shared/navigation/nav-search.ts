/**
 * Páginas do menu para a busca Ctrl+K (25/11/2026, docs/research/deskcomm-crm-engenharia-reversa.md, item 3):
 * a busca lê o mesmo cadastro do menu lateral, então toda aba que a pessoa enxerga se acha digitando.
 */
import { NAV_AREAS, canShowNavTab, type NavAccessUser } from "./nav-registry";

export type NavSearchPage = { id: string; title: string; subtitle: string; href: string };

/** Minúsculas e sem acento: "comissoes" acha "Comissões". */
export function normalizeSearchText(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

/** Abas visíveis ao usuário cujo nome, área ou descrição da área contém todas as palavras buscadas. */
export function searchNavPages(query: string, user: NavAccessUser | null, limit = 8): NavSearchPage[] {
  const words = normalizeSearchText(query).split(/\s+/).filter(Boolean);
  if (words.length === 0 || !user) return [];
  const pages: NavSearchPage[] = [];
  for (const area of NAV_AREAS) {
    for (const tab of area.tabs) {
      if (!canShowNavTab(tab, user)) continue;
      const title = tab.label === area.label ? area.label : `${area.label}: ${tab.label}`;
      const haystack = normalizeSearchText(`${area.label} ${tab.label} ${area.fullLabel}`);
      if (words.every((word) => haystack.includes(word))) pages.push({ id: `${area.id}:${tab.id}`, title, subtitle: area.fullLabel, href: tab.href });
    }
  }
  // Quem bate no nome da aba vem antes de quem só bate na área.
  const first = normalizeSearchText(words.join(" "));
  return pages
    .map((page, index) => ({ page, index, own: normalizeSearchText(page.title.split(": ").pop() ?? "").includes(first) ? 0 : 1 }))
    .sort((a, b) => a.own - b.own || a.index - b.index)
    .slice(0, limit)
    .map(({ page }) => page);
}
