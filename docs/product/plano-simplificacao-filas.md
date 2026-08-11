# Plano de simplificação das filas operacionais

> **Estado:** proposta de produto; não altera permissões ou regras em produção.  
> **Data:** 11/08/2026  
> **Escopo:** filas de leads e suas exceções operacionais. Filas de documentos, tarefas, conversas e financeiro seguem o mesmo vocabulário, mas terão evolução própria.

## Resumo executivo

Hoje a corretora possui uma base sólida para receber, encaminhar, atribuir e redistribuir leads. O problema não é falta de recursos: uma mesma área mistura quatro objetivos diferentes — decidir o destino de um lead, configurar a capacidade da unidade, organizar plantões e acompanhar a saúde da automação.

Para a operação, isso transforma a palavra “fila” em algo ambíguo. Pode significar a entrada central da corretora, uma fila de uma unidade, a carteira de um corretor, a escala de plantão ou uma exceção técnica. O plano propõe separar esses significados em uma experiência única de **Central de Filas**, orientada por ação e responsabilidade.

O resultado esperado é simples: cada papel enxerga somente as filas sobre as quais pode agir, entende por que um item está parado e consegue resolver a pendência sem procurar entre telas de configuração.

## Diagnóstico do estado atual

### O que já está em funcionamento

- Leads sem unidade entram na fila central da corretora e aguardam encaminhamento pelo Diretor.
- Depois de vinculados a uma unidade, os leads podem ficar aguardando corretor ou ser atribuídos manualmente e automaticamente conforme disponibilidade, capacidade e política da fila.
- A operação registra os movimentos relevantes e preserva histórico para auditoria.
- Há controles por unidade para receber leads, ativar a distribuição automática, acompanhar corretores disponíveis e consultar pendências do processamento.
- Plantões podem ser criados por unidade e fila, com horário, prioridade, vigência, mínimo de corretores e cobertura.
- O Supervisor já existe como papel local: acompanha a equipe e pode gerenciar corretores da própria unidade, mas não distribui, reatribui, cria filas ou altera regras de distribuição.

### Onde a experiência perde clareza

| Problema | Efeito na operação |
|---|---|
| “Fila” é usada para entrada, distribuição, carteira, plantão e exceção. | A pessoa precisa descobrir qual tela resolve o problema antes de poder agir. |
| A tela de distribuição reúne Inbox, configuração de unidade, equipe e saúde técnica. | A rotina de encaminhar um lead concorre visualmente com decisões menos frequentes de configuração. |
| O plantão é configurado em uma área própria, mas depende de unidade e fila. | A relação entre cobertura e capacidade de distribuição não é imediata. |
| A automação possui fila persistente e recuperação, porém a contingência de agendamento diário não atende ao SLA de distribuição contínua. | O status “automático” pode ser interpretado como atendimento em tempo real quando a operação ainda pode exigir intervenção manual. |
| O Supervisor vê riscos da equipe, mas não tem uma fila de supervisão explícita. | O papel recém-criado pode parecer apenas um Gestor com menos botões, em vez de ter uma rotina clara de acompanhamento e escalonamento. |

## Princípios da nova central

1. **Uma fila tem um propósito.** O nome deve responder se ela é trabalho para atender, decisão para encaminhar, exceção para corrigir ou regra para configurar.
2. **A ação vem antes da métrica.** Contagem, idade do item mais antigo e próximo passo aparecem juntas.
3. **Operação e configuração não disputam espaço.** Resolver leads fica em “Operar”; regras, capacidade e plantões ficam em “Configurar”.
4. **Escopo por papel é visível.** Quando alguém não puder concluir uma ação, a interface explica quem pode e para onde escalar.
5. **Estado real, não promessa.** A saúde da automação informa se o motor está contínuo, em contingência, pausado ou com exceções.
6. **Toda mudança sensível deixa rastro.** Encaminhamento, atribuição, reatribuição, pausa e edição de regra continuam auditáveis e reversíveis quando o domínio permitir.

## Modelo de filas proposto

### 1. Central de ação

Esta é a página diária. Não configura regras; ela transforma pendências em trabalho claro.

| Fila | Dono principal | O que aparece | Ação principal |
|---|---|---|---|
| Sem unidade | Diretor | Leads recebidos sem destino de unidade. | Encaminhar para uma unidade. |
| Sem corretor | Gestor da unidade | Leads já encaminhados e sem responsável. | Atribuir ou usar distribuição automática. |
| Devolvidos à fila | Gestor da unidade | Leads que retornaram por SLA, indisponibilidade ou exceção. | Revisar causa e redistribuir. |
| Em risco de SLA | Supervisor e Gestor | Leads próximos ou além do prazo de primeiro contato. | Orientar o corretor ou escalar a decisão. |
| Sem próxima ação | Supervisor e Gestor | Leads ativos sem atividade ou tarefa futura. | Criar/solicitar próximo passo. |
| Cobertura insuficiente | Gestor | Plantões abaixo do mínimo configurado. | Ajustar escala ou capacidade. |
| Exceções da automação | Diretor; Gestor apenas na própria unidade quando aplicável | Falhas e tentativas esgotadas. | Reprocessar, corrigir regra ou escalar. |

Cada cartão de fila deve mostrar: quantidade real, idade do item mais antigo, unidade, motivo do estado e uma ação direta. A lista aberta preserva esse filtro e começa pela maior urgência.

### 2. Espaço de configuração

Esta área é acessada quando a regra precisa mudar, não no meio do atendimento de uma pendência.

| Seção | Decisão que concentra |
|---|---|
| Unidades e capacidade | Unidade aceita leads? Há corretores ativos, disponíveis e dentro da capacidade? |
| Regras de distribuição | Qual fila recebe, qual estratégia é usada e quais critérios de elegibilidade valem? |
| Plantões e cobertura | Quem está de plantão, em qual período, para qual origem e qual fila? |
| Saúde da automação | O motor está ativo, em contingência, pausado ou com exceções? Qual o próximo responsável? |
| Histórico | Quem mudou uma regra, moveu um lead ou reprocessou uma exceção? |

As configurações devem usar URLs próprias ou estado persistente. Assim, um link para “Plantão da Unidade Centro” abre exatamente o contexto que a pessoa precisa revisar.

### 3. Fila de supervisão

O Supervisor não deve ganhar permissão indireta para distribuir leads apenas para ter uma página útil. A sua visão deve ser uma fila de acompanhamento da equipe local:

- corretores com leads sem primeiro contato;
- corretores com carteira estagnada ou sem próxima ação;
- documentos ou tarefas que estão bloqueando a evolução de um lead;
- alertas que exigem orientação imediata;
- atalho de escalonamento para o Gestor ou Diretor quando a solução depende de fila, atribuição ou regra.

Essa separação torna explícito o papel intermediário: o Supervisor observa, orienta e acelera a resolução; o Gestor decide sobre distribuição dentro da unidade; o Diretor resolve a fila central e as exceções que cruzam unidades.

## Matriz de responsabilidade proposta

| Ação | Diretor | Gestor | Supervisor | Corretor |
|---|---|---|---|---|
| Encaminhar lead sem unidade | Executa | Não visualiza a fila central | Não visualiza a fila central | Não visualiza |
| Atribuir ou reatribuir lead da unidade | Executa | Executa na própria unidade | Escalona | Não executa |
| Configurar fila, capacidade e plantão | Executa | Executa na própria unidade | Consulta contexto e escala | Não executa |
| Acompanhar risco da equipe | Executa | Executa | Executa na própria unidade e equipe vinculada | Acompanha a própria carteira |
| Corrigir exceção da automação | Executa | Trata as da própria unidade quando permitido | Escalona | Não executa |

Esta matriz descreve o comportamento atual desejado para a experiência. Qualquer ampliação de poderes do Supervisor deve passar por decisão de produto, autorização no servidor, auditoria e controle reversível pelo Super-admin.

## Plano de entrega em quatro etapas

### Etapa 0 — confirmar a operação antes de redesenhar

1. Validar em produção a frequência efetiva do processador de distribuição e deixar visível quando ele estiver em contingência.
2. Conferir a regra atual para retorno por SLA, principalmente a diferença entre leads originados pelo Diretor e pelo Gestor.
3. Confirmar com a operação os nomes que as pessoas usam no dia a dia para “fila”, “plantão”, “pendência” e “exceção”.
4. Registrar uma decisão sobre qualquer novo poder do Supervisor. Não usar a interface para antecipar uma permissão não aprovada.

**Saída:** glossário de filas, matriz de papéis validada e lista de estados reais que cada fila pode exibir.

### Etapa 1 — tornar a operação legível

1. Transformar a área atual em “Central de Filas”, abrindo por padrão a Central de ação.
2. Criar as filas nomeadas acima com contagens reais, maior tempo em espera e CTA direto.
3. Separar a configuração em uma segunda navegação: Unidade e capacidade, Regras, Plantões, Saúde e Histórico.
4. Padronizar os estados visíveis: aguardando unidade, aguardando corretor, devolvido, em processamento, falhou e resolvido.

**Critério de aceite:** Diretor, Gestor e Supervisor conseguem apontar a pendência mais urgente e chegar ao registro correto em até dois cliques.

### Etapa 2 — tornar a configuração segura

1. Criar uma visão-resumo por unidade: recebimento, corretores elegíveis, capacidade, plantão vigente e itens parados.
2. Exibir o impacto antes de salvar uma regra: quem deixa de receber, quais filas são afetadas e se haverá cobertura insuficiente.
3. Mostrar mudanças recentes e permitir reverter apenas as regras que o domínio já trata como reversíveis.
4. Garantir que toda edição preserve escopo de tenant e unidade, auditoria e controle do Super-admin.

**Critério de aceite:** uma pessoa autorizada consegue explicar o efeito de uma regra antes de publicá-la e localizar quem a alterou depois.

### Etapa 3 — dar rotina própria ao Supervisor

1. Criar “Minha supervisão” como entrada diária do papel, usando apenas dados da unidade e dos corretores vinculados.
2. Priorizar risco de SLA, estagnação, ausência de próxima ação e pendências bloqueadoras.
3. Oferecer ações de orientação e escalonamento com contexto, sem botões de distribuição que o papel não pode concluir.
4. Medir se os alertas geram ação ou apenas leitura; remover sinais que não levam a uma decisão.

**Critério de aceite:** o Supervisor sabe quais corretores precisam de intervenção e para quem escalar cada tipo de problema sem recorrer a planilhas ou mensagens paralelas.

## Indicadores de impacto

- tempo entre entrada do lead e primeira atribuição;
- percentual de leads sem primeiro contato dentro do SLA;
- idade média e máxima de cada fila operacional;
- quantidade de leads devolvidos e motivo de devolução;
- cobertura de plantão e tempo até correção de cobertura insuficiente;
- percentual de exceções automáticas resolvidas sem intervenção do Diretor;
- tempo para Supervisor identificar e escalar um risco da equipe;
- ações concluídas a partir das filas, em vez de apenas visualizações.

Os indicadores devem ser sempre apresentados com período, unidade e origem dos dados. Eles não devem expor dados pessoais desnecessários.

## Decisões que permanecem necessárias

1. O Supervisor poderá apenas visualizar a fila da unidade ou também sugerir uma atribuição para aprovação do Gestor?
2. Em contingência de automação, quem recebe a responsabilidade explícita de operar a fila manualmente e em qual prazo?
3. A “fila sem próxima ação” será definida por ausência de tarefa, ausência de contato, ambos ou regra por etapa comercial?
4. Qual é o limite operacional aceitável de idade para cada fila, por origem de lead e horário de plantão?

Essas respostas devem entrar no registro de decisões antes de se alterar permissões, automações ou regras de redistribuição.

## Referências consultadas

- `docs/lead-distribution-implementation-status.md`
- `docs/relatorio-fluxo-atendimento-completo.md`
- `docs/business-rules.md`
- `docs/decision-log.md` — em especial DEC-027, DEC-042, DEC-059, DEC-060 e regras de plantão
- `docs/ux-audit-2026-07-13.md`
- `src/features/lead-distribution/service.ts`
- `src/features/lead-distribution/jobs.ts`
- `src/app/(dashboard)/leads/distribuicao/`
- `src/features/team/supervisor-service.ts`
- `src/shared/auth/team-permissions.ts`
- `src/shared/auth/permissions.ts`
