# Conversas do Diretor na pele Arc

Data: 25/10/2026
Branch: `feat/diretor-lite-conversas`
Base: `origin/feat/diretor-visual-lite` com merge de `feat/diretor-lite-f2b` (`a1407038`).

## Escopo e estado

A rota mantém consultas, validacao de permissao, escopo, filtros, navegacao, mensagens, perfil e acoes existentes. A mudanca concentra-se em apresentacao e estrutura responsiva. O HTML de referência sem a chave foi registrado em snapshot e permanece igual.

Esta base nao possui `useDirectorLitePage`. Por isso `/conversas` continua no opt-out de producao, e o `ArcScopeProvider` desliga a pele nas rotas opt-out. A versao ativa foi validada somente em `/dev/diretor-shell-real?view=conversas`, com o AppShell real e fixtures de Diretor e Super-admin. A retirada do opt-out e a ativacao em producao ficam pendentes da integracao do gate compartilhado.

## O que mudou

- O painel ativo usa a mesma moldura do diretor, com cabecalho global, titulo alinhado, acoes e navegacao em uma faixa propria.
- A lista, a conversa e o perfil mantem as acoes existentes. No celular e tablet compacto ha uma coluna com retorno para lista; 1024px mostra duas colunas; a partir de 1280px mostra lista, conversa e perfil.
- Os estilos novos ficam sob `data-skin="diretor"`; seletores de cores antigas sao remapeados para semantica Arc. O caminho legado segue os seletores e atributos existentes.
- A acao de qualificacao em lote e apresentada no local correto quando a pele esta ativa e conserva o componente legado quando desligada.
- A pele dos portais segue o ArcScopeProvider do AppShell, condicionado a chave e ao opt-out.

## Evidencia visual

Capturas feitas em `/dev/diretor-shell-real?view=conversas`, com AppShell real, 40 conversas de fixture e chave ligada. Diretor comum e Super-admin vendo como Diretor, em 390, 1024 e 1440 px:

- `C:/Users/kyper/AppData/Local/Temp/claude/C--Users-kyper-brain/24b9384d-0a21-4b55-a4b1-9fff1a71d8e4/scratchpad/final-prints/conversas-diretor-390.png`
- `C:/Users/kyper/AppData/Local/Temp/claude/C--Users-kyper-brain/24b9384d-0a21-4b55-a4b1-9fff1a71d8e4/scratchpad/final-prints/conversas-diretor-1024.png`
- `C:/Users/kyper/AppData/Local/Temp/claude/C--Users-kyper-brain/24b9384d-0a21-4b55-a4b1-9fff1a71d8e4/scratchpad/final-prints/conversas-diretor-1440.png`
- `C:/Users/kyper/AppData/Local/Temp/claude/C--Users-kyper-brain/24b9384d-0a21-4b55-a4b1-9fff1a71d8e4/scratchpad/final-prints/conversas-super-admin-390.png`
- `C:/Users/kyper/AppData/Local/Temp/claude/C--Users-kyper-brain/24b9384d-0a21-4b55-a4b1-9fff1a71d8e4/scratchpad/final-prints/conversas-super-admin-1024.png`
- `C:/Users/kyper/AppData/Local/Temp/claude/C--Users-kyper-brain/24b9384d-0a21-4b55-a4b1-9fff1a71d8e4/scratchpad/final-prints/conversas-super-admin-1440.png`

Medições Playwright em `conversas-polish-medidas.json`: título e painel principal compartilham a borda esquerda (390: 16px; 1024 e 1440: 290,4px). A lista mede 300px em 1440px. Não há overflow horizontal da página; o filtro rola dentro da própria faixa em telas menores. `3 mensagens` não quebra, os dois placeholders cabem, “qualified” não aparece cru e “Ações” usa variante neutra. As seis capturas finais não registraram erros e foram abertas para revisão visual.

| Caso | 390 px | 1024 px | 1440 px |
| --- | --- | --- | --- |
| Diretor | 48.179 B | 137.791 B | 230.523 B |
| Super-admin vendo como Diretor | 48.179 B | 140.032 B | 231.337 B |

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

- Vitest focado: 3 arquivos, 16 testes aprovados (snapshot legado, rota opt-out, skin ativa, rótulos, placeholders, navegação/aba oficial e atalho de contato).
- `npx tsc --noEmit`: aprovado.
- ESLint nos arquivos TS/TSX tocados: 0 erros, 13 warnings em codigo legado de conversas.
- `node scripts/check-lite-skin.mjs`: relatorio global de 859 arquivos. As classes antigas da conversas permanecem no JSX por paridade do modo desligado e sao mapeadas por seletores da pele ativa; por isso o diagnostico de fonte nao resulta em zero nesta tela.
- Harness: `agent:docs` válido, segurança sem achados; arquitetura/desempenho apontam apenas os arquivos grandes já acima do limite na base (`conversations-workspace.tsx` 93 KB; `page.tsx` 54 KB). `agent:verify --level full` não foi executado porque inclui suíte global e `next build`, fora da validação focada desta etapa e com risco de renderizar a rota dinâmica de banco.
- Build nao executado: a rota real `/conversas` usa consultas dinamicas de banco durante renderizacao; respeitei o limite de nao executar testes de banco.
