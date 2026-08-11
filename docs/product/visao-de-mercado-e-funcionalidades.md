# AncoraHub: visão de mercado, funcionalidades e impacto operacional

## Resumo executivo

O AncoraHub é uma plataforma operacional para corretoras de planos de saúde. Sua proposta não é apenas armazenar contatos: ela estrutura o ciclo comercial completo, desde a entrada de uma oportunidade até a venda, a carteira ativa e a renovação.

Na prática, a plataforma busca reduzir três perdas recorrentes em corretoras: leads sem primeiro contato, atendimento sem continuidade e decisões gerenciais baseadas em informação dispersa. Para isso, centraliza fila comercial, distribuição, atendimento, cotações, documentação, venda, comissões, comunicação e governança em um único ambiente com visões adequadas a cada papel.

O produto foi desenhado para operações com uma ou várias unidades. Cada corretora opera em seu próprio ambiente, e Diretor, Gestor, Supervisor e Corretor enxergam somente o que é necessário para executar seu trabalho.

## Para quem o produto existe

| Público | Problema principal | Resultado esperado com o AncoraHub |
|---|---|---|
| Diretor | Perder controle sobre operação, equipe, risco comercial e dados da corretora. | Visão consolidada, regras operacionais, configuração da empresa e rastreabilidade das decisões. |
| Gestor | Não saber quais exceções exigem intervenção e quem deve agir. | Gestão por unidade, distribuição, acompanhamento de SLA, correção de filas e supervisão da equipe. |
| Supervisor | Perder o contexto do trabalho dos corretores e descobrir atrasos tarde demais. | Visão da equipe local, acompanhamento de risco, orientação e escalonamento rápido para o Gestor ou Diretor. |
| Corretor | Alternar entre listas, mensagens, anotações e planilhas para atender clientes. | Uma fila priorizada, próximo passo claro, histórico do lead e continuidade até a venda. |
| Marketing | Captar oportunidades sem perder origem, campanha ou unidade responsável. | Entrada rastreável de leads, contexto de campanha e acompanhamento do resultado comercial. |
| Financeiro | Conferir vendas, comissões e valores previstos sem reconstruir dados manualmente. | Visão de vendas, cronogramas de repasse, comissões e relatórios no escopo autorizado. |
| Super-admin da plataforma | Liberar recursos e proteger a operação de todas as corretoras. | Controles globais, configurações por empresa, auditoria e possibilidade de desligar capacidades sem apagar histórico. |

## O que o sistema se propõe a fazer

O AncoraHub organiza a corretora como uma operação contínua:

1. Receber e registrar oportunidades de forma rastreável.
2. Encaminhar cada oportunidade para a unidade e o corretor adequados.
3. Garantir que o primeiro atendimento ocorra dentro do prazo definido pela corretora.
4. Ajudar o corretor a decidir o próximo passo, registrar contatos e avançar o funil.
5. Transformar atendimento em cotação, documentação, venda e cliente ativo sem perder o histórico.
6. Acompanhar carteira, renovação, comissões e desempenho comercial.
7. Dar à liderança condições de detectar gargalos antes que eles virem perda de receita.

## Jornada comercial ponta a ponta

### 1. Captação e entrada de leads

Leads podem ser criados manualmente ou recebidos por fontes autenticadas, incluindo formulários e integrações de captação. O sistema guarda origem, campanha, anúncio, formulário e data de entrada quando essas informações estiverem disponíveis.

**Impacto:** reduz a dependência de planilhas e encaminhamentos manuais; identifica a origem das oportunidades; preserva o histórico de entrada para análise comercial e auditoria.

### 2. Qualificação inicial

O produto comporta uma qualificação estruturada para identificar o perfil inicial do interessado, como pessoa física ou empresa, quantidade de vidas, idades e outras informações necessárias à cotação. A qualificação é separada do status comercial: um lead pode estar qualificado sem ter avançado no funil.

Quando a capacidade de IA e o canal oficial estão adequadamente configurados, a IA pode apoiar uma triagem inicial curta. Ela não substitui a decisão comercial nem assume transferências, responsável ou status crítico sem regra e autorização.

**Impacto:** atendimento começa com contexto; corretores recebem demandas mais compreensíveis; a equipe mede o perfil da demanda sem depender de memória individual.

### 3. Distribuição, plantão e SLA

O sistema distribui leads considerando regras de unidade, disponibilidade, carga de trabalho e políticas da operação. Há suporte para fila geral quando a unidade não está definida, distribuição por rodada entre elegíveis e plantões recorrentes por unidade.

Dois controles são centrais: o SLA de primeiro contato monitora se alguém iniciou o atendimento no prazo e a estagnação identifica oportunidades que permaneceram tempo demais em uma etapa, mesmo quando já houve interação. Em caso de atraso, a operação pode ser alertada e o lead pode voltar para redistribuição conforme as regras da corretora.

**Impacto:** reduz perda por demora no primeiro contato; evita concentração invisível de carteira; torna o trabalho de gestão baseado em exceções concretas.

### 4. Atendimento e gestão do funil

No detalhe do lead, o corretor encontra a identidade do contato, situação atual, prazo, responsável, origem, tarefas, histórico e os próximos passos permitidos. A jornada comercial é organizada em etapas e cada alteração relevante fica registrada na linha do tempo.

O sistema diferencia ações rotineiras de decisões críticas. Perda exige motivo. Reabertura e reatribuição ficam nas mãos da gestão. Conversão não é um simples clique: exige informações que comprovem a venda.

**Impacto:** reduz abordagens desconectadas; aumenta previsibilidade do funil; preserva contexto quando há troca de corretor ou intervenção gerencial.

### 5. Cotações, propostas e documentação

O AncoraHub permite montar cotações por faixa etária, operadora, plano e beneficiários. As condições usadas permanecem vinculadas ao histórico da oportunidade, evitando que uma atualização de tabela altere retrospectivamente uma proposta já apresentada. Há suporte para compartilhamento controlado de proposta e geração de PDF.

Documentos podem ser vinculados ao lead e aos beneficiários. A lista de exigências pode variar de acordo com operadora e plano. Pendências, rejeições e aprovações ficam organizadas para que a venda não avance sem a documentação requerida.

**Impacto:** reduz o retrabalho de montar propostas em ferramentas paralelas; diminui pendências descobertas tarde; protege documentos sensíveis em um fluxo autorizado.

### 6. Venda, cliente ativo e pós-venda

Uma oportunidade só se converte em cliente quando a venda tem evidências necessárias, como operadora, apólice, vigência, valor final e documentação aplicável. A conversão cria a base para cliente ativo e preserva a origem do relacionamento.

Após a venda, a corretora pode consultar dados do cliente, vendas, documentos, histórico e proximidade da renovação. Cancelamento preserva o histórico e não altera valores automaticamente sem decisão operacional.

**Impacto:** conecta aquisição e retenção; permite acompanhar renovação com antecedência; transforma vendas passadas em carteira gerenciável.

### 7. Comissões, financeiro e metas

O módulo financeiro acompanha regras de comissão por operadora ou plano, cronograma de parcelas, valores previstos e pagamentos marcados de forma rastreável. Relatórios e exportações são limitados ao papel e ao escopo do usuário.

Metas podem ser tratadas por corretor, equipe e unidade. A plataforma também possui uma base para temporadas de desempenho e reconhecimento, sem confundir ranking com pagamento financeiro automático.

**Impacto:** melhora a conferência entre venda, comissão e pagamento; reduz discussões baseadas em versões diferentes de planilhas; dá visibilidade para desempenho sem eliminar a autoridade financeira humana.

### 8. Comunicação, WhatsApp e notificações

O produto possui uma central de conversas, notificações internas e caminhos para canais oficiais de WhatsApp. A experiência de chat não deve simular mensagens quando não houver canal configurado: nesse caso, o sistema direciona o corretor para a forma de contato autorizada.

O canal oficial prioriza segurança, consentimento, rastreabilidade e regras de janela de atendimento. Envios relevantes usam processamento controlado para evitar duplicação, e a IA, quando ativa, atua apenas dentro dos limites aprovados.

**Impacto:** reduz perda de contexto entre atendimento e CRM; aumenta a capacidade de resposta; protege a operação contra dados expostos e automações sem supervisão.

### 9. Marketing e origem comercial

Para operações que usam Meta e outras fontes, o sistema organiza campanhas, anúncios, formulários, importações e identificação da origem do lead. A intenção é ligar investimento de captação à oportunidade e, posteriormente, ao resultado comercial.

**Impacto:** ajuda a avaliar qualidade de campanha, não somente quantidade de leads; aproxima Marketing e Comercial sem abrir acesso indevido à carteira; permite atribuir a entrada a uma unidade ou fluxo específico.

## Gestão e governança da corretora

### Unidades, equipe e permissões

O modelo operacional separa empresa, unidade, equipe e carteira. Diretor administra a corretora, Gestor atua no recorte de sua unidade e Corretor acessa sua própria carteira. Cargos especializados podem receber capacidades adicionais quando aprovados pela configuração da empresa.

### Visões de gestão

Diretores e Gestores contam com dashboards, relatórios, visão de unidades e um NOC operacional. Supervisores acompanham os sinais operacionais e os corretores da própria unidade, sem assumir as permissões de distribuição e configuração. Essas superfícies mostram volume, risco de SLA, fila sem responsável, capacidade da equipe e outros sinais que orientam intervenção.

O objetivo não é criar um painel decorativo. É responder: onde há risco, quem pode agir agora e qual fila precisa de atenção.

### Segurança, privacidade e auditoria

O AncoraHub foi desenhado como ambiente segregado por corretora. Dados, permissões e ações operacionais são filtrados pelo contexto autenticado, não por informação enviada pelo navegador.

Para a operação, isso se traduz em acesso limitado por papel, unidade e carteira; proteção de dados pessoais e documentos; histórico de ações relevantes; controles reversíveis pelo Super-admin; e possibilidade de desligar uma capacidade sem apagar o histórico que ela produziu.

## Mapa de maturidade atual

| Área | Situação | Leitura de negócio |
|---|---|---|
| Núcleo de leads, funil e distribuição | Operacional | É a base mais madura do produto e atende a rotina de captação, atribuição e atendimento. |
| SLA, tarefas, timeline e supervisão | Operacional | Permite gerenciar continuidade e exceções na rotina comercial. |
| Cotações, documentos, vendas e clientes | Operacional | Suporta o caminho comercial até a carteira ativa, com controles de validação. |
| Comissão, metas e relatórios | Operacional com evolução contínua | Entrega a base de gestão e conferência, com possibilidades de aprofundar análises. |
| Unidades, equipe, cargos e permissões | Operacional | Sustenta expansão de equipe e filiais com escopo de acesso definido. |
| Notificações e central de conversas | Operacional, dependente de canal para comunicação completa | A coordenação está disponível; o envio oficial depende de configuração e homologação do canal. |
| Meta Ads e captação integrada | Parcial/piloto conforme empresa | A disponibilidade depende de ativação e integração válida. |
| IA de qualificação e atendimento | Parcial e controlada | Pode apoiar a entrada e triagem dentro de regras de consentimento e supervisão, sem autonomia comercial irrestrita. |
| NOC, ranking e automações avançadas | Parcial | Já orientam operação, mas ainda evoluem em ações de intervenção, cobertura e integrações. |
| Módulos exibidos como preparados | Não são capacidade comercial entregue | Não devem compor a promessa ao cliente até que o fluxo esteja completo. |

## Limites importantes para comunicação de mercado

O AncoraHub deve ser apresentado como CRM operacional para corretoras, e não como uma promessa de automação ilimitada.

- A IA não substitui o corretor, nem deve tomar sozinha decisões de responsável, transferência, mudança crítica de status ou venda.
- WhatsApp oficial e integrações de anúncios dependem de configuração, aprovação e regras dos provedores externos.
- Recursos em piloto ou sujeitos a liberação do Super-admin podem não estar ativos em todas as corretoras.
- Relatórios e indicadores são úteis quando baseados em dados reais da operação. O sistema evita utilizar métricas meramente decorativas.
- Governança e privacidade fazem parte do produto: não são complementos opcionais para uma operação que trabalha com dados pessoais e de saúde.

## Impacto esperado dentro da corretora

Quando implantado com processos definidos, o AncoraHub tende a gerar impacto em cinco dimensões:

1. **Velocidade de resposta:** diminui o tempo entre captação e primeiro contato.
2. **Conversão:** reduz oportunidades esquecidas, sem dono ou sem próximo passo.
3. **Produtividade:** concentra fila, contexto, tarefas e histórico no mesmo ambiente.
4. **Gestão:** transforma exceções de operação em filas visíveis e tratáveis.
5. **Confiabilidade:** preserva histórico, escopo de acesso e evidências em processos sensíveis.

O ganho real não vem de substituir julgamento comercial por software. Vem de dar ao time um método comum para capturar, atender, decidir e acompanhar, sem perder o contexto de cada cliente ou a responsabilidade de cada etapa.

## Como avaliar o sucesso da implantação

Uma corretora deve acompanhar, no mínimo:

- tempo de primeiro contato;
- percentual de leads sem responsável ou estagnados;
- conversão por origem, unidade e corretor;
- volume de propostas emitidas e taxa de avanço para venda;
- pendências documentais por etapa;
- vendas, comissão prevista, comissão paga e divergências;
- renovações acompanhadas antes do vencimento;
- adoção da equipe: tarefas registradas, histórico atualizado e uso da fila como fonte de trabalho.

Esses indicadores tornam a adoção mensurável. Se o time ainda atende fora do fluxo, a corretora pode identificar se o problema está em processo, treinamento, configuração ou cobertura de produto.
