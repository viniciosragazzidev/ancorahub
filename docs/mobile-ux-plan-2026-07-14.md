# Plano de refinamento mobile do CorreTop

## Objetivo

Criar uma experiência mobile de nível nativo para larguras abaixo de `560px`, sem
alterar composição, densidade ou comportamento visual do desktop (`min-width:
560px`). O foco é reduzir rolagem desnecessária, eliminar quebras de cards e
tabelas, facilitar ações de atendimento e preservar a linguagem do `DESIGN.md`.

Este documento é um plano de design e engenharia baseado em inspeção heurística do
código atual e na auditoria UX existente. Ainda não representa teste observado com
usuários reais; os pontos de maior risco devem ser validados com corretores,
gestores e diretores em um dispositivo real.

## Princípios de aceite

1. O desktop permanece visualmente inalterado: nenhuma regra base existente deve
   ser substituída para resolver um problema exclusivo de mobile.
2. Toda adaptação exclusiva deve estar em variantes compartilhadas ou em regras
   limitadas a `@media (max-width: 559px)`.
3. A primeira tela de cada rota deve revelar em até dois segundos: onde estou, o que
   importa agora e qual é a próxima ação.
4. Ações primárias devem permanecer alcançáveis com uma mão, com alvos de toque de
   pelo menos `44px` e foco visível.
5. Nenhum dado pode desaparecer por causa de truncamento. Conteúdo secundário pode
   ser colapsado, reordenado ou aberto em sheet.
6. Motion comunica estado e hierarquia; nunca deve atrasar uma ação ou ser a única
   forma de explicar resultado. Respeitar `prefers-reduced-motion`.
7. Usar os tokens e componentes existentes de `src/components/ui/` e
   `src/components/unlumen-ui/`; evoluções devem nascer no componente compartilhado.

## Diagnóstico inicial

### Riscos observados

- Shell lateral e cabeçalho consomem espaço horizontal que deveria ser reservado ao
  conteúdo operacional.
- Dashboards usam grids e blocos densos que precisam virar uma fila vertical de
  decisões, não uma miniatura do desktop.
- Tabelas de leads, vendas, documentos e comissões não são adequadas para leitura
  celular quando todas as colunas permanecem visíveis.
- Drawers e sheets precisam de altura, rodapé e rolagem próprios; o conteúdo não
  deve criar uma segunda rolagem difícil de controlar.
- Filtros e ações secundárias ocupam a primeira dobra em telas estreitas.
- Detalhes de lead, conversa e cotação acumulam timeline, perfil e ações no mesmo
  fluxo, causando scroll excessivo para alcançar a decisão seguinte.
- Há motion e transições espalhados por páginas; o comportamento deve ser
  consolidado em padrões curtos e com redução de movimento.

### Personas e tarefas prioritárias

| Papel | Tarefa mobile crítica | Resultado esperado |
|---|---|---|
| Corretor | Abrir a fila, iniciar contato e atualizar o lead | A próxima ação aparece fixa ou próxima do contexto, sem procurar no fim da página |
| Gestor | Identificar urgências e abrir o lead certo | Filtros e alertas ocupam pouco espaço e preservam a filial |
| Diretor | Configurar equipe, marca, comissões e metas | Formulários são divididos em etapas curtas e salvam com feedback claro |
| Todos | Conversar, consultar documentos e responder notificações | Ações de toque têm feedback imediato e retornam ao ponto anterior |

## Arquitetura mobile proposta

### 1. Shell e navegação

- Transformar a sidebar em navegação mobile inferior ou sheet de navegação, sem
  renderizar o trilho lateral persistente abaixo de `560px`.
- Manter no máximo quatro destinos primários no bottom bar: fila/atendimento,
  conversas, tarefas e mais. O quinto destino deve abrir o agrupamento secundário.
- Exibir papel, corretora e conta no menu “Mais”, preservando logout e troca de
  tema sem ocupar a navegação principal.
- Usar `safe-area-inset-bottom` e `safe-area-inset-top` para dispositivos com área
  de gesto/notch.
- Preservar a rota atual, o estado de filtros e o contexto do lead ao abrir/fechar
  a navegação.
- Não exibir badges estáticos; qualquer contador deve vir de consulta real e
  escopada.

### 2. Cabeçalho contextual

- Em mobile, usar uma barra compacta com voltar, título curto, ação principal e
  menu de contexto.
- Remover breadcrumb longo da primeira dobra; converter em título e subtítulo
  acessível ou em um botão de contexto.
- Fazer a busca global ocupar uma tela/sheet própria, com escopo explícito, em vez
  de comprimir o cabeçalho.
- Deixar ações críticas visíveis; mover exportação, compartilhamento e ações raras
  para menu, sem remover sua consequência.

### 3. Ações e interação com uma mão

- Criar uma variante compartilhada de `MobileActionBar` para ações persistentes de
  lead, cotação, venda e tarefa.
- A barra deve ser fixa acima da navegação inferior apenas quando existir uma ação
  contextual clara; caso contrário, não ocupar espaço permanente.
- Usar `Button` e `Sheet` existentes, com variantes mobile documentadas, sem criar
  botões locais.
- Após salvar, mostrar feedback inline/toast e manter o usuário no contexto. Em
  erro, preservar dados digitados e oferecer retry.

## Refinamento por componente

### Cards

- Abaixo de `560px`, cards de métrica viram uma lista horizontal com snap apenas
  quando houver mais de três métricas; cada card deve manter label e valor juntos.
- Cards operacionais viram blocos de uma coluna, com título, estado e CTA na mesma
  área visível.
- Reduzir padding somente pela variante mobile do `Card`, sem alterar o token
  desktop; manter raio, borda e superfícies do `DESIGN.md`.
- Evitar cards dentro de cards. Conteúdo secundário deve virar linha expansível ou
  sheet.

### Tabelas

- Criar um padrão compartilhado `ResponsiveDataList` para transformar linhas em
  cards/listas sem duplicar regra de dados.
- Desktop continua usando `Table`; mobile mostra identidade, status, dado-chave e
  próxima ação na primeira camada.
- Demais campos aparecem em disclosure/sheet ao tocar na linha.
- Manter ordenação, filtros, seleção e ações equivalentes às do desktop.
- Não usar scroll horizontal como solução padrão; reservar overflow horizontal para
  comparações realmente tabulares e indicar que há conteúdo adicional.

### Drawers e sheets

- Até `559px`, sheets laterais devem virar bottom sheets com largura total, altura
  máxima controlada e conteúdo rolável isoladamente.
- Cabeçalho e rodapé ficam fixos dentro do sheet; somente o corpo rola.
- Usar handle visual, título curto, descrição e ação de fechar acessível.
- Teclado virtual não pode esconder o campo ativo ou o botão de salvar.
- Fechamento por gesto deve respeitar estado sujo: confirmar somente quando houver
  risco real de perda.
- Padronizar entrada/saída com motion curto, easing do sistema e fallback sem
  animação para `prefers-reduced-motion`.

### Formulários

- Uma coluna, labels persistentes e campos agrupados por decisão.
- Usar teclado HTML correto (`tel`, `email`, `numeric`, `date`) e `autocomplete`
  quando aplicável.
- Validar inline sem deslocar o foco de forma inesperada.
- Dividir formulários longos em seções colapsáveis; a ação de salvar deve ficar
  acessível sem rolar até o final de um formulário enorme.
- Evitar selects nativos longos; usar `Select`/`Sheet` com busca quando a lista for
  grande.

### Feedback, estados e loading

- Criar padrões compartilhados para loading de página, loading de ação, vazio, erro,
  permissão negada e indisponibilidade.
- Skeleton mobile deve refletir a composição real e não animar listas densas em
  excesso.
- Toasts devem respeitar a navegação inferior e a área segura do dispositivo.
- Avisos compactos devem reutilizar `ContextNote`, com ícone HugeIcons sem depender
  apenas de cor.

## Fluxos prioritários

### Fase 1 — Fundação sem alterar desktop

1. Criar tokens/variáveis de viewport segura, altura de navegação mobile e z-index
   compartilhados.
2. Implementar shell mobile, bottom navigation, cabeçalho contextual e scroll
   principal único.
3. Evoluir `Sidebar`, `Sheet`, `Drawer`, `Button`, `Card` e `Table` com variantes
   mobile documentadas.
4. Adicionar testes de viewport em `360x800`, `390x844`, `412x915` e `559px`.

### Fase 2 — Atendimento do corretor

1. `/leads`: filtros em sheet, linha/card resumido, ação de contato e próxima ação
   visível.
2. `/leads/[id]`: reorganizar para resumo → ação principal → status → timeline →
   documentos/cotações; ações críticas em `MobileActionBar`.
3. `/conversas`: lista compacta, busca em sheet, composer com área segura e perfil
   do lead em sheet, sem três colunas simultâneas.
4. `/tarefas`: prioridade, vencimento e lead na primeira camada; concluir/reabrir
   sem abrir uma tela secundária.

### Fase 3 — Fechamento comercial

1. `/cotacoes` e `/cotacoes/[id]`: resumo financeiro fixo, planos em lista tocável,
   documentos e compartilhamento em ações secundárias.
2. `/vendas` e `/vendas/[id]`: transformar tabelas em lista de vendas e cronograma
   de comissão em parcelas expansíveis.
3. `/documentos`: fila por status, upload em sheet e revisão em fluxo de uma mão.

### Fase 4 — Gestão e configuração

1. `/dashboard`, `/gestor`, `/corretor/resumo` e `/diretor/resume`: transformar grids
   em “o que exige atenção agora”, métricas resumidas e listas acionáveis.
2. `/equipe` e `/filiais`: listas com ação contextual por item e formulários em
   etapas curtas.
3. `/settings`: tabs horizontais substituídas por lista de seções ou sheet de
   navegação; manter URL/estado selecionado.
4. `/configuracoes/comissoes`, `/metas` e `/minha-meta`: formulários e resultados
   adaptados para toque, com resumo persistente e confirmação de ações sensíveis.
5. `/notificacoes`: agrupamento por urgência, ação de marcar como lida e retorno à
   origem em uma única interação.

## Motion e sensação de app nativo

- Usar transições curtas para troca de sheet, expansão de linha, mudança de filtro,
  feedback de salvar e atualização otimista.
- Preferir transformação/opacidade, evitando animar largura, altura ou sombras de
  listas grandes.
- Usar `will-change` somente durante a interação e remover após a transição.
- Não animar tabelas, métricas financeiras ou dados sensíveis em cascata.
- Aplicar feedback imediato de toque (`:active`) e estados confirmados/error,
  respeitando o guard de redução de movimento.
- Evitar gestos essenciais sem alternativa acessível: swipe para fechar deve ter
  botão fechar e Escape quando houver teclado.

## Desempenho e estabilidade

- Garantir um único scroll vertical principal por tela mobile.
- Evitar renderizar painéis ocultos pesados; carregar conteúdo de sheets sob demanda
  quando o fluxo permitir.
- Virtualizar listas extensas somente após medir o problema; primeiro reduzir DOM,
  imagens e consultas duplicadas.
- Usar imagens responsivas, dimensões reservadas e lazy loading para evitar layout
  shift.
- Debounce na busca e filtros; preservar contexto na URL quando o retorno for
  importante.
- Evitar hidratação de componentes interativos onde Server Components forem
  suficientes.
- Medir Core Web Vitals mobile e tamanho de JS por rota antes/depois.

## Acessibilidade e qualidade

- Testar navegação por teclado, leitor de tela, zoom de 200%, contraste, foco e
  `prefers-reduced-motion`.
- Garantir que sheets tenham `aria-labelledby`, foco inicial coerente e retorno do
  foco ao gatilho.
- Não comunicar estado apenas por cor; usar texto, ícone e semântica.
- Testar toque em áreas de 44px, orientação retrato e teclado virtual.
- Validar dark mode com os mesmos tokens.
- Executar testes visuais por rota nos breakpoints `359px`, `360px`, `390px`, `412px`
  e `559px`, além de uma amostra desktop para detectar regressão.
- Fazer teste de tarefa com pelo menos um cenário por papel: iniciar atendimento,
  reatribuir lead, criar cotação, revisar documento, configurar comissão e consultar
  meta.

## Critérios de pronto

- Nenhum card, botão, tabela, drawer ou formulário quebra entre `320px` e `559px`.
- Nenhuma tela prioritária exige scroll horizontal para a tarefa principal.
- A ação principal fica acessível na primeira dobra ou em barra contextual fixa.
- A navegação mobile não cobre conteúdo e respeita a área segura do dispositivo.
- O desktop em `1024px`, `1280px` e `1440px` mantém screenshot e comportamento
  equivalentes ao baseline anterior.
- Lint, type-check, build de produção e testes de viewport passam.
- A auditoria final diferencia correções observadas de hipóteses ainda não validadas
  com usuários.

## Ordem recomendada de execução

1. Shell, navegação, scroll e sheets.
2. Componentes compartilhados de card, tabela/lista, action bar e estados.
3. Lead, conversas e tarefas.
4. Cotações, vendas e documentos.
5. Dashboards, configurações, comissões, metas e notificações.
6. Performance, acessibilidade, testes visuais e regressão desktop.

Cada fase deve terminar com atualização do roadmap, evidência visual nos breakpoints
mobile e desktop, validação de acessibilidade e `npm run build`.
