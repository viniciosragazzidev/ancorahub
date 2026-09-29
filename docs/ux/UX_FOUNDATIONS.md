# UX Foundations & Design System Canonical Specification (UX-GOV-1)

> **Status**: APPROVED & ACTIVE  
> **Location**: `src/components/foundations/` & `src/styles/`  
> **Source of Truth**: `docs/ux/UX_REDESIGN_CONTRACT.md`  
> **Control Gate**: `docs/ux/UX_REDESIGN_CONTROL.md`  
> **Production URL**: `https://crm.ancorasaude.cloud`  

---

## 1. Princípios Inegociáveis de Design & Governança

Toda alteração de interface no CRM Âncora deve seguir a hierarquia fundamental de **Progressive Disclosure**:

```text
L1 — IMMEDIATE (Visível imediatamente: métrica chave, ação primária, estado operacional)
    ↓
L2 — CONTEXTUAL (Um clique / Aba ativa: filtros rápidos, abas de domínio, notas)
    ↓
L3 — DEEP / ADVANCED (Sob demanda: Sheets de filtros avançados, Drawers de inspeção, Modais de confirmação)
```

### Regras Fundamentais:
1. **Design System First (REUSE → REFINE → EXTEND → CREATE)**: Antes de criar qualquer estilo ou componente, procure tokens e variantes existentes. Criações novas exigem justificativa formal.
2. **Proibição Estrita de "Magic Visual Values"**: É proibido o uso de classes arbitrárias (ex: `mt-[13px]`, `text-[15.3px]`, `rounded-[11px]`, `bg-[#f7f8fa]`) sem decisão documentada em `UX_DECISIONS.md`.
3. **Sem "Card-Soup"**: Nem todo agrupamento de dados deve ser colocado dentro de um card com borda e sombra. O padrão estrutural padrão é `<Section variant="plain" />`, que utiliza ritmo de espaçamento vertical e tipografia.
4. **Hierarquia Estrita de Ações**: Máximo de **1 ação primária** (`variant="default"`) por contexto de página. Ações secundárias ficam em `PageActions moreActions={[...]}`.
5. **Preservação Integral de Funcionalidades**: Nenhuma funcionalidade é removida; simplificar significa organizar em camadas adequadas.
6. **Multi-tenancy e Segurança no Servidor**: Componentes visuais nunca dependem de `tenant_id` ou de permissões manipuladas no cliente.

---

## 2. Escala Canônica de Espaçamento e Ritmo Vertical

O ritmo vertical é a base da harmonia visual. É proibido escolher paddings e gaps aleatoriamente por tela.

| Nível | Token / Classe | Valor | Uso Obrigatório |
|---|---|---|---|
| **INLINE** | `gap-1` a `gap-1.5` | 4px – 6px | Ícone + texto, badges com dot, chips internos |
| **ITEM** | `gap-2` a `gap-3` | 8px – 12px | Label + Input, avatar + nome, botões de ação adjacentes |
| **GROUP** | `gap-4` a `gap-5` | 16px – 20px | Elementos do mesmo formulário, grid de KPIs, cards de métricas |
| **SECTION** | `gap-6` ou `space-y-6` | 24px | Distância entre seções estruturais independentes |
| **MAJOR SECTION** | `gap-8` ou `space-y-8` | 32px | Separação entre blocos de cabeçalho e corpo principal |
| **PAGE PADDING** | `p-4 sm:p-6 lg:p-8` | 16px / 24px / 32px | Padding externo padrão de todas as páginas |

---

## 3. Escala Canônica de Tipografia e Hierarquia

A hierarquia de informação deve ser estabelecida prioritariamente por tipografia e peso, e não por caixas coloridas.

| Nível | Classe / Token | Peso | Uso Obrigatório |
|---|---|---|---|
| **Page Title** | `text-2xl font-bold tracking-tight text-foreground` | 700 | Título principal da página no `PageHeader` |
| **Section Title** | `text-base sm:text-lg font-semibold tracking-tight text-foreground` | 600 | Título de seções e tabelas em `Section` |
| **KPI Value** | `text-2xl sm:text-3xl font-bold tracking-tight text-foreground` | 700 | Valores numéricos em cards de métricas |
| **Body Primary** | `text-sm font-medium text-foreground` | 500 | Nomes de leads, textos de formulário, itens de tabela |
| **Body Muted** | `text-sm text-muted-foreground` | 400 | Descrições de cabeçalho, explicações contextuais |
| **Metadata / Sub** | `text-xs text-muted-foreground` | 400 | Telefones, emails, datas, horários de mensagem |
| **Caption / Badge** | `text-[10px] sm:text-xs font-semibold tracking-wide uppercase` | 600 | Status de roleta, badges semânticos, contadores |

---

## 4. Matriz Semântica de Cores (Cores com Propósito)

A cor não é decorativa; toda cor comunica um estado do sistema.

| Tom (`tone`) | Variáveis CSS | Significado | Onde Utilizar |
|---|---|---|---|
| **Primary** | `--primary`, `--primary-foreground` | Ação principal, foco ativo, identidade | 1 Botão primário por tela, tab ativa |
| **Success** | `--success`, `text-emerald-500` | Concluído, aprovado, ativo, saudável | Status "Convertido", Filial ativa, Template Meta aprovado |
| **Warning** | `--warning`, `text-amber-500` | Atenção, pendência, pausa temporária | Fila pausada, SLA próximo do limite, documento pendente |
| **Danger** | `--destructive`, `text-red-500` | Erro, crítico, rejeição, destrutivo | SLA vencido, webhook com falha, ação de excluir |
| **Info** | `--accent`, `text-sky-500` | Em andamento, processo operacional ativo | Lead em atendimento, sincronização ativa |
| **Neutral** | `--muted-foreground`, `text-slate-400` | Estado neutro, rascunho, arquivado | Inativo, metadados, separadores |

---

## 5. Biblioteca de Componentes Canônicos (`src/components/foundations/`)

| Componente | Arquivo | Finalidade & API |
|---|---|---|
| `<PageHeader />` | `page-header.tsx` | Cabeçalho canônico com `title`, `description`, `breadcrumb`, `context` tags e slot `actions`. |
| `<PageActions />` | `page-actions.tsx` | Barra de ações no topo com `primaryAction` (destacada) e `moreActions` (menu dropdown). |
| `<PageTabs />` | `page-tabs.tsx` | Abas de navegação sincronizadas com a URL (`?tab=`), indicador animado via Motion e suporte total a teclado. |
| `<FilterBar />` | `filter-bar.tsx` | Barra de busca rápida com debounce, chips ágeis, contadores de resultados e botão de sheet avançado. |
| `<ActiveFilterChips />` | `active-filter-chips.tsx` | Exibição de filtros aplicados com remoção individual e botão "Limpar todos". |
| `<RowActions />` | `row-actions.tsx` | Menu de 3 pontos para tabelas e listas com agrupamento semântico (`primary`, `management`, `danger`). |
| `<Section />` | `section.tsx` | Bloco estrutural limpo (não-card por padrão) com cabeçalho, contadores e ações. Suporta `variant="plain" \| "card" \| "bordered"`. |
| `<CollapsibleSection />` | `section.tsx` | Seção expansível para blocos densos ou configurações avançadas sob demanda. |
| `<SettingsSection />` | `settings-section.tsx` | Padrão visual para páginas de ajustes e controles operacionais (`SettingsToggleRow`). |
| `<DetailDrawer />` | `detail-drawer.tsx` | Drawer lateral direito padronizado com cabeçalho fixo, corpo rolável e rodapé de ações. |
| `<ConfirmDialog />` | `confirm-dialog.tsx` | Modal canônico para confirmação de ações destrutivas ou de impacto com indicação clara. |
| `<StatusBadge />` & `<StatusDot />` | `status-badge.tsx` | Indicadores de status com os 5 tons semânticos padronizados. |
| `<EmptyState />` | `empty-state.tsx` | Estados vazios com 5 categorias semânticas (`EMPTY_DATA`, `EMPTY_SEARCH`, `EMPTY_FILTER`, `NO_PERMISSION`, `OPTIONAL_FEATURE`). |
| Skeletons | `skeletons.tsx` | Estados de carregamento padronizados (`TableSkeleton`, `PageSkeleton`, `MetricSkeleton`, `DetailSkeleton`). |

---

## 6. Checklist Obrigatório de Visual QA (30 Pontos)

Antes de considerar qualquer tela concluída, validar obrigatoriamente:

```markdown
- [ ] 1. Page padding consistente (p-4 sm:p-6 lg:p-8)?
- [ ] 2. Título no tamanho correto (text-2xl font-bold)?
- [ ] 3. Descrição não compete com o título (text-sm text-muted-foreground)?
- [ ] 4. Espaçamento cabeçalho → conteúdo correto (space-y-6 a space-y-8)?
- [ ] 5. Controles e inputs possuem a mesma altura (h-9 ou h-10)?
- [ ] 6. Ícones possuem tamanho e alinhamento consistentes (size-4 a size-6)?
- [ ] 7. Texto secundário e metadados estão legíveis com contraste suficiente?
- [ ] 8. Existe no máximo 1 botão Primary destacado no cabeçalho?
- [ ] 9. Não há excesso de cards aninhados ("card-soup")?
- [ ] 10. Não há bordas ou caixas redundantes ao redor de tudo?
- [ ] 11. Não há badges coloridos desnecessários para dados secundários?
- [ ] 12. Todas as cores utilizadas possuem significado funcional claro?
- [ ] 13. Tabela possui densidade confortável e leitura desobstruída?
- [ ] 14. Conteúdo essencial é visível na primeira dobra sem rolagem excessiva?
- [ ] 15. Empty state possui título, explicação e ação de próximo passo?
- [ ] 16. Skeletons de carregamento respeitam as dimensões reais do conteúdo?
- [ ] 17. Mensagens de erro são contidas e explicativas?
- [ ] 18. Layout se adapta confortavelmente em 1366×768, 1440×900 e 1920×1080?
- [ ] 19. Mobile mantém a hierarquia essencial e oculta colunas secundárias?
- [ ] 20. Drawer lateral abre suavemente sem travar o scroll da página?
- [ ] 21. Abas e filtros sincronizam o estado com a URL (?tab=, ?status=)?
- [ ] 22. Foco visível por teclado (focus-visible) em todos os elementos interativos?
- [ ] 23. Botões e links possuem aria-label e título descritivo?
- [ ] 24. Sem aninhamento inválido de tags HTML (ex: button dentro de button)?
- [ ] 25. Nenhum magic value sem justificativa registrada em UX_DECISIONS.md?
- [ ] 26. Formulários usam useActionState com feedback por toast consistente?
- [ ] 27. Ações destrutivas exigem confirmação via ConfirmDialog?
- [ ] 28. Dados e permissões validados exclusivamente no servidor (multi-tenant seguro)?
- [ ] 29. 100% de funcionalidades anteriores preservadas e mapeadas?
- [ ] 30. Testes automatizados e checagem de tipos (tsc) passam com 0 erros?
```

---

## 7. Declarações Obrigatórias de Gate

Toda entrega de etapa deve formalizar os seguintes gates:

```text
DOCUMENTATION_UPDATED = YES
FUNCTIONALITY_MATRIX_UPDATED = YES
DESIGN_SYSTEM_FOLLOWED = YES
NEW_VISUAL_MAGIC_VALUES = NO
SPACING_VISUALLY_VALIDATED = YES
TYPOGRAPHY_VISUALLY_VALIDATED = YES
COLORS_VISUALLY_VALIDATED = YES
RESPONSIVE_VISUALLY_VALIDATED = YES
ACCESSIBILITY_VALIDATED = YES
VALID_FUNCTIONALITY_REMOVED = NO
BUSINESS_RULE_CHANGED = NO
```
