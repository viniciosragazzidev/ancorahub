# Correcoes da revisao F2b do Diretor Lite

Status: concluidas na branch `feat/diretor-lite-f2b`, baseada em `origin/feat/diretor-visual-lite` (`4af57b0c`).

## Ajustes

- Regras de `director-chrome.css` alcancam os casos em que o elemento com `arc-venancor[data-skin="diretor"]` tambem e a raiz do header, estados de rota, paleta, drawers e prompt PWA.
- O dialogo de atalhos combina as classes do escopo Arc com suas classes de layout.
- `AppShell` memoiza `shellUser`; a sidebar sincroniza o perfil somente quando o escopo Diretor esta ativo.
- Navegacao, paleta e `/api/search` compartilham regras de visibilidade. O servidor filtra funcionalidades por papel e permissao.
- A paleta indica carregamento desde a entrada da busca, durante o debounce.

## Validacao

- Vitest focado: 7 arquivos, 17 testes aprovados.
- `npx tsc --noEmit -p .`: aprovado.
- ESLint dos arquivos tocados: 0 erros; 12 avisos existentes de conteudo, imagem e acesso a ref.
- `agent:docs`, `agent:changed`, `agent:architecture` e `agent:security`: aprovados; arquitetura e seguranca sem achados. `agent:performance` manteve 1 alerta conhecido para o componente cliente extenso `corretop-sidebar.tsx`.
- `node scripts/check-lite-skin.mjs`: executado em modo relatorio; desvios listados pertencem ao baseline fora dos arquivos convertidos.
- Validacao focada, sem build nem suite completa.

## Refinamento de espacamento e revisao Arc (25/10)

- O /dashboard usa um container unico de 1328px, centralizado, com padding lateral de 16 a 32px e respiro inferior de 96px. O titulo Painel fica no DashboardHeader; a saudacao aparece uma vez como subtitulo.
- No painel, as regioes usam 24px entre si; controles usam 8 e 16px; cards usam borda de 1px e raio de superficie, com 24px de padding no desktop e 16px no celular. Itens de plantao sao linhas com divisorias, em colunas de no minimo 280px e intervalo de 16px.
- Os botoes de ajuda alinham com o topo do titulo. O menu e a barra superior usam os ritmos Arc, e o logo clicavel agora tem alvo de 44px.
- O topo real mede 64px. Medicao da rota /dev/diretor-shell-real: titulo, primeiro card e tabela alinham na borda esquerda em 390, 768, 1024 e 1440. Gap entre regioes: 24px. A pagina nao tem overflow horizontal; a tabela rola dentro do card em 768 e 1024.
- Capturas reais com fixtures em scratchpad/f2-prints/: diretor-comum e super-admin em 390, 768, 1024 e 1440; inclui o menu mobile aberto do super-admin. As capturas foram abertas e inspecionadas.

### Checklist Arc, linha a linha

#### Tipo e texto

- [x] Sentence case, sem transformacao para caixa alta no skin Diretor.
- [x] Sem eyebrow ou overline; rotulos do menu sao titulos de secao de navegacao.
- [x] Sem travessao longo; titulos nao terminam com ponto.
- [x] O shell e o painel usam pesos 400/500 e escala tipografica Arc. Numeros de destaque usam tabular-nums.
- [x] Acoes tem nomes acessiveis e deixam claro o destino; nao ha mensagem de erro nova neste painel.
- [x] Numeros alinhados usam tabular-nums.

#### Cores e superficies

- [x] O skin usa tokens semanticos. A cor da marca vem da brandColor do tenant via token do shell.
- [x] Acento aparece em item ativo, selecao, progresso e dado destacado.
- [x] Cores de status representam estado real e vem acompanhadas pelo texto do bloco e pelos rotulos dos dados.
- [x] Sem gradiente decorativo, brilho ou sombra colorida no skin.
- [x] A marca exibida e da propria aplicacao, sem logo de terceiro.
- [x] Cards descansam em borda de 1px sem sombra; superficies flutuantes usam tokens Arc. Nao ha cards decorativos aninhados.
- [x] Icones em controles sao funcionais e nomeados, nao decoracao dentro de tiles.

#### Layout

- [x] Um container de pagina, sem gutter duplicado.
- [x] Titulo, cards e tabela compartilham a borda esquerda, confirmado por getBoundingClientRect.
- [x] Itens irmaos de plantao preenchem colunas iguais; secoes da pagina usam gap real de 24px.
- [x] Nao ha card interno com raio concorrente; itens usam divisoria.
- [x] Ritmo de 4px: 8px entre rotulo e valor, 16px nos grupos e 24px entre regioes; padding de pagina 16 a 32px.
- [x] Tabela larga rola dentro do card, sem rolagem horizontal da pagina.

#### Componentes

- [x] AppShell, DashboardHeader, LightAppHeader, componentes Arc de overlay e tokens de movimento existentes foram reutilizados.
- [x] Abas e periodo usam links e botoes semanticos porque preservam filtros na URL e rotulos curtos no celular.
- [x] Sem restyle de internals de componente; a compatibilidade fica no skin escopado.
- [x] O painel nao adiciona botao primario concorrente.
- [x] Sem fonte Pro reconstruida.

#### Estados

- [x] Estado vazio dos tres blocos continua renderizado e testado; a rota real usa fixtures com dados para a captura.
- [x] Loading e erro continuam nos estados de rota existentes; nao foi criado estado assincrono novo no painel.
- [x] Sucesso fica no lugar; controles indisponiveis sao omitidos quando nao ha escopo autorizado.
- [x] Valores longos truncam com o nome completo acessivel no item de plantao.

#### Movimento

- [x] Entradas usam os tokens de movimento do Arc.
- [x] Os blocos entram somente com opacidade, sem deslocar o layout.
- [x] Sem overshoot ou movimento continuo novo; saidas seguem o token existente.
- [x] Movimento reduzido e a preferencia data-reduce-motion continuam cobertos nos testes.

#### React e SSR

- [x] A renderizacao inicial nao acessa window, localStorage, Date.now ou Math.random; data usa timezone fixo de Sao Paulo.
- [x] Listas usam chaves estaveis.
- [x] Numeros mantem tabular-nums; a animacao nao muda o layout.

#### Acessibilidade

- [x] Foco de teclado usa os tokens do anel Arc; nao ha foco visivel em clique de ponteiro.
- [x] Botoes, links, labels, titulos e landmarks sao semanticos.
- [x] Controles de icone tem nome especifico; o menu do super-admin oferece linhas de 44px.
- [x] Dialogos e drawers reutilizados cuidam de foco, Escape e retorno ao gatilho.
- [x] Estado nao depende apenas da cor; o painel anuncia seu contexto por texto e rotulos.

#### Responsividade

- [x] Conferido em 390, 768, 1024 e 1440; largura de pagina nao excede a area visivel.
- [x] Alvos tocaveis medem pelo menos 44px; o logo foi ajustado de 38 para 44px.
- [x] Hover tem equivalente por foco ou toque.
- [x] Tema escuro fica intencionalmente desativado quando a chave do diretor esta ligada, conforme decisao D2. As fixtures usam a marca padrao; em producao o token recebe a cor do tenant.

### Validacao desta rodada

- Vitest focado: 5 arquivos, 28 testes aprovados.
- `npx tsc --noEmit -p .`: aprovado.
- ESLint: 0 erros; 1 aviso pre-existente de `<img>` em `corretop-sidebar.tsx:270`. Os arquivos CSS nao tem configuracao ESLint.
- A suite completa e o build nao foram executados; esta rodada foi validada com testes focados e type-check.
