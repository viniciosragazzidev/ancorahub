# Auditoria de design do Calen e comparação com o Corretor Lite

Data: 2026-11-13. Estado: pesquisa concluída no escopo abaixo; recomendações propostas, sem implementação de UI.

Plano derivado: [Fase 2 do Corretor](./2026-11-13-corretor-redesign-plan.md).

## Conclusão

O aprendizado mais útil do Calen é tornar uma situação complexa legível por uma sequência estável: resumo, objeto de trabalho, detalhe contextual e próximo passo. A cor de destaque aparece em lugares previsíveis; a demonstração ensina uma função por vez. A página comercial e o aplicativo têm densidades e botões diferentes.

O AncoraHub já possui tokens, componentes compartilhados, próxima ação, onboarding, foco de teclado e movimento reduzido. A fase 2 deve melhorar a aplicação consistente dessa base e a hierarquia das tarefas do corretor. A comparação não justifica trocar a marca, a fonte ou o modelo de conversas existente.

## Escopo, método e limites

- Referência: [LP do Calen](https://usecalen.com.br/), [preços](https://usecalen.com.br/precos), [acesso](https://app.usecalen.com.br/login), imagem pública do produto e sete etapas do tutorial dentro da sessão disponibilizada no navegador integrado.
- Coleta: screenshots, árvore acessível, estilos computados e propriedades CSS expostas pelo documento. A navegação pelo botão de avanço do tutorial foi observada de fato, até a saída para a apresentação do curso.
- Não houve criação de conta pelo agente, conexão bancária, contratação, cadastro financeiro, envio de mensagem ou alteração de dados de negócio. Os valores ilustrados pelo tutorial não são uma base financeira coletada.
- Não foi recuperado um arquivo Figma, biblioteca privada ou código-fonte do Calen. Este inventário descreve o sistema visual observável. Estados privados e fluxos não percorridos continuam desconhecidos.
- A comparação do AncoraHub é documental e por código. Não foi executada nesta tarefa uma nova matriz autenticada do nosso produto. Achados de composição e usabilidade sem teste observado são hipóteses, explicitamente marcadas.
- Baseline principal: `46892e7c5200394dcd08c6108ee3a095c4d45b3b`, com alterações locais preexistentes preservadas. Complemento ERP: worktree `ancorahub-erp`, commit `148d98188f88d338664e028d899255a5b4dc59f5`. Código presente em worktree não comprova publicação.

As primeiras tentativas de interação na LP produziram marcadores de anotação do navegador. Esses marcadores não pertencem ao Calen e não são defeitos do site. Menu mobile, alternância de cobrança, hover, foco e erros de formulário não receberam validação interacional conclusiva. A navegação posterior pelo tutorial funcionou normalmente.

## Evidências e saúde da coleta

Arquivos aceitos em [evidence/calen-2026-11-13](./evidence/calen-2026-11-13/). “Observado” significa que a composição foi vista; não equivale a aprovação de acessibilidade ou de todas as funções.

| Passo | Superfície | Resultado da coleta | Evidência |
|---|---|---|---|
| E01 | Hero desktop, 1090 × 667 | Observado; cookie e marcador do navegador presentes | [Hero](./evidence/calen-2026-11-13/01-calen-hero-1090.jpg) |
| E02 | Produto publicado, 1600 × 910 | Imagem estática pública inspecionada; comportamento não testável | [Produto](./evidence/calen-2026-11-13/03-produto-desktop-publicado.webp) |
| E03 | Página de preços | Observada; tabela e hierarquia comercial | [Preços](./evidence/calen-2026-11-13/04-calen-precos.jpg) |
| E04 | Hero mobile, 390 × 844 | Observado; documento sem overflow horizontal na medição; menu não validado | [Mobile](./evidence/calen-2026-11-13/06-calen-mobile-390.jpg) |
| E05 | Boas-vindas/acesso mobile | Observado; controles medidos; sem submissão pelo agente | [Acesso](./evidence/calen-2026-11-13/08-calen-acesso-mobile.jpg) |
| E06 | Cards de planos | Observados; seleção anual visível; troca de ciclo não validada | [Planos](./evidence/calen-2026-11-13/11-calen-planos.jpg) |
| T01 | Tutorial: visão geral | Capturado com progresso 1/7 | [Visão geral](./evidence/calen-2026-11-13/10-calen-tutorial-desktop.jpg) |
| T02 | Tutorial: categorias | Capturado; avanço seguinte confirmado | [Categorias](./evidence/calen-2026-11-13/12-tutorial-02-categorias.jpg) |
| T03 | Tutorial: recorrências | Capturado; avanço seguinte confirmado | [Recorrências](./evidence/calen-2026-11-13/13-tutorial-03-recorrencias.jpg) |
| T04 | Tutorial: calendário | Capturado; demonstração varia durante a etapa | [Calendário](./evidence/calen-2026-11-13/14-tutorial-04-calendario.jpg) |
| T05 | Tutorial: investimentos | Capturado; avanço seguinte confirmado | [Investimentos](./evidence/calen-2026-11-13/15-tutorial-05-investimentos.jpg) |
| T06 | Tutorial: assistente | Capturado; resposta demonstrativa em card | [Assistente](./evidence/calen-2026-11-13/16-tutorial-06-assistente.jpg) |
| T07 | Tutorial: contas | Capturado; avanço saiu do tutorial para apresentação do curso | [Contas](./evidence/calen-2026-11-13/17-tutorial-07-contas.jpg) |

Capturas iniciais de carregamento e uma captura que passou a mostrar o provedor externo de autenticação foram rejeitadas como evidência do design do Calen. Não integram a pasta selecionada.

## Inventário visual observável

### Cor e contraste de superfícies

Valores abaixo vieram do CSS da LP. Não devem ser usados como tokens internos do nosso app.

| Papel | Valor observado | Função |
|---|---|---|
| Fundo escuro | `#0B0D0A` | Hero, recursos, áreas de produto |
| Texto no escuro | `#F4F6F2` | Conteúdo principal |
| Texto secundário no escuro | `rgba(244,246,242,.65)` | Explicações e metadados |
| Superfície elevada no escuro | `rgba(244,246,242,.04)`; variante `.06` | Agrupamento discreto |
| Borda no escuro | `rgba(244,246,242,.10)` | Separação com pouco ruído |
| Fundo creme | `#F8F5F0` | Problemas, preços e segurança |
| Texto no creme | `#1A1714` | Leitura e títulos |
| Texto secundário no creme | `#5A554D` | Apoio |
| Card no creme / borda | `#FFFFFF` / `#E5E0D8` | Cards comerciais |
| Destaque roxo | `#AD52FF` | Ênfase e marca na LP |
| Gradiente de CTA | `#9A5BFF` → `#7C3AED` | Ação comercial |
| Verde | `#2FB22F` | Informação positiva |
| Cores auxiliares | azul `#4A90E2`, âmbar `#F5A623` | Visualizações e distinções |

O produto autenticado também utiliza superfícies escuras, mas o roxo de um botão observado era `rgb(139,92,246)`. Portanto, não há evidência de uma única cor literal para todas as aplicações. Comparações de contraste exigem cada combinação efetiva, incluindo transparências; a existência de tokens não comprova conformidade.

### Tipografia

Família observada: **Satoshi**, com fallbacks de sistema. Medidas aproximadas em CSS pixels, sob o viewport indicado; arredondamentos de screenshot/zoom não são especificações de origem.

| Elemento da LP | Medida observada |
|---|---|
| H1 em 1090 px | 47,98 px / 50,86 px, peso 500, tracking −1,34 px |
| H1 em 390 px | 36 px |
| H2 em 1090 px | 41,44 px / 44,75 px, peso 600 |
| H3 em 1090 px | 30,53 px / 35,11 px, peso 600 |
| Texto de apoio | Aproximadamente 17,45/26,17 px; outros parágrafos 18/28,8 px |
| Marcador de seção | 13 px / 20,8 px, peso 700, tracking 1,82 px |
| CTA principal | 17 px; outros botões de navegação 14 px |

Títulos grandes e parágrafos estreitos pertencem à leitura comercial. No aplicativo, valores, nomes, prazos e detalhes têm hierarquia compacta. A fonte do AncoraHub continua sendo Plus Jakarta Sans, com números tabulares já existentes.

### Espaçamento, raios e elevação

- A LP expõe uma escala de espaçamento de 4, 8, 12, 16, 24, 32, 48 e 64 px. O índice 5 do Calen representa 24 px; o nosso `--space-5` representa 20 px. Nomes iguais não garantem equivalência.
- Raios expostos: 6, 12 e 16 px, além de cápsulas. Molduras de aparelhos chegam a 64 px e são decoração da apresentação.
- Seções da LP usam aproximadamente 96 a 112 px de respiro vertical; hero tem 160 px no topo e 96 px abaixo. Não transportar essa densidade para a operação do corretor.
- Sombra de card escuro: `0 12px 40px rgba(0,0,0,.5)`; no creme: `0 18px 48px rgba(26,23,20,.10)`. O mock do produto usa bordas finas e separadores com menos elevação aparente.
- A repetição de largura, alinhamento e espaçamento entre grupos produz unidade sem colocar cada informação em um card isolado.

### Botões e hierarquia de ação

| Contexto | Anatomia observada | Implicação para nós |
|---|---|---|
| CTA do hero | Cápsula, altura 54 px, padding horizontal 26 px, gradiente e sombra roxa | Usar destaque forte só onde existe decisão principal |
| Ação secundária do hero | Mesma altura, fundo discreto/transparente e borda | Alternativa mantém geometria sem disputar contraste |
| CTA de navegação desktop | Aproximadamente 40,4 px, 14 px, padding 9 × 18 px | Densidade depende do contexto |
| Links para lojas | Altura 46 px, raio 12 px, padding horizontal 14 px | Blocos externos possuem linguagem própria |
| Menu mobile da LP | Caixa medida de 34 × 34 px | Não copiar como padrão de alvo de toque |
| Boas-vindas mobile | Botões de 51 e 52,6 px, raio 16 px, texto 16/700 | O próprio Calen não usa cápsula em todos os contextos |
| Ação textual de acesso | Altura de caixa de 32 px, texto 15/600 | Verificar alvo efetivo e espaçamento, além da aparência |
| Produto autenticado, amostra inicial | Botões de ícone 32 px/raio 8; seletor de perfil 42 px/raio 10; CTA de criação 36 px | Produto tem geometria compacta, diferente da LP |
| Tutorial desktop | Ação de avanço roxa no rodapé direito; retorno com menor peso à esquerda | Progresso e ação mantêm posição entre etapas |

A transição declarada do CTA da LP usa cerca de 160 ms para transform, sombra e filtro. Os controles da tela de boas-vindas usam opacidade em cerca de 150 ms. Hover, foco, loading, erro e sucesso de todos esses botões não foram exercitados. Essas lacunas de observação não autorizam preencher a especificação com estados inventados.

### Organização e navegação

A LP organiza problema, solução, recursos, dispositivos, colaboração, integração, aprendizagem, prova social, planos, segurança e dúvidas. A alternância escuro/creme marca capítulos. Essa sequência é comercial; a tradução operacional é “contexto → tarefa → consequência → confirmação”.

No produto, a navegação agrupa trabalho diário, planejamento, análise e ajustes. O mock público apresenta resumo amplo, contas e cartões em um grupo e calendário com painel do dia. A seleção do objeto muda o contexto de detalhe sem abandonar o panorama. Ícones dão pistas, acompanhados por nomes; cores distinguem categorias e situações.

O nosso corretor já opera com conversas e rail desktop. A equivalência útil é agrupar por intenção e preservar o contexto, mantendo esse rail. Não há justificativa nesta pesquisa para substituí-lo por uma cópia da sidebar do Calen ou criar outra home em `/corretor/resumo`.

### As sete telas do tutorial

| Etapa | O que a demonstração ensina | Padrão reaproveitável | Limite |
|---|---|---|---|
| 1. Visão geral | Panorama, calendário e detalhe do dia | Mostrar o mapa antes dos controles | Demo não comprova dados reais sincronizados |
| 2. Categorias | Distribuição por grupo e progresso visual | Resumo gráfico acompanhado por lista textual e valores | Não criar gráficos sem pergunta e métrica canônicas |
| 3. Recorrências | Compromissos repetidos com próxima data | Consolidar itens recorrentes, prazo e total | No CRM, usar tarefas/eventos existentes, sem nova automação implícita |
| 4. Calendário | Diferença entre realizado e futuro | Separar fato confirmado de previsão | Não transformar comissão estimada em dinheiro recebido |
| 5. Investimentos | Total, composição e evolução | Dar unidade, período e detalhe ao indicador | “Carteira” financeira não é carteira de clientes |
| 6. Assistente | Pergunta natural respondida por card estruturado | Texto, evidência e destino verificável na resposta | Apenas demonstração; precisão da IA não foi testada |
| 7. Contas | Agrupamento por instituição e objetos filhos | Lista hierárquica com ações no objeto certo | Não implica integrar bancos no AncoraHub |

Nas sete etapas: painel explicativo à direita, área demonstrativa ampla à esquerda, indicação de posição, retorno e avanço em posições estáveis. A demonstração do calendário mudou entre a primeira observação e a captura salva, confirmando que a etapa tem conteúdo variável. A captura estática não caracteriza toda a animação nem seu custo.

Na etapa de recorrências também foram vistos momentos diferentes da demonstração: itens mudam de situação e o resumo acompanha essa mudança. Em investimentos, composição e evolução aparecem juntas. A lição de movimento é mostrar causa e consequência dentro de uma explicação; o formato técnico dessas demonstrações e suas durações não foram identificados. Não reproduzir uma apresentação automática contínua em uma tela de trabalho com SLA.

Após o último avanço apareceu uma apresentação de conteúdo educativo. Não foi iniciada conexão bancária nem cadastro de transação. No AncoraHub, `LiteTour`, microtours, `FirstStepsCard` e jornada já existem; a oportunidade é editar a sequência e o contexto, evitando mais um onboarding concorrente.

### Formulários, feedback, privacidade e responsividade

- A tela de boas-vindas tem identidade, explicação curta e opções hierarquizadas. Validação de email/senha, recuperação de acesso e mensagens de erro não foram percorridas conclusivamente.
- Na LP a versão de 390 px reorganiza conteúdo e CTAs sem overflow horizontal medido. Isso não valida 320 px, zoom ou todas as rotas do app.
- O app expõe controle para ocultar valores e seletor de tema. A presença foi observada; alcance e persistência não foram testados. Ocultar visualmente não é controle de autorização.
- CSS consultado possui regras de redução de movimento em elementos específicos. Não foi feito teste sistêmico com preferência reduzida.
- Bordas, tons, alinhamento, ícones e rótulos dividem a carga de comunicação. Não se deve transmitir estado apenas por cor ou animar um prazo crítico continuamente.

## Princípios e ciência: interpretação, não atribuição ao autor

As fontes ajudam a formular hipóteses de usabilidade. Não provam que os designers do Calen as utilizaram nem garantem aumento de conversão no AncoraHub.

| Princípio | Relação com o observado | Aplicação e verificação proposta |
|---|---|---|
| Aquisição de alvos, Fitts | Controles estáveis e CTA de avanço amplo | Aumentar área efetiva e reduzir deslocamento em ações frequentes; medir erros de toque. [Trabalho original](https://www2.psychology.uiowa.edu/faculty/mordkoff/infoproc/pdfs/Fitts%201954.pdf) |
| Escolha e tempo de resposta, Hick | Cada etapa pede uma decisão principal | Organizar opções por intenção; medir localização da ação. A experiência original não estabelece um número universal de itens de menu. [Artigo original](https://journals.sagepub.com/doi/10.1080/17470215208416600) |
| Proximidade e região comum | Valores e objetos relacionados compartilham bloco | Agrupar prazo, estado e ação do mesmo lead. [Proximidade](https://www.nngroup.com/articles/gestalt-proximity/), [região comum](https://www.nngroup.com/articles/common-region/) |
| Reconhecimento | Rótulos e contexto ficam junto da ação | Mostrar por que agir e o destino, evitando memorizar status. [Referência](https://www.nngroup.com/articles/recognition-and-recall/) |
| Disclosure progressivo | Visão geral e detalhe coexistem sem mostrar tudo | Deixar frequente visível; documentos e configurações sob demanda. [Referência](https://www.nngroup.com/articles/progressive-disclosure/) |
| Visibilidade de estado e consistência | Progresso do tutorial e padrão de avanço | Distinguir intenção, sincronização, confirmação e falha recuperável. [Heurísticas](https://www.nngroup.com/articles/ten-usability-heuristics/) |
| Alvos acessíveis | Alguns controles observados são compactos | Nosso objetivo de 44 px é deliberadamente mais confortável. WCAG 2.2 AA estabelece 24 px com exceções; 44 px é o critério aprimorado AAA, não a regra AA universal. [Mínimo](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum), [aprimorado](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced) |

Não há fundamento nesta coleta para “psicologia universal do roxo”, promessas de dopamina, números mágicos de opções ou ganho percentual de produtividade. A hipótese precisa ser testada com tarefas reais e dados sintéticos.

## O que já temos no AncoraHub

| Capacidade existente | Evidência local | Consequência |
|---|---|---|
| Tokens de cor, espaço, raio, tipografia e movimento por escopo | `src/components/arc/venancor-scope.css` | Evoluir o escopo existente |
| Botão com variantes, loading, `aria-busy`, press e reduced motion | `src/components/arc/button/button.tsx` e CSS | Não criar novo botão por página |
| Alvo mínimo de 44 px no override final de `sm` | `venancor-scope.css:121` | Não confundir declaração anterior de 36 px com valor final |
| Foco por teclado | `venancor-scope.css:133` em diante | Auditar aplicação efetiva; não declarar ausência global |
| Próxima ação e fila “Agora” | `src/components/chat/chat-home.tsx:43` e `:195` | Refinar uma capacidade existente |
| Proteção contra duplicar “próxima ação” com fila preenchida | `chat-home.tsx`, `showNext` | Não afirmar que ambos sempre competem |
| Onboarding e aprendizagem contextual | `src/components/chat/tour/lite-tour.tsx`, `FirstStepsCard` | Um só sistema de aprendizagem |
| Listas compartilhadas de pessoas/clientes | `src/components/light/people-list/` | Evoluir composição e estados compartilhados |
| Navegação canônica por papel | `src/components/light/light-routes.ts` | Preservar rotas e guards |
| ERP com adaptador de pele, listas, painéis e menus | `ancorahub-erp/src/features/erp/ui/erp-kit.tsx` | Integrar ao kit já criado, sem terceira biblioteca |

## Matriz de lacunas

Prioridades abaixo são de UX: A antes do piloto, B no fluxo correspondente, C após baseline. “Confirmado no código” não significa falha observada em produção.

| ID | Lacuna e evidência | Natureza | Prioridade | Tratamento |
|---|---|---|---|---|
| G01 | Primário de marca documentado roxo, `ArcButton.primary` neutro e ação do chat azul | Divergência confirmada; intenção a reconciliar | A | Contrato semântico por pele; registrar decisão antes de mudar cores |
| G02 | `.nowAction` reimplementa botão, incluindo press `.98`, enquanto Arc já cobre comportamento | Confirmado em `chat-home.module.css:100` | A | Compor ação com componente-base, preservando aceite e navegação |
| G03 | `.headerPill` 36 px, busca 42 px e link WhatsApp `h-10` fora do botão-base | Dimensões declaradas confirmadas; alvo efetivo pendente | A | Medir caixa interativa; corrigir na base, sem chamar tudo de violação WCAG |
| G04 | Docs de design e escopos apresentam famílias e tratamentos diferentes | Divergência documental confirmada | A | Mapa de precedência por papel/pele, incluindo exceções aprovadas |
| G05 | Filtros/listas possuem controles locais além dos compartilhados | Confirmado por inspeção; extensão requer inventário | B | Consolidar SearchField, segmento e toolbar sob contratos existentes |
| G06 | Home combina trabalho, aprendizagem e placar em estados condicionais | Hipótese de competição visual | A | Capturar cenários e ordenar pela decisão atual, preservando `showNext` |
| G07 | Descoberta de funções no menu “Mais” | Hipótese, sem teste de localização | B | Testar busca de Clientes, Plantões e Cotação; ajustar rótulos/grupos se necessário |
| G08 | Consistência entre intenção otimista, confirmação e retry | Cobertura por fluxo não validada nesta auditoria | A | Matriz de estados e provas do aceite de lead e presença |
| G09 | Legibilidade de prazos, valores e fonte de atualização entre módulos | Oportunidade a validar | B | Data, unidade, período e origem junto da decisão; números tabulares existentes |
| G10 | Agenda pode evidenciar mais o próximo compromisso | Hipótese; agenda já existe | B | Hoje por padrão e semana sob demanda, com dados reais |
| G11 | Carteira e ficha precisam repetir a mesma lógica de próxima ação | Dependência do trabalho C0–C2 já planejado | B | Compor com PeoplePage e painel compartilhado, sem duplicar implementação |
| G12 | Fluxos longos de cotação/venda exigem manutenção de contexto | Hipótese; comportamento precisa de baseline | B | Etapas apenas quando úteis, rascunho e erro local sem perda de entrada |
| G13 | Privacidade visual de valores como capacidade compartilhada | Candidato; ausência global não comprovada | C | Inventariar controles existentes antes de criar preferência; autorização continua no servidor |
| G14 | Literais de motion convivem com tokens centralizados | Confirmado em trechos locais | B | Centralizar ao tocar a superfície; transição funcional via `transitions-dev` |
| G15 | Tutorial, microtour e missões podem competir | Hipótese de aprendizagem, recursos já existem | B | Uma trilha contextual, retomável, sem bloquear oferta/SLA |
| G16 | Não existe baseline de usabilidade obtido nesta tarefa | Limite confirmado da pesquisa | A | Medir tarefas antes/depois; não publicar ganho inventado |

## Direção recomendada

Preservar a identidade clara, Plus Jakarta Sans, cápsulas aprovadas, conversas e rail do corretor. Usar o Calen como referência de hierarquia, agrupamento, contexto temporal e aprendizagem progressiva. A primeira entrega deve unir home, aceite e navegação em um lote pequeno; a sequência completa e seus critérios estão no [plano da fase 2](./2026-11-13-corretor-redesign-plan.md).

Medições brutas selecionadas: [LP](./evidence/calen-2026-11-13/home-measurements.json), [boas-vindas mobile](./evidence/calen-2026-11-13/auth-measurements.json). São amostras de um documento renderizado e não uma especificação universal do produto.
