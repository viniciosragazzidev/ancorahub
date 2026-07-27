# Padrões de design, UI e motion

## Fonte visual

`DESIGN.md` e `docs/ui-foundation.md` são a fonte de verdade visual. O CorreTop é um produto operacional claro, confiável e de alta densidade organizada; não usar estética genérica, gradientes decorativos ou cópias de templates.

## Regra de componentes

- Procurar primeiro em `src/components/ui/` (shadcn) e `src/components/unlumen-ui/`.
- Evoluir a variante compartilhada quando a necessidade se repetir.
- Uma página compõe; um componente compartilhado define aparência e estados.
- Não criar Button/Input/Card/Badge local com outra altura, raio, cor ou foco sem uma justificativa registrada.
- Usar `dashboard-01` como fundação das superfícies de dashboard quando o MCP/documentação estiver disponível.

## Tokens

- Superfícies: `background`, `card`, `popover`, `sidebar`, `input`, `border`.
- Texto: `foreground`, `muted-foreground`, `primary-foreground`.
- Semântica: `primary`, `success`, `warning`, `destructive`.
- Charts usam `chart-1` a `chart-5`; não reutilizar cor de gráfico como estado semântico.
- Nunca inserir hex/rgb arbitrário em uma tela se houver token equivalente.
- Manter relações equivalentes em light e dark mode.

## Hierarquia e densidade

Cada tela deve ter:

1. contexto: onde estou e para qual unidade/tenant;
2. prioridade: o que exige atenção agora;
3. uma ação principal e no máximo três secundárias relevantes;
4. estado e próximo passo;
5. conteúdo secundário em tabs, dialogs, sheets ou seções recolhíveis quando a tela ficar longa.

Use cards somente para hierarquia real. Listas operacionais preferem `Table`, `DataTable`, divisores e espaço consistente. Métricas devem vir de dados autorizados; nunca números fixos.

## Tabs, etapas e dialogs

- Tabs agrupam contextos paralelos, não etapas obrigatórias.
- Etapas/wizards são para pré-requisitos sequenciais e salvamento parcial explícito.
- Dialog confirma ação curta; Sheet acomoda formulários contextuais; página própria acomoda trabalho longo.
- Estado da aba/filtro que define contexto deve ser recuperável pela URL quando útil.
- Não esconder uma ação crítica sem indicar onde ela está e por que está disponível.

## Responsividade

- Padrão: container responsivo e `max-w` consistente; breakpoints `sm`, `md`, `lg`, `xl`, `2xl`.
- Layouts usam grid para colunas previsíveis; evitar cálculos flex complexos.
- Não usar `h-screen` para superfície que precisa sobreviver à barra móvel; preferir `min-h-[100dvh]`.
- Tabelas densas ganham modo móvel explícito: colunas prioritárias, detalhes em dialog ou alternativa de cards.

## Motion

- Motion comunica hierarquia, mudança de estado, carregamento ou feedback; nunca é decoração obrigatória.
- Animações novas seguem `transitions-dev`, ficam em folhas client pequenas e respeitam `prefers-reduced-motion`.
- Entrada/saída de dialog, sheet e tabs deve ser curta e estável; não animar cada linha de tabela ou métrica.
- A capacidade global de motion deve poder ser desligada pelo Super-admin sem bloquear a ação nem remover feedback textual.
- View Transitions não devem renderizar duas rotas completas em split-screen durante navegação.

## Copy e feedback

- Títulos descrevem a tarefa, não o componente (“Documentos do lead”, não “Card de documentos”).
- Labels e botões usam verbos e consequência (“Aprovar documento”, “Salvar cotação”).
- Toast confirma resultado; não substitui mensagem persistente de erro ou estado vazio.
- Não usar emoji, texto fictício ou métrica ornamental em produção.
