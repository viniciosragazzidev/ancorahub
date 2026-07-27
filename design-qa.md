# Design QA - Dashboard `/diretor/resume`

## Referências comparadas

- **Fonte visual:** `C:/Users/kyper/AppData/Local/Temp/codex-clipboard-9a40fc47-9ade-47dd-a15a-8b8fbf729248.png`
- **Implementação:** `artifacts/design-qa/resume-dashboard-dark.png`
- **Viewport:** 1280 × 720, desktop, estado inicial.
- **Escopo:** a referência define o shell escuro, sidebar, header, tabs, cards, painéis
  analíticos e tabela. O conteúdo foi substituído pelos dados executivos demonstrativos
  do CorreTop.

## Histórico de comparação

1. **P1 - tema e tipografia divergentes.** A primeira captura usava a paleta clara e
   fallback serif do shadcn. Corrigido centralizando os tokens escuros em
   `src/app/globals.css`, ativando o tema no layout e declarando Geist como fonte raiz.
2. **P2 - alertas comprimidos junto à sidebar.** Corrigido com grade de duas colunas na
   largura intermediária e quatro colunas somente em telas extra largas.
3. **P2 - dashboard genérica duplicada.** O exemplo do `dashboard-01` foi removido
   depois da extração de seus primitivos. A rota CorreTop usa o mesmo shell shadcn sem
   manter uma segunda página de demonstração.

## Evidência funcional

- A tab `Conversões` recebe `aria-selected="true"` e move o indicador `t-tabs`.
- `Atualizar` mostra quatro instâncias do `ShimmerSkeleton` Unlumen antes de restaurar
  os indicadores.
- Busca por filial reduz as linhas da tabela.
- Console do navegador: nenhum erro.

## Superfícies de fidelidade

- **Tipografia:** Geist, títulos compactos, métricas com números tabulares e metadados
  discretos.
- **Layout e ritmo:** sidebar de largura fixa, header baixo, divisórias finas, cards
  compactos e grid de análise seguem a hierarquia da referência.
- **Cores e tokens:** canvas `#111111`, superfícies `#171717`, bordas `#2B2B2B` e
  ação primária clara. Azul fica reservado aos estados do CorreTop.
- **Ícones e assets:** Phosphor é a única família de ícones usada pela dashboard.
  Não há fotos, ilustrações ou logos raster necessários neste fluxo operacional.
- **Copy:** textos refletem SLA, documentos, integridade, conversão e metas, todos os
  valores estão marcados como demonstrativos.

## Follow-up polish

- [P3] Capturar novamente a visão mobile quando o controle de viewport do navegador
  estiver disponível para validar a abertura do sidebar off-canvas.
- [P3] Conectar os dados demonstrativos às queries escopadas por tenant após os módulos
  de domínio estarem disponíveis.

## Final result

passed

---

# Design QA - Central `/conversas`

## Referências comparadas

- **Fonte visual:** `C:/Users/kyper/AppData/Local/Temp/codex-clipboard-2b10a5bc-6ce5-4271-bf19-4d064e7735f7.png`.
- **Implementação:** captura renderizada no navegador in-app, aba `http://localhost:3000/conversas` (sessão de QA de 14/07/2026).
- **Viewport:** 1280 × 720, desktop, tema claro, usuário Diretor autenticado com um lead sintético.
- **Estado:** contato selecionado, sem mensagens persistidas e WhatsApp indisponível; perfil lateral removido nesse breakpoint para manter o chat legível.

## Evidência de comparação

- **Comparativo integral:** a fonte organiza inbox, lista de mensagens, conversa e perfil em camadas verticais claras. A implementação preserva essa hierarquia usando o shell CorreTop: navegação do produto, pastas da inbox, lista pesquisável e chat como região dominante.
- **Região focada:** o primeiro render em 1280px mantinha o perfil direito e comprimia o texto do chat para uma coluna estreita (**P1**). O grid foi ajustado para três painéis nesse viewport e quatro apenas em `2xl`; a captura posterior confirma cabeçalho, estado vazio, ações rápidas e compositor com largura suficiente.
- **Interações verificadas:** busca por conversa mostra o estado vazio; `Lista de planos` abre o painel de planos; navegação para lead/cotação é feita por links reais. O console da aba não registrou erros.

## Superfícies de fidelidade

- **Tipografia:** Geist e pesos compactos; nomes e cabeçalhos preservam hierarquia, com truncamento na lista em vez de sobreposição.
- **Ritmo e layout:** divisórias sutis, painéis verticais, campo de busca e compositor seguem a estrutura da referência; a adaptação do quarto painel impede perda de leitura com o sidebar global do CorreTop aberto.
- **Cores e tokens:** superfícies, bordas, seleção, foco, indisponibilidade e sucesso usam tokens do sistema; não há cores de marca locais ou números operacionais fictícios.
- **Imagens e ícones:** a referência usa avatares ilustrados, mas a implementação usa `Avatar` com iniciais porque o domínio não fornece foto do lead; Hugeicons são utilizados nos controles e possuem rótulos acessíveis.
- **Copy:** os textos descrevem o estado real do canal e deixam claro que o usuário deve revisar os modelos antes de enviar. "Enviar contrato" prepara texto, sem alegar assinatura ou envio externo inexistente.

## Histórico de comparação

1. **P1 - chat comprimido no desktop.** Evidência: a primeira captura em 1280px mostrou o quarto painel junto ao sidebar global, deixando o estado vazio e as mensagens quebrados em uma coluna estreita. **Correção:** perfil lateral agora somente a partir de `2xl`; em `lg`/`xl`, a central usa inbox, lista e chat.
2. **Pós-correção:** captura do navegador no mesmo viewport mostrou o chat ocupando a região principal, com estado vazio, ações e compositor legíveis. Nenhum P0, P1 ou P2 remanescente.

## Follow-up polish

- [P3] Quando o domínio passar a armazenar avatar do lead, substituir as iniciais por imagem privada e autorizada.
- [P3] Exibir perfil como sheet acionável também no breakpoint intermediário, caso o uso em telas de 1280px demande consulta recorrente de dados pessoais.

## Refinamento visual (14/07/2026)

- Hierarquia de textos ajustada: títulos operacionais em 14px/semibold, metadados em 12px e rótulos de grupos em 11px com espaçamento de leitura consistente.
- A conversa selecionada agora possui um marcador interno de estado, sem depender apenas da cor; prévias e datas usam limites e números tabulares para evitar sobreposição.
- O perfil lateral recebeu ritmo vertical, seções e pares rótulo/valor mais claros. O estado vazio também passou a orientar a primeira ação.
- O painel de planos usa a transição compartilhada `t-panel-slide`, com fallback para `prefers-reduced-motion`; a central não cria imagens de pessoas sem um ativo autorizado pelo domínio.
- Verificação: lint específico e build de produção concluídos sem erros.

## Ajuste de densidade e viewport (14/07/2026)

- A lista de conversas foi reduzida a uma linha de leitura: identidade, tempo, status compacto e prévia dividem a mesma faixa, sem empilhar um card alto.
- Mensagens deixaram de usar o tratamento de card pesado; balões diferenciam entrada e saída por alinhamento, raio e superfície, mantendo a leitura como prioridade.
- O perfil do cliente pode ser ocultado ou alternar entre largura compacta e ampla a partir de `2xl`. A área de chat recebe imediatamente o espaço liberado.
- A central usa altura de viewport e `ScrollArea` em navegação, lista, histórico e perfil; cabeçalho e compositor permanecem fixos.
- Limite de validação visual: a captura automática da sessão não disponibilizou uma aba controlável; a revisão foi feita por inspeção de implementação, lint e build.

## Final result

passed

---

# Design QA - Resumo `/corretor/resumo`

## Referências comparadas

- **Fonte visual:** o shell escuro de referência usado no dashboard CorreTop.
- **Implementação:** `artifacts/design-qa/corretor-resume-dark.png`.
- **Viewport:** 1280 × 720, desktop, estado inicial.
- **Escopo:** o mesmo sistema visual do painel executivo, adaptado para uma rotina pessoal
  de corretor: ação imediata, urgências, placar individual e fila de trabalho.

## Evidência funcional

- A navegação não expõe Equipe, Filiais, Integridade, Relatórios globais ou itens de tenant.
- O botão `SLA em risco` filtra a busca da fila e leva o foco visual para a tabela.
- `Atualizar` preserva o contorno da página com `ShimmerSkeleton` Unlumen.
- `Disponível para leads` alterna de forma explícita para `Recebimento pausado`.
- O documento e o elemento principal não possuem overflow horizontal no viewport desktop.

## Superfícies de fidelidade

- O cartão de próxima ação recebe a maior prioridade visual e comunica risco com texto e cor.
- Sidebar, header baixo, divisórias, cards, tabela e tipografia preservam a densidade do
  dashboard de referência sem repetir os indicadores de direção.
- Todos os controles usam componentes shadcn existentes; ícones seguem a família Phosphor.
- Valores estão identificados como demonstrativos até a integração com dados do domínio.

## Final result

passed
