---
name: AncoraHub — Conversa / Arc no cotador
description: Registro do sistema existente no corretor Lite e sua extensão de cotação, sem unificar as peles da plataforma.
colors:
  background: "#f7f7f9"
  surface: "#ffffff"
  surface-muted: "#f1f1f5"
  foreground: "#0b0b12"
  text-secondary: "#4b4b59"
  text-muted: "#666674"
  border: "rgb(16 16 40 / 0.08)"
  border-subtle: "rgb(16 16 40 / 0.05)"
  border-strong: "rgb(16 16 40 / 0.18)"
  accent: "#3b2dff"
  accent-strong: "#2a1fd1"
  accent-subtle: "rgb(59 45 255 / 0.1)"
  chat-action: "oklch(62% 0.2 255)"
  chat-action-text: "oklch(48% 0.2 258)"
  success: "#0f7a4d"
  warning: "#a15c00"
  danger: "#d4263a"
typography:
  body:
    fontFamily: "var(--font-jakarta-sans), ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
  label:
    fontFamily: "var(--font-jakarta-sans), ui-sans-serif, system-ui, sans-serif"
    fontSize: ".875rem"
    fontWeight: 500
    lineHeight: 1.4
  caption:
    fontFamily: "var(--font-jakarta-sans), ui-sans-serif, system-ui, sans-serif"
    fontSize: ".75rem"
rounded:
  control: "9999px"
  panel: "1.5rem"
  surface: "1.75rem"
  card: "1rem"
spacing:
  space-1: ".25rem"
  space-2: ".5rem"
  space-3: ".75rem"
  space-4: "1rem"
  space-5: "1.25rem"
  space-6: "1.5rem"
  space-8: "2rem"
components:
  button-primary:
    backgroundColor: "{colors.foreground}"
    textColor: "{colors.background}"
    rounded: "{rounded.control}"
    padding: "0 1rem"
    typography: "{typography.label}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.control}"
    padding: "0 1rem"
    typography: "{typography.label}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.control}"
    padding: "0 1rem"
    typography: "{typography.label}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.control}"
    padding: "0 .75rem"
  badge-info:
    backgroundColor: "{colors.accent-subtle}"
    textColor: "{colors.accent-strong}"
    rounded: "{rounded.control}"
    padding: "0 10px"
  card-default:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.card}"
    padding: "1.5rem"
---

# Design System: AncoraHub / Conversa / Arc

## Overview

**Creative North Star: "Conversa"**

Registro em scan mode do mundo já implementado: linguagem profissional, discreta e orientada à próxima ação. O cotador estende o repertório Conversa/Arc do corretor Lite com um formulário comercial e leitura progressiva dos resultados. Não estabelece uma nova direção visual.

Este arquivo descreve a implementação observada em 11/11/2026. O frontmatter registra somente o recorte claro de `.arc-venancor`, após os overrides Venancor em `src/components/arc/venancor-scope.css`, e os componentes compartilhados consumidos pelo cotador. Não é uma paleta global, nem autorização para importar `foundation.css` no `:root` da plataforma.

Autoridade normativa: [contrato UX](docs/ux/UX_REDESIGN_CONTRACT.md), [controle da etapa](docs/ux/UX_REDESIGN_CONTROL.md), [design system e exceções](docs/design-system.md) e [Conversa/Lite](docs/design-system/lite/LITE_CHAT_DESIGN_SYSTEM.md). O registro do piloto no controle não avança o gate global UX-M1.10. Em conflito, reconciliar este inventário com essas fontes e o código; não alterar contratos para acomodar uma captura.

| Papel / superfície | Limite deste registro |
| --- | --- |
| Corretor Lite, cotador `/cotacao` | Extensão Conversa/Arc, liberação exclusiva do piloto pelo servidor. |
| Diretor com `feature_director_lite_style` | Exceção aprovada, com `[data-skin="diretor"]` e overrides próprios. Não recebe automaticamente os valores do frontmatter. |
| Diretor sem a flag, gestor e supervisor no modo normal | Seguem o sistema e a etapa aplicáveis; este documento não os migra. |
| Super-admin, painel do piloto | Usa `src/components/ui/*` na pele administrativa existente. Não recebe a pele do corretor por compartilhar a feature. |

Evidência: `src/features/global-catalog/pilot/{catalog-workspace,plan-explorer,admin-panel}.tsx`, `src/components/arc/`, `src/components/ui/{card,sheet,select}.tsx`, `src/app/{layout.tsx,globals.css}`. Capturas sintéticas de perfil, resultados, comparação, condições e rede, desktop/mobile: `C:/Users/kyper/.codex/outputs/cotadorfm-2026-11-11/ui-pilot/`. Elas usam Arial na prévia; produção carrega Plus Jakarta Sans pelo shell. Não tratá-las como prova da tipografia final, de dados reais ou de liberação em produção.

**Key Characteristics:**

- Próxima decisão legível antes do detalhe comercial.
- Superfícies claras, controles em pílula e cor com função explícita.
- Componentes compartilhados e tokens restritos ao escopo correto.
- Pendências e indisponibilidade expressas por texto, além de cor.

## Colors

Neutros frios sustentam a leitura; índigo identifica seleção e o azul do chat identifica ações conversacionais no repertório existente.

### Primary

- `accent`, `accent-strong` e `accent-subtle`: controles Arc e selo informativo. O badge de identificação do piloto é informativo, não um estado de elegibilidade.
- `chat-action` e `chat-action-text`: ação e links no kit de chat; não substituem o preenchimento neutro do botão Arc primário usado em “Buscar planos”. A convivência dos dois azuis já está documentada em Conversa/Lite.

### Neutral

- `background`: canvas Venancor quando consumido; `.light-canvas` usa `surface`, conforme a implementação atual.
- `surface` e `surface-muted`: cartões/camadas e apoio/hover.
- `foreground`, `text-secondary` e `text-muted`: leitura principal, apoio e metadados.
- `border`, `border-subtle` e `border-strong`: agrupamento, separação interna e campos.

`success`, `warning` e `danger` comunicam revisão concluída, revisão necessária e incompatibilidade, sempre acompanhadas de nomes e motivos. Não reinterpretar a cor como permissão de exportação. As regras de liberação pertencem ao servidor e à documentação de domínio.

**The Scope Rule.** Aplicar o conjunto de tokens somente na superfície que já possui o escopo Arc correspondente; nunca usar a paleta do corretor como redefinição global de papéis.

## Typography

**Display Font:** Plus Jakarta Sans, fornecida por `--font-jakarta-sans` no shell.
**Body Font:** a mesma família, com os fallbacks declarados no frontmatter.

O repertório Arc contém a escala xs/sm/base/lg/xl/2xl/3xl, em `.75/.875/1/1.125/1.375/1.75/2.25rem`. Corpo e controles usam regular e medium; números comerciais usam algarismos tabulares. Campos no celular recebem `16px` no override compartilhado até `767px`, preservando leitura e evitando zoom automático.

O cotador atual usa utilitários Tailwind `text-3xl font-semibold` no h1, `text-xl` no título dos resultados e `text-2xl` no preço total. Esses valores locais não redefinem `--text-3xl` do Arc nem instituem uma nova escala ou peso para as próximas telas. Títulos e descrições de Card/Sheet seguem seus componentes compartilhados e a pele ativa.

O título abre diretamente com a tarefa, sem overline. Metadados de operadora dentro do resultado identificam o produto; não são uma licença para adicionar rótulos decorativos acima de todo título.

## Layout

O shell e a navegação existentes determinam a moldura. No Lite, o Início e o retorno conduzem a navegação; a lista lateral de conversas aparece no computador a partir de `1024px`, com coluna de `360px`. Esse padrão não se aplica ao painel administrativo por associação com o cotador.

O workspace usa `max-w-6xl`, centralizado, com `gap-6`, `px-4` e `sm:px-6`. Perfil e resultados estão em sequência. Modalidade, município e vidas vêm primeiro; refinamentos ficam em disclosure nativo. Grupos de formulário passam a duas colunas em `sm`; resultados a duas em `lg`; a comparação usa até três colunas em `sm`, empilhadas abaixo disso. São composições da rota, não novos tokens de layout.

Sheets reutilizam `src/components/ui/sheet.tsx`: largura limitada à viewport, painel de comparação mais largo e condições/rede com largura menor; conteúdo interno rola. O componente compartilhado transforma sheets laterais em tela cheia até `559px`. O código atual define limites específicos de `64rem` para comparação e `48rem` para exploração, sem institucionalizá-los como tamanhos globais.

## Elevation & Depth

A implementação combina separadores suaves com sombras discretas existentes. Botões Arc primários/contornados podem usar a sombra resting no hover. O Card compartilhado padrão usado no cotador tem borda e `shadow-none`; ele não herda automaticamente a receita de cartão sem borda de outras superfícies Arc. Sheets usam a sombra de diálogo do componente compartilhado. Os valores extraídos ficam no sidecar, sem inventar um novo nível de elevação.

Movimento pertence aos componentes existentes: feedback de cor/foco e transições de sheets respeitam reduced motion. Esta extensão não criou uma gramática de animação, nem exige animar disclosures ou resultados.

## Shapes

Controles Arc são pílulas; painéis e superfícies têm cantos amplos com os tokens registrados. Card padrão usa o raio compartilhado de card, enquanto sheets usam o de panel. O textarea compartilhado usa cantos próprios para não recortar texto, em vez de forçar a silhueta de pílula. Preservar essas diferenças funcionais; não transformar o raio de uma rota em regra da plataforma inteira.

## Components

### Buttons

Arc Button fornece primary, secondary, ghost e danger. No cotador, o primário neutro executa a busca; secundários abrem condições, comparação e exportação quando permitida; ghost reduz o peso de ações auxiliares. Altura média e pequena no escopo Lite são `2.75rem`. O primário responde por opacidade, secondary/ghost por preenchimento suave; teclado mantém foco visível. Loading usa a API existente e mantém a intenção da ação identificável.

### Inputs / Fields

Arc Input fornece label, descrição/erro, borda forte e foco por mudança da borda, sem halo. O AppSelect compartilhado fornece seleção; não recriar um select local com outra altura ou pele. Label visível, teclado adequado para idade/orçamento e estados obrigatórios permanecem junto do campo. Não canonizar a prévia Arial como fonte do produto.

### Chips / Badges

Arc Badge usa texto compacto medium e forma de pílula. Info identifica o piloto; success/warning/danger nomeiam o estado do produto. O selo “Vinicios Ragazzi” permanece no cabeçalho do piloto; não é uma nova marca nem um requisito de todos os cabeçalhos.

### Cards / Containers

Card/CardHeader/CardContent compartilhados agrupam perfil e alternativas independentes. Cada resultado prioriza nome, atributos essenciais e total mensal; valores por vida e motivos ficam sob demanda. Não transformar todo par de dados de uma condição em um cartão.

### Navigation / Sheets

O cotador não adiciona uma navegação paralela ao Lite. Condições e rede são visões do mesmo produto dentro do Sheet, alternadas por botões com `aria-pressed`; comparação é uma camada contextual. Título, descrição, fechamento e retorno de foco pertencem ao componente de diálogo. O painel Super-admin mantém seus controles compartilhados próprios.

### Disclosure comercial

Resumo primeiro; idades/preço por vida, restrições, regras, atributos da fonte e dados da unidade são revelados no contexto. Vazio, carregamento, erro com tentativa novamente e ausência de resultados têm mensagens explícitas. Pendências precedem a formalização; a interface explica o bloqueio de PDF/envio sem fingir que a aparência do botão autoriza uma operação. O bloqueio efetivo é validado no servidor.

**The Next Decision Rule.** Mostrar primeiro o que permite escolher o próximo passo; revelar informação densa perto do plano, condição ou unidade a que pertence.

## Do's and Don'ts

### Do:

- **Do** reutilizar Arc Button/Input/Badge e Card/AppSelect/Sheet compartilhados com seus tokens e escopos existentes.
- **Do** apresentar preço total e valores por vida com números tabulares, estados nomeados e motivos consultáveis.
- **Do** manter leitura em tela estreita, foco de teclado, campos legíveis e reduced motion nos componentes existentes.
- **Do** consultar contrato, controle da etapa e a exceção do papel antes de estender uma superfície.

### Don't:

- **Don't** aplicar a pele do corretor ao gestor, Super-admin ou Diretor sem sua exceção aprovada.
- **Don't** inventar tokens, primitives, fontes, rampas cromáticas ou animações para preencher este inventário.
- **Don't** adicionar overline decorativo acima do título da tarefa ou usar cor como substituto do estado textual.
- **Don't** tratar dados sintéticos, Arial da fixture ou pesos locais da rota como novas decisões globais de identidade.
