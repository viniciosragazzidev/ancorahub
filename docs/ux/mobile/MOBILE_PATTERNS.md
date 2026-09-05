# UX-M1 — Padrões canônicos mobile

**Estado:** especificação aprovada para implementação incremental.

## Princípios

- mobile reorganiza prioridade; não reduz capacidades válidas;
- um eixo principal de scroll vertical por tela;
- apresentação responde ao viewport, nunca ao user agent;
- autorização, tenant e regra de negócio continuam server-side;
- o design system existente é reutilizado; não existe biblioteca mobile paralela.

## Breakpoints e tokens

O breakpoint da navegação lateral segue `useIsMobile`: abaixo de `768px` a rail
vira `Sheet`. A recomposição compacta do conteúdo permanece abaixo de `560px`.
Layouts intermediários continuam usando os breakpoints Tailwind existentes. Não
adicionar magic breakpoints locais.

| Token conceitual | Valor/implementação |
|---|---|
| page padding | `1rem`; aumenta pelos breakpoints existentes |
| section gap | `1rem` compacto; `1.5rem` quando separa domínios |
| touch target | mínimo de `2.75rem` quando a ação é isolada |
| compact header | uma linha principal; descrição sob demanda |
| bottom safe area | `max(0.625rem, env(safe-area-inset-bottom))` |
| sticky footer | padding inferior inclui safe area e não concorre com overlays |

## Anatomia e componentes

### Mobile page header

Compor a partir de `DashboardHeader`/`PageHeader`: voltar quando aplicável, título,
uma ação contextual e menu de mais ações. Breadcrumb e descrição longa ficam ocultos
quando não alteram a decisão.

### Navegação

A navegação gerencial usa uma única fonte: `CorreTopSidebar` como rail no desktop e
como `Sheet` lateral fixo sobre o conteúdo no mobile. O mesmo conjunto autorizado
de destinos é reutilizado, sem barra inferior paralela. O painel fecha ao escolher
uma rota, clicar no backdrop, acionar o botão de fechar ou pressionar Escape; a
transição respeita `prefers-reduced-motion`. O Corretor Lite continua com
`LightTopNavBar` pela DEC-015 e replica seus destinos no menu compacto.

### List item

Ordem: identificação, contexto curto, estado textual, próxima ação e menu. Usar
separadores discretos; não transformar cada linha em card alto.

### Filtros

Busca + `Filtros (n)` ficam visíveis. Filtros avançados usam `Sheet`; chips ativos
podem rolar horizontalmente em uma única linha. Aplicar/Limpar ficam no footer.

### Tables

Manter `<Table>` no desktop e oferecer representação de lista abaixo do breakpoint
quando a decisão exige mais de três colunas. Scroll horizontal é reservado a conteúdo
intrinsecamente horizontal, não como fallback padrão.

### Tabs

`PageTabs` rola horizontalmente, preserva a seleção na URL e não reduz tipografia para
caber. Conjuntos extensos podem usar seletor compacto documentado.

### Quick view e detalhe

Quick view curto usa bottom Sheet. Formulário, perfil ou detalhe rico usa full-height
Sheet ou página. A navegação de volta preserva filtro, tab e scroll quando aplicável.

### Forms

Uma coluna, label acima, input type/inputMode apropriados e footer de ação acessível
com teclado virtual aberto. Campos dependentes usam progressive disclosure.

### Dialogs e ações

Confirmações pequenas continuam em `Dialog`. Edição longa vira `Sheet`. Ação
destrutiva é separada, rotulada e confirmada proporcionalmente.

### Conversas

Estados canônicos: lista, chat e contexto. O chat ativo prioriza histórico e composer;
o perfil abre em Sheet. O composer respeita `dvh`, teclado e safe area.

### Feedback e estados

Loading preserva geometria; vazio explica o próximo passo; erro oferece retry;
indisponibilidade explica dependência. Toast não cobre a ação primária.

## QA obrigatório

- larguras: 320, 360, 375, 390, 412 e 430px;
- altura curta e landscape em dashboard, leads e conversas;
- teclado aberto em busca, formulário, filtros e chat;
- touch, back, scroll restoration, rede lenta, double submit e reduced motion;
- comparação Desktop × Mobile para comprovar preservação funcional.
