# Benchmark funcional: Cotador FM Clientes → CorreTop

**Data:** 2026-11-11  
**Objetivo:** usar a área Clientes do Cotador FM como referência para ampliar o CRM e a experiência do corretor do CorreTop.  
**Base:** inspeção autenticada da conta de corretor (carteira sem cadastros), rotas visíveis do Cotador FM e leitura do código/documentação existente no CorreTop. Nenhum registro pessoal de cliente foi copiado.

## Resumo executivo

O Cotador FM apresenta Clientes como um espaço de ciclo comercial e relacionamento, não apenas como uma lista de contatos. A navegação observada inclui visão geral, carteira, funil, tarefas/retornos, leads recebidos, base importada, cadastro, etiquetas e clientes antigos. O cadastro combina contato, origem, prioridade, vidas para cotação, retorno e dados de carteira (reajuste, operadora/plano, interesses, etiquetas e observações).

O CorreTop já tem bases fortes para essa direção: área Clientes para o corretor, ficha do cliente, beneficiários, documentos, vendas, renovação, linha do tempo, Leads/funil, cotações/propostas e experiência Lite. O foco recomendado é conectar essas capacidades numa jornada contínua e pessoal para o corretor: localizar cliente, saber o próximo passo, acompanhar proposta/documentação, registrar retorno e conduzir venda e renovação sem duplicar cadastro nem expor dados fora do escopo.

Este documento cobre as nove entradas visíveis da navegação de Clientes, incluindo seus formulários acessíveis sem gravar dados. Em 11/11 a continuação acrescentou Base importada, Clientes antigos, Retornos e tarefas, agendamento múltiplo, CNPJ condicional e etiqueta no próprio cadastro. A conta está vazia: ações de ficha/cartão de registros existentes e etapas posteriores ao upload continuam não observadas. A existência de um botão ou texto de orientação não comprova o processamento no servidor.

## Inventário observado no Cotador FM

### Navegação da área

| Área | Observação direta |
|---|---|
| Visão geral | Resumo de clientes na carteira, cotações salvas, retornos de hoje, negociações, vendas fechadas e valores; bloco “Precisa da sua atenção” com retornos atrasados, proposta aguardando, reajustes próximos e oportunidades abertas; clientes recentes; tarefas de hoje e próximos retornos. |
| Minha carteira | Busca, status comercial, situação de retorno e filtros adicionais; indicação de resultados/vazio. |
| Funil comercial | Quatro agrupamentos: Relacionamento, Implantação, Comissões e Conclusão. Etapas clicáveis filtram o Kanban; há indicadores de oportunidades abertas, implantação, recebido/comissões/premiações e atenção hoje; permite arrastar cliente ou mudar etapa pelo seletor do card. |
| Retornos e tarefas | `/tarefas`: indicadores de pendentes, hoje, atrasadas, próximas, concluídas hoje e produtividade; abas Hoje, Atrasadas, Próximas, Concluídas e Todas; busca, filtros por tipo e prioridade, atualização da lista e criação de uma ou várias tarefas no mesmo formulário. |
| Leads recebidos | Contadores de recebidos, sem contato, contatados, responderam, cotações e convertidos; filtro de status: novo recebido, aguardando contato, mensagem enviada, cliente respondeu, cotação enviada, em negociação, sem retorno, convertido e perdido. |
| Base importada | Base histórica separada da carteira ativa; busca e recortes Disponíveis, No CRM e Todos; indicadores de disponíveis, no CRM, total preservado e aproveitamento. Assistente aceita CSV/XLSX, até 10 MB e limite inicial declarado de 10.000 registros; origem selecionável e botão Ler contatos. A interface orienta promover ao CRM apenas contatos que retomam o fluxo comercial. |
| Novo cliente | Drawer/formulário com os campos listados abaixo. |
| Etiquetas | Biblioteca de classificação com nome obrigatório, descrição, nove cores e catálogo de etiquetas ativas; vazio permite criar etiqueta. |
| Clientes antigos | `/clientes/carteira?historico=sim`: carteira histórica com busca, filtros, Limpar filtros e formulário próprio Cadastrar cliente antigo; mantém Novo cliente como ação separada. O formulário informa que o histórico entra Finalizado e fica fora da produção nova. |

### Cadastro de cliente observado

- **Identificação e contato:** nome obrigatório, WhatsApp, e-mail, cidade e região.
- **Classificação:** tipo (Adesão, Pessoa jurídica/CNPJ ou Pessoa física), prioridade (Baixa, Normal, Alta ou Urgente) e origem obrigatória.
- **Cotação:** lista de idades/vidas que pode preencher automaticamente o Cotador; aceita múltiplas idades.
- **Acompanhamento:** próximo retorno com data e horário.
- **Carteira/renovação:** mês de reajuste, operadora contratada atualmente, plano contratado, uma ou mais operadoras de interesse.
- **Organização:** etiquetas multiuso e observações.
- **Campo condicional confirmado:** selecionar Pessoa jurídica / CNPJ exibe CNPJ. A variação foi aberta e cancelada, sem enviar cadastro.
- **Etiqueta no cadastro:** `+ Nova etiqueta` abre modal com nome e nove cores, ação Criar e selecionar e Cancelar. O modal informa que preserva o cadastro preenchido. A persistência não foi executada.
- **Ajuda de origem:** Indicação e Lead fornecido pela corretora exibem explicação contextual da origem; não surgiram novos campos nessas duas seleções.

### Base importada: separação e reaproveitamento

A página distingue base preservada de carteira ativa. Contadores e filtros separam contatos disponíveis daqueles já no CRM; o percentual de aproveitamento é apresentado como proporção da base levada ao CRM. A tela orienta clicar em um contato para consultar todos os dados preservados, mas não havia contatos para abrir.

O assistente oferece origem **Planilha / outro CRM, HubSpot, RD Station, Pipedrive, Agendor ou Kommo**. Esses nomes são opções da origem do arquivo, não evidência de integração por API ou sincronização com esses serviços. O usuário escolhe CSV/XLSX; `Ler contatos` permanece desabilitado sem arquivo. Não foram observados mapeamento de colunas, deduplicação, prévia, resolução de conflitos, importação final, download de modelo nem exportação.

Para o CorreTop, a oportunidade é uma base de prospecção preservada com promoção explícita para o fluxo ativo. A adoção dessa separação precisa ser conciliada com os cadastros e importadores já existentes; não é uma decisão de criar nova tabela ou novo fluxo.

### Clientes antigos: formulário e regra apresentada

Campos observados: **nome obrigatório, WhatsApp, e-mail, cidade, região, tipo de cliente, data da venda obrigatória, valor mensal, operadora contratada, mês de reajuste, plano contratado e observações**. Há Cancelar e Cadastrar cliente antigo. A seleção de operadora usa o catálogo disponível, e o reajuste aceita Não informado ou janeiro a dezembro.

O aviso informa **status automático Finalizado**, registro marcado como histórico e exclusão dos indicadores de venda nova. Isso diferencia a carteira histórica da base importada: a primeira representa vendas anteriores; a segunda preserva contatos ainda separados do CRM. A execução dessa regra e seus efeitos financeiros não foram testados.

### Retornos e tarefas: agenda e agendamento em conjunto

Tipos disponíveis: **Retornar cliente, Solicitar documentos, Verificar proposta, Acompanhar análise, Confirmar vigência, Verificar comissão e Tarefa personalizada**. Prioridades: Baixa, Normal, Alta e Urgente. Formulário: tipo, prioridade, título, descrição, data e horário e cliente relacionado (campo de busca e seletor com opção Sem cliente relacionado).

`+ Adicionar outra tarefa` adiciona um segundo bloco independente; o título muda para Agendar tarefas, aparecem botões Remover e a ação final mostra Agendar 2 tarefas. Foi confirmada a composição de dois blocos e cancelado o formulário, sem gravar tarefas. Não foi observado limite máximo de blocos, recorrência, edição/conclusão/reagendamento de tarefas existentes ou comportamento de falha parcial do lote.

Na conta vazia, as contagens são zero. A agenda exibe estado Nada por aqui, orientação para criar tarefa ou consultar atrasadas e CTA Nova tarefa. A interface descreve o sino como canal de atenção imediata e a agenda como local de retornos, documentos, propostas e acompanhamentos.

### Filtros observados na carteira

- **Status:** Novo; Contato realizado; Cotação enviada; Negociação; Aguardando documentos; Em digitação; Aguardando assinatura; Pendência; Em análise; Aprovado – aguardando vigência; Aguardando aprovação do gestor; Aguardando primeira comissão; Aguardando segunda comissão; Aguardando premiação; Finalizado; Perdido.
- **Retorno:** atrasados, hoje, sem retorno agendado.
- **Filtros adicionais:** origem, prioridade, mês de reajuste, etiqueta, operadora de interesse, operadora contratada e escopo de carteira (toda, Cotador, clientes antigos).
- **Origens visíveis:** lead fornecido pela corretora, campanha, indicação, cliente antigo/carteira, prospecção própria, Instagram, Facebook, Google, WhatsApp, site/landing page, evento/feira, parceiro e outro.

### Catálogos visíveis

**Cores de etiqueta:** Azul, Verde, Amarelo, Vermelho, Roxo, Rosa, Laranja, Ciano e Cinza. A biblioteca oferece descrição e prévia; o modal dentro do cadastro oferece nome/cor e criação com seleção imediata anunciada.

**Operadoras (41 opções observadas):** AMIL; AMIL DENTAL; ASSIM ODONTO; ASSIM SAÚDE; BRADESCO ODONTO; BRADESCO SAÚDE; CEMERU; EVERCROSS; GS SAÚDE; HAPVIDA NOTREDAME; HEALTH MED; HSMED SAÚDE; KLINI SAÚDE; LEVE DENTAL; LEVE SAÚDE; MAIS DENTAL; MEDSÊNIOR; NOVODENTE; ODONTO EMPRESAS; ODONTOPREV; ÔNIX SAÚDE; ONMED; OPLAN; PLAMER; PORTO SEGURO; PORTO SEGURO - ODONTO; PREVENT SENIOR; SAMIG; SAMOC SAÚDE; SEVEN CLUB; SULAMÉRICA; SULAMÉRICA ODONTO; UNIMED COSTA VERDE; UNIMED DO BRASIL; UNIMED LESTE FLUMINENSE; UNIMED NORTE FLUMINENSE; UNIMED NOVA IGUAÇU; UNIMED ODONTO; UNIMED SERRANA; UNIMED TRÊS RIOS; UNIMED VOLTA REDONDA. Esse catálogo observado na conta/data não comprova abrangência nacional, cobertura comercial ou preços disponíveis.

### Destinos observados de navegação

Além das nove entradas, a visão geral expõe atalhos parametrizados: `/clientes/carteira?retorno=atrasado`, `/clientes/carteira?status=COTACAO_ENVIADA`, `/clientes/carteira?reajuste=proximos`, `/clientes/carteira?grupo=oportunidades` e `/tarefas?filtro=proximas`. Foram identificados como destinos de links, sem validar resultados preenchidos ou a implementação dos filtros no servidor.

## Correspondência com o CorreTop

| Capacidade de referência | Estado identificado no CorreTop | Oportunidade |
|---|---|---|
| Clientes pessoais do corretor | Existe `/clientes`, lista Lite, ficha `/clientes/[clientId]`, renovação e testes. O contrato do Lite registra contato, renovação, vendas, beneficiários, documentos e timeline. | Evoluir a lista para ação/próximo passo, busca e filtros pessoais consistentes, usando a ficha já existente como destino. Validar os filtros atuais em código antes de especificar gap final. |
| Jornada comercial | Existe `/leads`, detalhes, etapas, ações de venda e distribuição; existem telas de propostas e documentos. | Mostrar de forma coesa os estados entre primeiro contato, cotação, negociação, implantação, comissão e conclusão, sem criar um segundo funil concorrente. Fechar lacunas de estado com regras canônicas do domínio. |
| Retorno e tarefas | Há módulo de tarefas e lógica de prioridade/now-items no workspace do corretor. | Ligar cada cliente/lead à próxima ação datada, atrasos e follow-up, com filtros acionáveis e contagens derivadas de consultas reais. |
| Dados de carteira e renovação | Renovação aparece na ficha Lite e no contrato de redesign; leads têm dados de venda/beneficiários. | Consolidar operadora/plano, vigência/reajuste e oportunidades de renovação na ficha, esclarecendo de qual registro cada campo se origina. Não duplicar uma “base de clientes” paralela. |
| Etiquetas | Não foi confirmada uma biblioteca de etiquetas de clientes no módulo CorreTop durante a varredura local limitada. | Verificar schema, filtros, políticas e decisões existentes antes de propor entidade nova. Se ausente, documentar decisão de domínio/configuração, gestão, auditoria e chave Super-admin. |
| Importação e clientes antigos | Não confirmados nesta inspeção do CorreTop. | Descobrir formatos, deduplicação, consentimento, histórico, reativação e auditoria antes de qualquer especificação. |
| Base preservada versus cliente histórico | O benchmark distingue contato importado ainda fora do fluxo e venda antiga finalizada sem produção nova; a correspondência com o modelo local não foi concluída. | Verificar como importadores, clientes, vendas e métricas do CorreTop representam origem histórica; propor critérios que evitem inflar produção e metas. |
| Agendamento de várias tarefas | O Cotador permite compor vários blocos antes do envio; paridade local desse formulário não confirmada. | Avaliar o ganho para a rotina de implantação, com validação por item, feedback de falha parcial e prevenção de duplicidade. |
| Versão do corretor | Existe plano de resumo individual, carteira pessoal, cotações, documentos, clientes, metas e notificações. | Usar essa experiência como home de execução: “o que fazer agora”, fila própria, cotações pendentes, documentos e renovação. Sem métricas ou clientes de outros corretores. |

Arquivos e áreas locais consultados: `src/app/(dashboard)/clientes`, `src/features/broker-workspace`, `src/app/(dashboard)/leads`, `src/app/(dashboard)/propostas`, `src/app/(dashboard)/documentos`, `docs/product/corretor-resume-dashboard-plan.md`, `docs/business-rules.md` e `docs/ux/UX_REDESIGN_CONTROL.md`.

## Sequência sugerida

### P0 — fechar descoberta e definir jornada canônica

1. As nove entradas visíveis já foram inspecionadas. Para completar estados preenchidos, será necessário um cadastro disponível na conta: ficha/edição, menus de cartão, transições, contato importado e tarefa existente. O mapeamento posterior ao upload depende de arquivo; nenhum upload ou cadastro foi executado nesta descoberta.
2. Auditar no CorreTop os componentes e serviços de clientes, propostas, renovação, tarefas e etiquetas; confirmar o que já é funcional por papel e feature flag.
3. Desenhar o mapa de estados do cliente/proposta e as transições válidas usando `docs/business-rules.md`; identificar divergências com o funil de leads e levar decisões pendentes ao `docs/decision-log.md` antes de implementar.

### P1 — completar o posto de trabalho do corretor

1. Lista pessoal com busca, filtros úteis e estados operacionais: atrasado, hoje, sem retorno, cotação pendente, documentação pendente, negociação e renovação próxima.
2. Ficha com próxima ação, dados de contato com privacidade adequada, origem, prioridade, beneficiários/vidas, histórico, cotação/proposta, documentos e renovação, usando capacidades existentes.
3. Retorno/tarefa vinculado ao cliente, com data, lembrete e timeline auditável; contagens e atalhos da visão geral devem abrir a lista já filtrada.
4. Jornada/funil coerente e acionável. Avaliar Kanban para o corretor como decisão de produto; não copiar drag-and-drop sem confirmar permissões, estados, feedback e recuperação.

### P2 — qualidade da carteira e escala

1. Etiquetas pessoais/da organização somente após decisão de escopo e modelo; edição controlada, auditada e desativável por Super-admin.
2. Importação de clientes com prévia, validação, deduplicação, relatório de erros e auditoria; evitar escrita até as regras de conflito e base legal estarem definidas.
3. Histórico/reativação de clientes antigos e rotinas de reajuste/renovação com parâmetros configuráveis, trilha de origem e controle reversível.
4. Indicadores do corretor apenas com métricas canônicas, pessoais e explicáveis; detalhes financeiros dependem das regras de comissão já aprovadas.

## Guardrails de produto e engenharia

- Escopo multi-tenant sempre vem da sessão do servidor. Corretor só pode ler/alterar os próprios clientes e leads conforme `BR-001` a `BR-005`; nunca aceitar `tenant_id`, responsável ou papel enviado pelo navegador como autoridade.
- Validar entradas no servidor; auditar alterações de contato, exportações, permissões, importações e dados sensíveis sem gravar PII em claro nos logs.
- Toda capacidade nova precisa de configuração/editabilidade e interruptor efetivo do Super-admin, com auditoria imutável, conforme `AI_RULES.md`.
- Reutilizar UI compartilhada. Para qualquer mudança visual, registrar papel, ação principal, estados e disclosure no controle da etapa atual. Não adicionar tokens/primitives sem gap e decisão.
- Não copiar registros reais do Cotador FM para desenvolvimento, fixtures ou documentação. Usar somente dados sintéticos.
- Nenhuma regra pendente em `docs/decision-log.md` vira comportamento até decisão registrada.

## Questões a resolver antes de implementar

1. “Cliente” deve ser um cadastro independente do lead, ou uma identidade de cliente criada/atualizada ao converter o lead? Recomendação de investigação: preservar uma única identidade e manter histórico de conversão, sem duplicar contato.
2. Etiquetas são pessoais do corretor, compartilhadas pela corretora, ou ambas com escopos separados?
3. Importação inclui clientes antigos e leads ativos? Qual regra resolve duplicidade por telefone/e-mail e qual é a fonte de verdade para correção?
4. Quais campos de operadora/plano/vigência são confirmados pelo corretor versus derivados da venda/proposta?
5. O que é exportável por corretor e quais campos devem ser omitidos/mascarados?

## Limites deste relatório

Evidência da continuação e limitações da verificação local: `reports/agent/verification/2026-11-11-cotadorfm-clientes-observacao.md`. Entrega documental; nenhuma implementação, upload ou gravação de cadastro no Cotador FM foi realizada. Verificação documental e TypeScript passaram; validação global ficou incompleta após falhas fora dos arquivos alterados, sem execução de build.

- O Cotador FM apresentava zero clientes e zero atividades nas páginas acessadas; estados preenchidos, edição de registros, eventos e resultados de importação não puderam ser observados.
- Não foi feita automação de scraping nem leitura de banco/API do Cotador FM. O inventário foi manual, via interface autenticada.
- Todas as entradas visíveis da navegação de Clientes foram percorridas; ficha/edição de cliente, tarefa existente e etapas posteriores ao upload permanecem não observadas, pois não havia registros nem arquivo em processamento. Não foi comprovada exportação, exclusão, anexos, histórico de alterações ou API de nenhuma dessas áreas.
- A varredura local do CorreTop foi documental e exploratória, não uma auditoria completa de cada servidor/ação; “não confirmado” significa que precisa de verificação, não que inexista.
