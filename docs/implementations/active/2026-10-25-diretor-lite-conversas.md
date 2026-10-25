# Conversas do Diretor na pele Arc

Data: 25/10/2026
Branch: `feat/diretor-lite-conversas`
Base: `origin/feat/diretor-visual-lite` em 3e4325fe (rebase conclu?do).

## Escopo e estado

A rota mantém consultas, validacao de permissao, escopo, filtros, navegacao, mensagens, perfil e acoes existentes. A mudanca concentra-se em apresentacao e estrutura responsiva. O HTML de referência sem a chave foi registrado em snapshot e permanece igual.

A tela usa `useDirectorLitePage` nos pontos visuais Lite; com a chave ligada e a rota liberada, o gate controla a pele. `/conversas` saiu do opt-out. `/conversas/broker` e `/conversas/dashboard` continuam em opt-out. A validacao usa `/dev/diretor-shell-real?view=conversas`, com AppShell real e fixtures de Diretor e Super-admin.

## O que mudou

- O painel ativo usa a mesma moldura do diretor, com cabecalho global, titulo alinhado, acoes e navegacao em uma faixa propria.
- A lista, a conversa e o perfil mantem as acoes existentes. No celular e tablet compacto ha uma coluna com retorno para lista; 1024px mostra duas colunas; a partir de 1280px mostra lista, conversa e perfil.
- Os estilos novos ficam sob `data-skin="diretor"`; seletores de cores antigas sao remapeados para semantica Arc. O caminho legado segue os seletores e atributos existentes.
- A acao de qualificacao em lote e apresentada no local correto quando a pele esta ativa e conserva o componente legado quando desligada.
- A pele dos portais segue o ArcScopeProvider do AppShell, condicionado a chave e ao opt-out.

## Evidencia visual

Capturas finais do AppShell e do componente reais, em 390 e 1440 px, com fixtures de Diretor e Super-admin:

- `C:/Users/kyper/AppData/Local/Temp/claude/C--Users-kyper-brain/24b9384d-0a21-4b55-a4b1-9fff1a71d8e4/scratchpad/final-prints/conversas-diretor-390.png`
- `C:/Users/kyper/AppData/Local/Temp/claude/C--Users-kyper-brain/24b9384d-0a21-4b55-a4b1-9fff1a71d8e4/scratchpad/final-prints/conversas-diretor-1440.png`
- `C:/Users/kyper/AppData/Local/Temp/claude/C--Users-kyper-brain/24b9384d-0a21-4b55-a4b1-9fff1a71d8e4/scratchpad/final-prints/conversas-super-admin-390.png`
- `C:/Users/kyper/AppData/Local/Temp/claude/C--Users-kyper-brain/24b9384d-0a21-4b55-a4b1-9fff1a71d8e4/scratchpad/final-prints/conversas-super-admin-1440.png`

Medicoes Playwright em `conversas-final-medidas.json`: 40 linhas, nome longo truncado na lista larga, horario com flex-basis fixa e `nowrap`, `3 mensagens` em uma linha, topo e conteudo alinhados (390: 16 px; 1440: 290,4 px), sem overflow horizontal ou erros de navegador.
### Polimento pedido pelo Maestro

- O raio do item selecionado e dos grupos do perfil usa cantos de controle/painel, removendo o aspecto de pílula.
- Rótulos de qualificação usam “Qualificado”; contagem e texto ficam em uma linha, e busca/compositor usam placeholders curtos.
- A ação “Ações” fica neutra; tags ficam no cabeçalho da conversa e a indicação “Sem tags” não aparece vazia.
- Filtros e ações compartilham uma faixa única; os dados de demonstração têm 40 conversas, nomes longos e textos de mensagem extensos.
## Checklist Arc, linha por linha

### Varreduras automatizadas

- [x] Varredura de em dash no texto novo: nenhum. Mensagens e texto do CRM legado mantidos.
- [x] Varredura de uppercase/eyebrow: nenhum rotulo editorial novo; classes antigas permanecem no caminho legado e sao normalizadas na pele ativa.
- [x] Foco e outline: estilos novos nao removem o `:focus-visible` compartilhado; controles usam foco Arc.
- [x] Cores cruas: nenhuma cor crua adicionada; CSS ativo remapeia classes semanticas antigas. O scanner acusa classes Tailwind antigas ainda presentes no JSX para preservar paridade da chave desligada.
- [x] Peso e gradiente: nenhum gradiente ou peso fora da escala adicionado; a pele normaliza pesos para tokens.
- [x] Largura de viewport: nenhuma regra `100vw` nova.
- [x] Typecheck e lint: typecheck sem erros; ESLint sem erros, com 13 warnings preexistentes em `conversations-workspace.tsx`.

### Tipo e texto

- [x] Sentence case e sem transformacao uppercase na pele ativa.
- [x] Sem eyebrow, overline ou kicker novos.
- [x] Sem em dash novo; titulos sem ponto final.
- [x] Tipografia mapeada aos tokens Arc; pesos ativos 400/500, com 600 reservado a numero de destaque quando existente.
- [x] Acoes existentes e nomes de controles mantidos para preservar comportamento; controles icon-only conservam `aria-label` especifico.
- [x] Contagens e numeros de mensagens usam numerais tabulares na pele ativa.

### Cor e superficies

- [x] Superficie e texto usam tokens semanticos Arc; classes de cor legadas nao foram apagadas do HTML inativo.
- [x] Indigo destaca selecao e acao principal; cores de status conservam rotulos textuais.
- [x] WhatsApp conserva sua cor de marca real.
- [x] Sem gradientes, brilhos ou sombras decorativas novos; paineis ficam em borda sutil.
- [x] Sem card decorativo aninhado novo; perfil e conversa mantem superficies funcionais.

### Layout

- [x] Uma moldura de pagina, sem segundo gutter.
- [x] Titulo e primeiro bloco alinhados: esquerda medida igual em cada uma das larguras; valores listados acima.
- [x] Colunas irmas ocupam altura comum e tem separacao visivel.
- [x] Raios de superfícies usam tokens existentes; sem raio arbitrario novo.
- [x] Grade de 4px e espacamento de 16/24px aplicados nos grupos principais.
- [x] A lista e o historico rolam dentro dos paineis; a pagina nao rola lateralmente.
- [x] 390px usa margem 16px; filtros rolam dentro da faixa; rotulos compactos nao ampliam a pagina.

### Componentes e estados

- [x] Reuso de Arc e primitivas existentes; sem token, primitive ou variante nova.
- [x] Navegacao entre Leads e numero oficial continua link; filtros seguem controles de selecao; acoes mantem dialogs/menus existentes.
- [x] Sem alteracao de internals de componentes compartilhados.
- [x] Nenhum codigo Pro foi reconstruido.
- [x] Uma acao primaria por contexto; qualificacao em lote fica na barra de acoes.
- [x] Estados de carregamento, vazio, erro, sucesso e desabilitado pertencem aos fluxos existentes; fixture valida conteudo carregado. A pele da pagina de erro/loading permanece opt-out.
- [x] Nomes longos seguem limites de truncamento existentes com acesso pelo perfil completo.

### Movimento e React

- [x] Nenhuma nova animacao JS na pele ativa; transicoes visuais usam tokens Arc existentes.
- [x] Sem loop, overshoot ou movimento continuo novo.
- [x] `prefers-reduced-motion` e `html[data-reduce-motion="1"]` desativam as transicoes novas.
- [x] HTML inicial nao depende de `window`, storage, tempo corrente ou aleatoriedade.
- [x] Chaves e estado dos componentes nao foram alterados para animar; sem valores dinamicos que causem salto de largura.

### Acessibilidade e responsividade

- [x] Foco visivel com anel compartilhado Arc; sem foco artificial em clique.
- [x] Links, botoes, labels, headings e landmarks existentes mantidos.
- [x] Botoes somente com icone mantem nomes acessiveis.
- [x] Dialogs/drawers continuam usando primitives compartilhadas para trap/retorno de foco e Escape.
- [x] Status permanece acompanhado de texto, e status async existentes seguem anunciados.
- [x] Alvos tocaveis da pele tem pelo menos 44px; controles estreitos sao ocultos ou transferidos ao menu de acoes em telas compactas.
- [x] 390, 1024 e 1440 foram verificados em Diretor e Super-admin. Sem scroll lateral; hover nao e necessario para abrir as acoes.
- [ ] Tema escuro nao validado: a decisao D2 força tema claro para o Diretor com a chave ligada; superfícies neutras e acento indigo foram verificados no tema ativo.

## Validacao

- Vitest focado: 3 arquivos, 17 testes aprovados (snapshot legado, rota opt-out, skin ativa, rótulos, placeholders, navegação/aba oficial e atalho de contato).
- `npx tsc --noEmit`: aprovado.
- ESLint nos arquivos TS/TSX tocados: 0 erros, 31 warnings em codigo legado de conversas.
- `node scripts/check-lite-skin.mjs`: relatorio global de 859 arquivos. As classes antigas da conversas permanecem no JSX por paridade do modo desligado e sao mapeadas por seletores da pele ativa; por isso o diagnostico de fonte nao resulta em zero nesta tela.
- Harness: `agent:docs` válido, segurança sem achados; arquitetura/desempenho apontam apenas os arquivos grandes já acima do limite na base (`conversations-workspace.tsx` 93 KB; `page.tsx` 54 KB). `agent:verify --level full` não foi executado porque inclui suíte global e `next build`, fora da validação focada desta etapa e com risco de renderizar a rota dinâmica de banco.
- Build nao executado: a rota real `/conversas` usa consultas dinamicas de banco durante renderizacao; respeitei o limite de nao executar testes de banco.

### Fechamento do gate e fronteira servidor/cliente

- `/conversas` foi removida do opt-out e o teste confirma o gate, mantendo `/conversas/broker` e `/conversas/dashboard` opt-out. Todos os pontos visuais Lite consultam `useDirectorLitePage`.
- `ConversationsFrame` recebe somente dados e flags serializaveis; cabecalho, acoes e workspaces sao criados dentro do componente cliente. A varredura nao encontrou `cloneElement`.
- A coluna de horario tem largura e flex-basis fixas, `nowrap` e numerais tabulares; o nome usa truncamento.
