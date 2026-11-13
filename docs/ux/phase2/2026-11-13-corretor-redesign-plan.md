# Fase 2 de redesign: clareza operacional do corretor

Data: 2026-11-13. Estado: **primeira proposta visual rejeitada; plano precisa ser revisto preservando o Lite atual**. O Vinicios considerou o print confuso e confirmou a preferência pelo estilo e metodologia já usados no modo Lite. A proposta foi retirada dos pontos de entrada de dashboard, prévia e administração; nenhuma publicação ocorreu. As ondas abaixo são histórico de planejamento, não autorização para retomar a composição rejeitada. [Registro da implementação e retirada](../../implementations/active/2026-11-13-broker-home-phase2.md).

Base: [auditoria do Calen e do código](./2026-11-13-calen-design-audit.md). Pedido: segunda fase de redesign começando pelo modo corretor, incluindo botões, organização, linguagem visual e fundamentos de usabilidade.

## Resultado esperado

Ao abrir o sistema, o corretor identifica o que precisa fazer agora, atua sem perder o contexto da conversa e entende se a operação foi confirmada. Ao mudar de módulo, reconhece os mesmos controles, estados e padrões de leitura.

O plano cobre o modo corretor e prepara expansão posterior aos demais papéis. Não muda distribuição, SLA, elegibilidade, valores de comissão, regras financeiras, permissões ou integrações. O desenvolvimento do cotador interno permanece pausado; a revisão de sua interface fica dependente de retomada explícita, preservando o piloto existente.

## Contratos que continuam válidos

- [Contrato de redesign](../UX_REDESIGN_CONTRACT.md), [controle de execução](../UX_REDESIGN_CONTROL.md) e [marca Venancor](../../design-system/venancor.md) continuam sendo as fontes normativas.
- Etapa global atual: **UX-M1.10, `IMPLEMENTATION_COMPLETE_QA_PENDING`**. A matriz autenticada mobile continua pendente. Este documento não conclui M1.10 nem altera sua próxima ação obrigatória.
- A exceção do Corretor Lite citada no controle deve ser preservada. A implementação da fase 2 exige registrar um lote explícito para esse papel; o plano não autoriza trocar a pele global.
- Claro por padrão, Plus Jakarta Sans e controles arredondados existentes. O preto, Satoshi, gradientes e ilustrações do Calen são referências observadas, não novos tokens aprovados.
- Nenhum componente novo enquanto `ui`, `unlumen-ui`, Arc, Lite e o adaptador ERP cobrirem a necessidade. Uma capacidade faltante primeiro evolui o componente-base.
- Novas transições exigem `transitions-dev`, tokens existentes, reduced motion e controle administrativo vigente. Feedback crítico não pode depender do fim de uma animação.
- Todas as capacidades novas terão configuração validada no servidor, auditoria apropriada e controle reversível do Super-admin. Tenant, identidade, unidade e carteira derivam da sessão confiável.

## Modelo de organização

| Camada | Pergunta do corretor | Apresentação |
|---|---|---|
| Agora | O que exige minha ação? | Próxima ação já existente, motivo, prazo e CTA do objeto |
| Meu trabalho | Onde estão meus atendimentos? | Conversas, fila e clientes, com retorno ao contexto |
| Hoje | O que tenho marcado? | Compromissos e plantões atuais, detalhes sob demanda |
| Acompanhamento | O que está bloqueado ou aguardando? | Documentos, retornos, propostas e fatos financeiros permitidos |
| Apoio | Como faço? | Ajuda contextual, microtour e configurações ocasionais |

Uma ação principal por contexto. Outras ações frequentes podem ficar próximas, com menor peso; raras ficam em menu. A prioridade de domínio vem dos resolvedores existentes, sem inventar ordenação por receita ou uma nova regra de urgência no cliente.

Em desktop, preservar o rail de conversas e usar a área central para a tarefa. Em mobile, manter leitura vertical e ações alcançáveis, respeitando teclado e safe area. A nova fase não introduz automaticamente uma nova barra inferior: o chrome atual já varia por rota.

## Contrato dos componentes

| Família | Reutilização | Especificação da fase 2 |
|---|---|---|
| Ação | `ArcButton` e `ui/Button`, conforme pele | Mapa de primário, secundário, ghost e destrutivo; links continuam links; `type` explícito em formulários |
| Estado de ação | Loading e `aria-busy` existentes | Impedir envio duplicado, preservar largura, sucesso só após confirmação, erro com retry e contexto |
| Campos | Primitivas existentes de input, select, calendário e busca | Rótulo persistente, ajuda e erro associados, placeholder só como exemplo, foco no primeiro erro |
| Selects | Select/combobox já disponível | Valor atual legível, busca quando volume justificar, vazio/erro/carregamento distintos; sem opção fictícia |
| Busca/filtros | SearchField, Segment, toolbar e filtros por URL existentes | Explicar escopo real, limpar com uma ação, preservar contexto ao voltar, não misturar seleção com navegação |
| Linhas | PeopleRow, listas Lite, tabelas existentes | Nome/objeto, estado, prazo e próxima ação; alinhar números e permitir rótulos longos |
| Detalhe | BottomSheet, LiteSidePanel, Sheet por pele | Resumo primeiro; detalhes por seção; foco restaurado; rolagem do corpo sem rodapés sobrepostos |
| Indicadores | Métricas e badges existentes | Unidade, período e sentido; status sempre textual; ausência de dado não vira zero |
| Avisos | Feedback compartilhado | Explicar impacto, causa quando conhecida e recuperação; evitar alerta repetido em várias superfícies |
| ERP | `ErpSkinProvider` e `erp-kit` no worktree ERP | Mesma semântica com renderização adequada a cada pele; não duplicar financeiro para imitar o Calen |

Antes de mudar cores de ação, resolver G01: o documento da marca indica primário roxo, Arc usa primário neutro e o chat possui azul semântico. A etapa produz uma tabela de uso por pele e registra a decisão. Não fazer substituição global de cor por busca textual.

Alvo recomendado: pelo menos 44 × 44 CSS px efetivos em ações de toque, inclusive área expandida quando apropriada. Distinguir esse objetivo do critério WCAG AA de 24 px com exceções. Não aumentar a altura de cada elemento só para parecer uma LP.

Tipografia usa a escala atual: título de página 24–28 px, seções 16–18, corpo conforme token 14–16. Testar campo mobile a 16 px quando houver risco de zoom automático no iOS, evoluindo a variante compartilhada se necessário. Evitar microtexto para prazo, valor ou erro.

## Sequência de execução

Estimativas P/M/G indicam porte relativo, não prazo prometido. Cada onda termina com evidência e revisão antes da seguinte.

| Onda | Escopo e ação principal | Componentes/arquivos de partida | Saída verificável | Dependências / porte |
|---|---|---|---|---|
| R2-00 | Baseline do corretor e preparação do lote | `light-routes.ts`, chrome, UX control, páginas atuais | Capturas autenticadas dos estados, rotas/capacidades e matriz M1.10; lacunas confirmadas ou descartadas | Antes de UI / M |
| R2-01 | Consistência de ação e campos no escopo piloto | Arc/UI Button, `venancor-scope.css`, `.nowAction`, `.headerPill` | Catálogo de estados e contrato semântico; remover cópias só nas superfícies do lote | R2-00 e decisão G01 / M |
| R2-02 | Home e aceite: identificar e executar o próximo passo | `chat-home.tsx`, `AcceptLeadButton`, `NowSection`, chrome e Mais | Oferta, prazo, confirmação e recuperação claros; conversa preservada; sem CTA duplicado | R2-01 / M |
| R2-03 | Fila e atendimento: abrir e avançar o lead certo | `/leads?tab=minha-fila`, `/leads/[id]`, conversa e ficha | Busca/filtro recuperáveis; próxima ação na ficha; origem e prazo compreensíveis | R2-02 / G |
| R2-04 | Agenda e plantões: saber quando e confirmar presença | `/agenda`, `/plantoes`, confirmação existente | Hoje/semana legíveis; horário e local; confirmação pendente, confirmada e falha | R2-03; capacidades atuais / M |
| R2-05 | Carteira: retomar e acompanhar o cliente | `/clientes`, `/clientes/[clientId]`, PeoplePage e plano C0–C2 | Próxima ação e retornos consistentes; vazio, sem resultados e sem permissão distintos | Integrar trabalho C0–C2, sem duplicá-lo / M |
| R2-06 | Cotação e registro da venda: concluir sem perder entrada | `/cotacao`, variantes guiada/completa e fluxo de venda canônico existente | Campos agrupados, validação próxima ao erro, revisão e confirmação; sem mudança no catálogo | Retomada do cotador para seu sublote; inventário da rota de venda / G |
| R2-07 | Financeiro pessoal: entender fato e pendência | `/financeiro`, detalhes e recibos já autorizados na fundação ERP | Somente escopo pessoal; implantação, mensalidade e comissão separados; evidências protegidas | ERP integrado/publicado e capacidades conferidas / M |
| R2-08 | Aprendizagem contextual: aprender no momento necessário | `LiteTour`, microtours, `FirstStepsCard`, `/jornada`, ajuda | Uma trilha, retomável; não interrompe oferta ou presença; módulos desativados excluídos | Home estabilizada; pode acompanhar R2-03–07 / M |
| R2-09 | Aceite transversal e piloto governado | Primitivas, flags, auditoria, testes e matriz visual | Sem regressão de tarefa, escopo, a11y e desempenho; rollback ensaiado | Cada sublote antes de ampliar / M |
| R2-10 | Expansão aos demais papéis | Kits e adapters já existentes | Plano por supervisor, gestor e diretor, com permissão/skin próprias | Aceite do piloto corretor / G separado |

### R2-00: baseline e decisões antes do código

Registrar papel, objetivo, ação principal, estados e disclosure de cada rota do lote. Confirmar a versão efetivamente publicada e diferenças entre worktrees, pois a fundação ERP já tem adaptador de pele e trabalho C0–C2 pode estar em outra branch.

Capturar quatro cenários sintéticos: primeiro acesso, dia com oferta/SLA, dia sem urgência e recuperação de erro/conexão. Incluir teclado, foco e retorno da ficha. Comparar `showNext` e fila Agora para não introduzir duplicação que o código atual já evita.

Entregáveis: inventário rota → componente → fonte de dados → estado; baseline visual; contrato de ação G01; lista de controles locais realmente afetados; registro do lote no controle vigente. A pendência M1.10 permanece explícita até seu aceite.

### R2-02: primeira superfície a entregar

Lote inicial recomendado: **Início do corretor + aceite de lead + acesso às ferramentas**.

1. Manter conversa e rail como eixo. Mostrar motivo e prazo junto do objeto que precisa de ação.
2. Reutilizar o botão-base na ação da fila Agora, sem mudar a operação de aceite nem perder o identificador de oferta.
3. Representar disponibilidade pausada, WhatsApp necessário e capacidade indisponível com consequência e destino de recuperação. Não criar alertas concorrentes para a mesma causa.
4. Com oferta urgente, reduzir destaque de placar e aprendizagem; sem urgência, mostrar o próximo trabalho de forma calma. A composição deve respeitar os estados condicionais existentes.
5. Preservar busca local com promessa de escopo correta e posição de retorno. Agrupar ferramentas pelo objetivo do corretor no menu existente.
6. Validar sucesso, concorrência de aceite, oferta expirada, perda de conexão e falha recuperável. O servidor continua decidindo disponibilidade e prazo.

Critério de saída: o corretor localiza e executa o próximo passo sem ajuda; entende o resultado; reabre a conversa sem perder contexto; nenhum novo botão local repete primitive existente. Capturas antes/depois e testes proporcionais fazem parte do lote.

### R2-03 a R2-05: continuidade do trabalho

Na fila, apresentar o mínimo necessário para escolher o lead, com filtros essenciais visíveis e avançados recolhidos. Na ficha, agrupar contato, situação, próxima ação, documentos e histórico. Não colocar toda informação coletada na primeira dobra. Ações de comunicação devem continuar usando o fluxo existente e sua confirmação, sem enviar mensagens só por abrir uma tela.

Agenda começa pelo compromisso útil do dia; semana e mês são alternativas quando ajudam. Usar datas e horários explícitos no fuso canônico, além de rótulos relativos. Calendário não deve ser a única maneira de localizar uma tarefa. Não inventar conflitos, renovações ou lembretes se a fonte autorizada não os fornecer.

Carteira integra C0–C2: lista paginada, atenção, próxima ação e retornos. A primeira vista mostra necessidade de contato; documentos e detalhes contratuais entram no painel. Arquivo indisponível, cliente fora da carteira e ausência de próximos passos são estados diferentes. Essa etapa não implica copiar dados de clientes de outro produto.

### R2-06 e R2-07: formulários e fatos financeiros

No fluxo de cotação/venda, decidir etapas com base na complexidade real, preservando campos e regras existentes. Validar no servidor; manter entrada após erro; distinguir rascunho de confirmação. O produto com condição comercial pendente mantém aviso e bloqueio de proposta final já definidos. Não reabrir extração de catálogo nem inventar preço nesta fase visual.

Para financeiro, a referência do Calen é clareza entre realizado e futuro. No AncoraHub, manter separados contrato implantado, mensalidade paga pelo cliente e comissão recebida pela Âncora. Comissão do corretor, repasse e recibo seguem o modelo aprovado do ERP, sem inferência por simples troca de status. Regra da segunda parcela permanece desativada enquanto pendente. Valores conferidos e aprovação separada continuam válidos.

Ocultar valores pode ser avaliado como preferência de apresentação após inventário da base. Não altera payload autorizado, auditoria de exportação ou acesso a comprovantes. Não mostrar como “pago” o que apenas foi preparado, previsto ou aprovado.

### R2-08: aprendizagem inspirada no tutorial, usando nossa estrutura

O Calen ensina uma função por tela com demonstração e progresso. Adaptar o princípio ao corretor com rotas e capacidades reais:

| Momento | Conteúdo sugerido | Resultado que comprova aprendizagem |
|---|---|---|
| Preparar atendimento | Disponibilidade e WhatsApp | Entende o estado e sabe recuperar conexão |
| Receber trabalho | Oferta, prazo e aceite | Reconhece oferta expirada e confirmação |
| Atender | Conversa e ficha do lead | Localiza informação sem abandonar atendimento |
| Acompanhar | Próxima ação, agenda e retorno | Encontra tarefa já cadastrada e seu prazo |
| Cotar e registrar | Fluxo habilitado de cotação/venda | Distingue revisão de confirmação; só quando disponível |
| Cuidar da carteira | Clientes, documentos e acompanhamento | Encontra pendência e origem |
| Consultar resultado | Próprio desempenho/financeiro autorizado | Entende período e diferença entre fato e pendência |

São tópicos de cobertura, não uma exigência de sete telas obrigatórias. Dividir em microtours curtos no ponto de uso; permitir pular, voltar e retomar; filtrar por capacidades; preservar conclusão já registrada. Não bloquear lead urgente com tour, exigir áudio, marcar sucesso só por clicar em Próximo ou criar recompensa nova sem regra aprovada. O conteúdo demonstrativo usa dados sintéticos claramente identificados.

## Matriz mínima de estados

| Superfície | Estados obrigatórios e recuperação |
|---|---|
| Home | Carregando sem salto; primeira utilização; fila vazia; urgência; pausado; dependência indisponível; erro com retry |
| Aceite | Disponível; enviando; confirmado; expirado; conflito; falha; reconciliação após conexão |
| Busca/lista | Inicial; filtrada; nenhum resultado; carregando; erro; paginação; retorno preservado |
| Ficha | Completa; parcial; sem documentos; fora de escopo; dado desatualizado; erro de mutação sem perda |
| Agenda/presença | Hoje sem compromisso; futuro; em andamento; confirmação pendente; confirmada; falha; prazo encerrado |
| Formulário | Vazio; preenchido; inválido; dependência carregando; rascunho; revisão; enviando; confirmado; conflito |
| Financeiro | Sem lançamentos; a conferir; aprovado; repasse/recebimento conforme domínio; estornado; evidência indisponível; sem permissão |
| Tutorial | Novo; retomado; pulado; concluído; capacidade desligada; alvo não visível; reduced motion |

Não mostrar zero como substituto de falha de consulta. Toast é complementar: resultado importante permanece no objeto. Não usar somente cor para diferenciar erro, espera ou sucesso. Confirmações sensíveis seguem auditoria e domínio existentes.

## Movimento e comportamento

- Hover/foco/press usam a primitive; não misturar escalas de press locais.
- Entrada e saída de painel comunicam continuidade espacial. Menu mantém âncora estável; não escalar o trigger quando a biblioteca mede posição.
- Atualização de lista preserva item ativo, foco e rolagem. Contagem de SLA não deve pulsar indefinidamente.
- Feedback otimista distingue intenção local de confirmação no servidor e tem rollback explícito. Não antecipar sucesso de aceite ou recebimento financeiro.
- Respeitar preferência reduzida do usuário e chave administrativa; nenhum trabalho bloqueado por motion.
- Usar tokens existentes de 120/160/240 ms e springs compartilhadas conforme contexto. Revisar com `transitions-dev`; não adicionar biblioteca nem animação apenas por decoração.

## Governança, acesso e reversão

Proposta de rollout: capacidade de fase 2 desativada por padrão, com coorte explícita de corretor por tenant e usuário de piloto. Nome técnico, armazenamento e superfície administrativa devem reutilizar o registro de capacidades existente; não criar flag paralela em localStorage como autoridade.

O Super-admin pode ativar/desativar a coorte e editar parâmetros de apresentação aprovados, como módulos de ajuda disponíveis. Mudanças são validadas e auditadas com ator, data, escopo e resultado. Preferências pessoais permitidas ficam separadas das políticas administrativas.

Guard no servidor continua protegendo rota, ação, consulta e arquivo; ocultação de menu é só apresentação. A flag desligada restaura o renderer anterior sem apagar dados, conversas, rascunhos ou histórico. Código compartilhado alterado deve ser compatível com ambas as peles; verificar Diretor, Gestor e Supervisor como controle de regressão.

Acesso de corretor não passa a incluir financeiro global, regras de comissão, configurações de tenant, importações ou dados de colegas. A expansão ERP não é uma autorização automática de navegação para todos.

## Validação e aceite

| Dimensão | Evidência exigida |
|---|---|
| Mobile | 320, 360, 375, 390, 412 e 430 px; teclado aberto; safe area; nomes/valores longos |
| Desktop/tablet | 768, 1024 e 1440 px; rail, painel e resize sem perda de contexto |
| Acessibilidade | Teclado completo; foco visível/restaurado; nome/estado acessível; leitor de tela; zoom 200%; contraste medido; reduced motion |
| Tema | Claro vigente; temas já suportados no escopo afetado, sem criar dark novo por analogia ao Calen |
| Dados/servidor | Dois tenants e dois corretores sintéticos; deep links, URLs de arquivo e mutações fora de escopo negados |
| Recuperação | Latência, queda, retry, oferta expirada, dupla ação e resposta desatualizada sem sucesso falso |
| Layout | Sem overflow da página; áreas largas de dados com rolagem localizada e indicação; ação principal não coberta por barra/teclado |
| Engenharia | Testes de comportamento afetado, typecheck, lint, build e harness; falhas anteriores separadas no registro |
| Operação | Super-admin ativa/desativa piloto; auditoria verificável; rollback sem perda de trabalho |

Testes de tarefa sugeridos: aceitar uma oferta e abrir atendimento; localizar retorno de cliente; recuperar erro sem perder entrada. Registrar conclusão sem auxílio, erros, tempo até localizar a ação e pontos de hesitação. Obter baseline antes de definir uma meta numérica de melhoria. Não prometer aumento de conversão sem experimento.

Telemetria proposta coleta tipo de evento e resultado técnico, sem texto da conversa, dados de saúde, nome do cliente ou valor financeiro. Distinguir medida observada de estimativa e usar retenção/política existentes. Novos eventos precisam de revisão de domínio e privacidade antes do código.

## Checklist de início do primeiro lote

1. Confirmar baseline publicado, capacidades e pendência M1.10; registrar R2-00 no controle.
2. Resolver mapa de ações por pele G01 e listar apenas componentes locais do lote.
3. Especificar cenários da home/aceite em mobile e desktop, com uma ação principal por contexto.
4. Implementar dentro dos componentes existentes, com piloto governado e sem regra nova de negócio.
5. Registrar provas de estados, isolamento, acessibilidade, build e rollback; revisar antes de ampliar.

**Próxima ação concreta:** executar R2-00 e fechar a especificação do lote Home + Aceite + Ferramentas. Os demais módulos seguem a sequência por dependência, sem uma troca global de CSS.
