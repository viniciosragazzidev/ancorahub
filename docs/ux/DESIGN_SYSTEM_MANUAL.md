# Manual do Design System Canônico

**Estado:** ativo  
**Escopo vigente:** CRM autenticado. Super Admin, dev/diagnóstico, autenticação
e fluxos públicos estão documentados como ondas futuras e não são certificados
por esta versão do manual.  
**Código-fonte:** `src/components/ui`, `src/components/foundations` e `src/styles`

## 1. Arquitetura obrigatória

O produto usa três camadas, nesta ordem:

1. `src/components/ui/`: primitive única de interação ou apresentação. Não contém regra de produto.
2. `src/components/foundations/`: composição reutilizável de página. Não consulta dados nem decide permissão.
3. `src/features/*/components/`: combina as duas camadas com estados do domínio.

Arquivos de rota resolvem contexto confiável, autorização e dados no servidor; não inventam uma quarta camada visual. `src/components/base` e `src/components/application` ficam em quarentena: nenhuma importação nova é permitida até sua remoção ou adaptação.

## 2. Tokens

### Superfícies

| Token | Uso |
|---|---|
| `background` / `surface-base` | canvas da aplicação |
| `card` / `surface-card` | conteúdo elevado ou delimitado |
| `surface-secondary` | cabeçalhos de tabela e regiões recuadas |
| `popover` / `surface-overlay` | conteúdo portaled |
| `muted` | hover, seleção leve e suporte visual |

No tema claro o canvas e o corpo das tabelas são brancos. Separação ocorre por espaço e borda, nunca por um banho cinza sobre a página. A sidebar usa `sidebar: #050505`, com `sidebar-accent` e `sidebar-border`; nenhuma rota escolhe cores da rail.

### Cores semânticas

`primary` representa ação/seleção; `success`, conclusão; `warning`, atenção; `destructive`, erro ou perigo; `muted-foreground`, metadado. Hues diretos são aceitos apenas em gráficos e ilustrações. Status operacionais recebem `tone`, não classes de cor locais.

### Espaçamento, raio e elevação

| Relação | Token/classe |
|---|---|
| ícone e rótulo | `gap-1` ou `gap-1.5` |
| itens relacionados | `gap-2` ou `gap-3` |
| grupo | `gap-4` ou `gap-5` |
| seções | `gap-6` |
| página | `p-4 sm:p-6 lg:p-8` |
| controle | `--radius-control` |
| card | `--radius-card` |
| painel/overlay | `--radius-panel` |

Sombras são reservadas a overlays e feedback flutuante. Cards e tabelas usam borda de 1px e `shadow-none`.

### Tipografia

Inter é a fonte de interface; JetBrains Mono é restrita a IDs, telefones, valores técnicos e números tabulares. Título de página usa `text-2xl`, título de seção `text-base`/`text-lg`, corpo `text-sm`, metadado `text-xs`. Caixa alta é restrita a eyebrow e badge curto.

## 3. Contratos por situação

| Situação | Componente canônico | Variantes permitidas |
|---|---|---|
| ação | `ui/Button` | `primary`, `outline`, `secondary`, `ghost`, `accent`, `destructive`, `link` |
| ação somente com ícone | `ui/Button size="icon*"` | exige `aria-label`; ícone com `aria-hidden` |
| agrupamento | `ui/Card` ou `foundations/Section` | card: `default`, `subtle`, `compact`; section: `plain`, `card`, `bordered` |
| métrica | `dashboard/StatCard` | tom semântico, sem recipe local |
| dados tabulares | `ui/Table` + `ui/data-table/DataTableFrame` | `comfortable`, `compact` |
| tabela interativa | adapter TanStack existente sobre `DataTableFrame` | estado interno ou controlado, mesma aparência |
| navegação de rota | `foundations/PageTabs` | links reais e `aria-current` |
| conteúdo alternado local | `ui/Tabs` | `underline`, `pill`, `segment` |
| campo | `ui/Field` + control de `ui` | label, descrição, erro e IDs associados |
| confirmação | `foundations/ConfirmDialog` | perigo ou impacto relevante |
| edição contextual | `foundations/DetailDrawer`/`ui/Sheet` | lateral; corpo rolável |
| informação ancorada | `ui/Popover`/`ui/Tooltip` | não modal |
| status | `foundations/StatusBadge` | neutral, info, success, warning, danger |
| vazio/loading/erro | foundations de estado | dimensão estável e próxima ação explícita |

Dialog, Sheet, Drawer e Popover não são fundidos: possuem semântica, foco e comportamento diferentes. As duas APIs de DataTable podem coexistir enquanto controlam estado de formas diferentes, mas a superfície, cabeçalho, linha e célula vêm da mesma base `DataTableFrame`.

## 4. Ícones e conteúdo

Emoji é proibido como ícone, status ou decoração de interface. Use o catálogo já instalado e marque ícones decorativos com `aria-hidden="true"`. A regra não altera texto criado pelo cliente nem o corpo de mensagens WhatsApp/templates: esse conteúdo é dado do domínio, não chrome do produto.

## 5. Performance e acessibilidade

- Primitives estruturais permanecem server-safe; `"use client"` só existe quando há estado, evento ou API do navegador.
- Motion é opt-in. Botões, cards e tabelas usam CSS e `prefers-reduced-motion`.
- Um barrel não pode misturar uma árvore client-only grande com primitives server-safe.
- Tabs de rota carregam somente o domínio ativo; gráficos e editores pesados são lazy.
- Todo controle tem foco visível, nome acessível e alvo mínimo coerente.
- `<tr>` não substitui link/controle acessível; a célula identificadora contém o destino principal.

## 6. Fiscalização

- `npm run ui:audit`: falha quando uma categoria ultrapassa o baseline de migração.
- `npm run ui:audit:strict`: exige zero divergência no escopo CRM vigente.
- `npm run ui:catalog`: atualiza o catálogo transitive de todas as rotas.

O baseline do CRM é zero. As exclusões do auditor são fronteiras de escopo, não
aprovação implícita: cada área excluída precisa de uma onda e evidência próprias.
