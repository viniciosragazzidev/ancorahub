# CorreTop - Sistema de Design Operacional

> Versão 3.0. Tema base: light. Dark mode continua suportado pelos mesmos tokens.

Este documento é a fonte de verdade visual do CorreTop. Se algo estiver diferente daqui, o arquivo precisa ser atualizado antes de criar nova variação de UI.

## Direção visual

- Produto de operação para corretoras.
- Interface clara, técnica e confiável.
- Densidade alta, mas organizada por camadas.
- Azul CorreTop é o warning principal. Ele aparece com intenção, não em excesso.
- Status usam cores semânticas próprias. warning nunca deve representar status.

## Regras obrigatórias

1. Sempre usar componentes reutilizáveis de `src/components/ui/`.
2. Evitar estilos locais repetidos em componentes que fazem a mesma coisa.
3. Não criar botões, inputs, badges ou cards com tamanhos próprios sem justificativa.
4. Padronizar tipografia, espaçamento, raio e bordas usando tokens.
5. Não hardcodar cores de superfície em telas específicas.
6. Toda variação nova deve nascer no componente compartilhado, não na página.
7. Usar `transitions-dev` para motion curto e útil.
8. Respeitar `prefers-reduced-motion`.

## Estrutura de tema

O tema trabalha com as mesmas variáveis nos dois modos.

### Light mode

- Canvas claro.
- Cards e popovers levemente mais elevados que o fundo.
- Texto principal escuro, nunca preto puro.
- Borda visível, mas discreta.
- warning azul para ação principal, foco, seleção e links.

### Dark mode

- Mesmas relações de hierarquia.
- Mesmos nomes de token.
- Só os valores mudam.

## Tokens semânticos

### Superfícies

| Papel | Token | Uso |
|---|---|---|
| Base da página | `--background` | fundo principal |
| Card | `--card` | painéis e blocos |
| Elevado | `--popover` | menus, sheets, dialogs |
| Sidebar | `--sidebar` | shell lateral |
| Borda | `--border` | separação estrutural |
| Input | `--input` | campos e controles |

### Texto

| Papel | Token | Uso |
|---|---|---|
| Primário | `--foreground` | títulos e corpo principal |
| Secundário | `--muted-foreground` | metadados e suporte |
| Inverso | `--primary-foreground` | texto sobre warning |

### warning e semântica

| Papel | Token | Uso |
|---|---|---|
| warning principal | `--primary` | CTA, link ativo, foco |
| warning suave | `--warning` | hover e seleção leve |
| Sucesso | `--success` | confirmação, concluído |
| Atenção | `--warning` | pendência, alerta moderado |
| Erro | `--destructive` | falha, remoção, bloqueio |

### Sidebar

| Papel | Token | Uso |
|---|---|---|
| Texto | `--sidebar-foreground` | navegação e metadados |
| warning | `--sidebar-warning` | item ativo e hover |
| warning texto | `--sidebar-warning-foreground` | conteúdo sobre destaque |
| Borda | `--sidebar-border` | divisões e shell |
| Foco | `--sidebar-ring` | foco e seleção |

## Hierarquia visual

1. O mais importante precisa ser lido em menos de 2 segundos.
2. Título, subtítulo e ação principal devem ter contraste claro entre si.
3. Não usar o mesmo peso tipográfico para tudo.
4. Texto secundário nunca pode parecer desabilitado se ainda for informativo.
5. Um painel não deve competir com outro painel sem motivo.

## Tipografia

- Família principal: Geist.
- Títulos: 24 a 30 px para páginas, 16 px para cards.
- Texto de apoio: 12 a 14 px.
- Números importantes: usar `tabular-nums`.
- Evitar fontes extras fora do sistema.

## Espaçamento e forma

- Raio base: 8 px.
- Pads e gaps sempre repetidos por escala.
- Cards, inputs e botões devem seguir o mesmo vocabulário de tamanho.
- Nenhuma tela deve inventar um raio novo por conta própria.

## Motion

- Movimento deve reforçar estado, não decorar a UI.
- Use motion para transições de tabs, abertura de painel, loading e feedback.
- Evite animação em tabela, métricas e listas densas.
- Se houver animação, ela precisa respeitar redução de movimento.
- Transições entre rotas devem usar View Transitions curtas sobre snapshots, nunca duas rotas renderizadas simultaneamente.
- A camada global de motion precisa poder ser desligada pelo Super-admin; o desligamento e `prefers-reduced-motion` removem movimento sem bloquear navegação ou feedback textual.

## Componentes padrão

- Botões: `Button`
- Cartões: `Card`
- Status e etiquetas: `Badge`
- Campos: `Input`, `Select`, `Textarea`, `Checkbox`
- Estrutura lateral: `Sidebar`
- Overlays: `Sheet`, `Dialog`, `Tooltip`
- Tabelas: `Table`
- Feedback: `Toaster`

## Estados obrigatórios

Toda tela importante precisa prever:

- loading
- empty
- error
- hover
- focus
- disabled

## Regras de consistência

- Não misturar estilos locais com tokens para o mesmo tipo de componente.
- Não variar altura de botões iguais em telas diferentes.
- Não variar padding de cards sem uma razão de hierarquia.
- Não usar uma cor de marca diferente por módulo.
- Não introduzir sombra pesada sem necessidade.

## Checklist de aceite

- [ ] O tema light usa tokens semânticos e não hex solto na página.
- [ ] Dark mode continua funcional com os mesmos nomes de token.
- [ ] O sistema tem pelo menos 3 camadas de superfície.
- [ ] warning, status e navegação não se confundem visualmente.
- [ ] Componentes reutilizáveis cobrem o que é repetido.
- [ ] Motion é curto, útil e respeita redução de movimento.
- [ ] A tela continua legível em teclado e em contraste baixo.

## Observação para IA

Antes de criar qualquer tela nova:

1. Ler este arquivo.
2. Reusar os componentes existentes.
3. Conferir se a variação nova precisa entrar no componente compartilhado.
4. Manter o tema consistente com os tokens aqui definidos.

## Referência de dashboard

As referências Nexus orientam a composição do CorreTop, sem copiar marca ou nomes fictícios. O padrão é um shell lateral persistente, cabeçalho compacto com busca global, cards curtos na primeira linha, gráfico principal com leitura comparativa na segunda e tabela/alertas na terceira.

Use `--chart-1` a `--chart-5` para visualizações. No light mode, o canvas é cinza muito claro com cards brancos e bordas suaves; no dark mode, a hierarquia usa carvão, grafite e texto claro. Violeta, azul e teal são reservados para dados de gráfico, não para substituir os estados semânticos de sucesso, atenção e erro.

---

## Catálogo de Componentes e Variáveis CSS

Abaixo encontra-se a especificação de cada componente do design system, descrevendo suas variáveis, variantes de estilos de tamanho/cores e comportamentos de estado (`hover`, `focus`, `disabled` e `loading`).

### 1. `Button` (Botão)
Componente de ação primário e secundário.
- **Variáveis Relacionadas**:
  - Fundo principal: `var(--primary)` / Texto: `var(--primary-foreground)`
  - Hover: `opacity: 0.9` ou `var(--warning)`
  - Raio de Borda: `var(--radius)` (base: 8px)
- **Tamanhos e Variantes**:
  - `default`: Altura de 36px (`h-9`), padding horizontal de 16px (`px-4`).
  - `sm`: Altura de 32px (`h-8`), padding horizontal de 12px (`px-3`).
  - `lg`: Altura de 40px (`h-10`), padding horizontal de 32px (`px-8`).
  - `icon`: Quadrado de 36px (`h-9 w-9`).
- **Estados**:
  - `hover`: Transição suave (`transition-colors duration-150`).
  - `focus-visible`: Outline de 2px em `var(--ring)`.
  - `disabled`: `opacity: 0.5`, sem cursor ou ações.

### 2. `Card` (Cartão / Bloco Bento)
Usado para grids de dashboards e bento boxes.
- **Variáveis Relacionadas**:
  - Fundo: `var(--card)`
  - Texto: `var(--card-foreground)`
  - Borda: `var(--border)`
- **Estrutura interna**:
  - `CardHeader`: Padding de 24px (`p-6`), gap de 6px.
  - `CardTitle`: Fonte Geist, peso semi-bold (`font-semibold`), tracking reduzido (`tracking-tight`).
  - `CardContent`: Área de conteúdo principal com espaçamento de base flexível.

### 3. `Badge` (Etiqueta de Status)
Etiquetas para classificar status de leads, operadoras ou planos.
- **Variantes de Cores**:
  - `default`: Fundo `var(--primary)`, texto `var(--primary-foreground)`.
  - `secondary`: Fundo `var(--secondary)`, texto `var(--secondary-foreground)`.
  - `success`: Fundo verde translúcido, texto `--success`.
  - `warning`: Fundo amarelo translúcido, texto `--warning`.
  - `destructive`: Fundo vermelho translúcido, texto `--destructive` (`destructive-foreground`).
  - `outline`: Borda fina, fundo transparente.

### 4. `Input` / `Textarea` (Campos de Texto)
Campos de entrada estruturados para formulários.
- **Variáveis Relacionadas**:
  - Fundo: `var(--input)` ou transparente
  - Borda: `var(--border)`
  - Foco: `var(--ring)`
- **Estados**:
  - `hover`: Borda levemente realçada.
  - `focus`: Outline/sombra suave com cor de destaque `var(--primary)`.
  - `disabled`: Fundo opaco/cinza suave (`opacity: 0.5`), bloqueado para digitação.

### 5. `Table` (Tabela)
Usado para dados tabulares densos de leads, corretores ou sessões.
- **Estrutura de Bordas e Alinhamento**:
  - Borda inferior fina (`border-b`) separando linhas.
  - `TableHead`: Fonte Geist, peso `font-medium`, cor `var(--muted-foreground)` para menor distração.
  - `TableRow`: Animação hover suave de mudança de fundo (`hover:bg-muted/50`).

### 6. `Sidebar` (Menu de Navegação Lateral)
O elemento de navegação do AppShell e do SuperAdmin.
- **Variáveis de Estilo**:
  - Fundo: `var(--sidebar)`
  - Texto ativo: `var(--sidebar-warning-foreground)`
  - Item ativo: `var(--sidebar-warning)`
  - Borda: `var(--sidebar-border)`
- **Offset e Trilho (Rail)**:
  - Adota `rail` para se deslocar `4rem` em layouts dual-rail de múltiplos workspaces.

### 7. `Sheet` / `Dialog` (Painéis e Overlays)
Painéis laterais (slide-over) e modais para ações críticas.
- **Variáveis Relacionadas**:
  - Fundo elevado: `var(--popover)` ou `var(--background)`
  - Overlay de fundo: `var(--black-overlay)` ou opacidade preta.
- **Movimento**:
  - Suporte total a transições curtas (`duration-200`) e animações de entrada/saída suaves.
