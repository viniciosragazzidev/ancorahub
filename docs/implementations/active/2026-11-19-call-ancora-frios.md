# Call Âncora: entrada imediata da base de frios

Data: 19/11/2026
Status: plano de operação para a fila real do Call Âncora. A implementação da fila está sendo feita por outro agente; este documento não altera código.

## Decisão atual

O Call Âncora passa a receber os leads frios elegíveis assim que entram no pool. Para esses leads, a espera de dois dias e a liberação diária às 9h deixam de ser a porta de entrada. A origem de aquisição do lead permanece intacta. Quando o corretor registrar **Com interesse**, o lead existente será atribuído a ele pelo caminho canônico de atribuição, com atualização condicional no banco.

Nesta etapa não se cria migration nem se grava no banco. A reserva temporária está sendo implementada em memória. Esta escolha é suficiente apenas para a instância/processo atual e tem os limites descritos em “Riscos e contenções”.

## 1. Definição do pool

O pool é uma seleção global por tenant sobre `leads`, não uma tabela nova de contatos. O lead continua com seu `queue_id` e sua unidade efetiva (`COALESCE(leads.branch_id, lead_queues.branch_id)`) para auditoria e para a atribuição final.

Critérios recomendados para entrar no pool:

- `qualification_status = 'cold'` e sem qualificação em andamento; `PARTIAL` segue a retenção configurada para a fila, igual ao seletor real da liberação de frios;
- lead ainda não entregue: sem `corretor_id`, sem `assigned_at`, sem evento de distribuição com `new_owner_id`, `redistribution_count = 0`;
- etapa operacional aberta (`status = 'new'`) e estado de distribuição elegível (`unassigned`, `queued` ou `distribution_failed`);
- fila ativa do mesmo tenant e configuração da fila habilitada para liberação de frios;
- sem `distribution_removed_at`, `archived_at` ou `deleted_at`; `manual_hold`, convertido, perdido, em análise, aguardando retorno e já atribuído ficam fora;
- telefone normalizado válido. A reserva deve ser deduplicada por tenant + lead e, como proteção adicional, por tenant + telefone normalizado para impedir duas ligações ao mesmo número cadastrado em leads diferentes;
- excluir pedidos explícitos de não contato e número inválido já conhecidos. Não interpretar automaticamente uma recusa a uma pesquisa de pós-venda como um pedido global para nunca ligar: a abrangência precisa ser explícita.

O filtro de dois dias (`cold-age-release-rules.ts`) é removido apenas para o pool do Call Âncora. Os outros canais de distribuição continuam com a regra atual. A configuração `holdColdLeads` da fila permanece respeitada nesta seleção, assim como o `manual_hold`; não usar a fila de chamadas para contornar retenções administrativas ou de qualificação.

Não apagar leads quando alguém classificar **Número errado**. Retirar o telefone do pool, gravar uma supressão auditável e manter o registro original para histórico e correção.

## 2. Dados e atribuição

Sem DDL nesta etapa. A fila temporária reutiliza a seleção existente da liberação das 9h; não introduzir tabela ou campo no banco.

O estado da reserva em memória precisa conter, no mínimo: tenant, lead, sessão, corretor autenticado, aparelho/linha lógica, hora da reserva, expiração e versão. Não guardar telefone em log. A reserva não pode aceitar `tenantId`, `brokerId` ou telefone como autoridade enviados pelo cliente: derivar tenant e corretor da sessão autenticada e recarregar o lead em escopo de tenant.

Para **Com interesse**, reutilizar o serviço canônico de atribuição, sem inserir um lead duplicado. O vencedor atualiza `corretor_id`, `assigned_at`, `status` e `distribution_status` conforme o fluxo existente; registra `lead_distribution_events` e auditoria; encerra a reserva. A atualização condicional precisa confirmar uma linha retornada. Uma segunda classificação concorrente deve receber “lead já atribuído” e não repetir evento, notificação ou atribuição.

Registrar `assignment_source = 'call_ancora'` e `lead_distribution_events.source = 'call_ancora'` se o tipo do serviço permitir. Preservar `leads.origem`, `source_channel` e `source_campaign`, que indicam como o contato foi adquirido. A expressão “origem Call Âncora” na interface deve significar canal de atribuição/contato, não sobrescrever a origem original.

## 3. Reserva e concorrência no MVP

O agente do app está usando reserva em memória. Dentro do mesmo processo, a operação precisa ser atômica: selecionar o próximo lead e registrá-lo como reservado sob a mesma trava, sem `await` entre a decisão e a reserva. Uma barreira em teste deve disparar duas chamadas concorrentes e provar que só uma recebe o mesmo lead. Leads distintos ainda podem ser entregues a duas sessões.

A atribuição final é uma segunda defesa no Postgres: atualização condicional do lead ainda sem corretor, com tenant e estado esperado, seguida de verificação de `RETURNING`. Isso evita dois donos, mas não evita duas ligações antes de alguém demonstrar interesse.

Expiração recomendada: reserva não discada vence em 2 minutos; reserva em chamada usa heartbeat do aparelho e vence após 5 minutos sem sinal. Ao expirar antes da discagem, devolver o lead ao início do pool. Ao perder heartbeat durante chamada, não rediscá-lo imediatamente: marcar como resultado incerto e aguardar pelo menos 24 horas. Os prazos precisam ser configuráveis no servidor e não podem depender só do relógio do navegador.

Critérios de teste da etapa do app:

1. duas sessões pedem o próximo sob barreira: o mesmo lead não é entregue às duas;
2. falha ou expiração antes da discagem devolve o lead uma vez;
3. duas classificações **Com interesse** simultâneas: somente uma atribui e registra evento;
4. a distribuição normal tenta atribuir enquanto o lead está reservado: nenhuma atribuição concorrente; se a arquitetura em memória não conseguir coordenar esse caso, o item permanece bloqueado para escala;
5. tenant A não recebe nem reserva lead do tenant B;
6. leads com telefone duplicado são serializados no mesmo tenant.

## 4. Classificações e convivência com frios/requalificação

| Classificação | Efeito recomendado |
|---|---|
| **Com interesse** | Atribuir o lead existente ao corretor da sessão, gravar evento/auditoria e encerrar a entrada do pool como atribuída. |
| **Sem interesse** | Encerrar tentativas do Call Âncora; não apagar, não converter em perdido automaticamente e não atribuir. Manter fora da repetição até revisão. A regra sobre voltar ou não à distribuição normal precisa ser confirmada. |
| **Não atendeu** | Registrar tentativa; permitir nova tentativa no mínimo após 24 horas, no máximo uma por dia. |
| **Caixa postal** | Mesmo tratamento de “Não atendeu”; não interpretar caixa postal como consentimento ou interesse. |
| **Número errado** | Encerrar tentativas e criar supressão de telefone no escopo do tenant; conservar o lead para correção auditável. |
| **Não ligar / opt-out** | Precisa de uma ação explícita no app. Gravar supressão durável antes de liberar a reserva; remover o telefone de qualquer sessão/fila futura. |

Limite recomendado: 3 tentativas totais por telefone; depois da terceira, tirar do Call Âncora e retornar à distribuição regular na próxima janela das 9h, desde que continue elegível. **Sem interesse** e **opt-out** não retornam automaticamente. Três tentativas, retorno às 9h e política de “Sem interesse” são defaults propostos, ainda a confirmar.

A liberação das 9h continua para leads que não entraram no pool, e volta a valer para os que forem devolvidos após esgotar tentativas. A distribuição regular não deve concorrer com uma reserva ativa. O job automático de requalificação continua com a regra atual: uma tentativa, três horas após o lead esfriar, somente dentro das 24 horas desde que esfriou. É necessário coordenar o pool e essa tentativa para não ligar ao mesmo contato por dois canais ao mesmo tempo; com reserva apenas em memória, isso ainda não é garantido após reinício ou entre processos.

## 5. Limites operacionais

- Usar a janela de operação proposta de segunda a sexta, 09:00–18:00, horário de São Paulo. O servidor deve validar a janela antes de entregar número e antes de discar. Feriados e regras aplicáveis a chamadas ativas precisam de validação jurídica antes de produção ampla.
- O Android já limita localmente a 60 chamadas por hora e intervalo mínimo de 3 segundos. O limite do cliente é contornável; o backend ainda precisa aplicar a mesma cota por linha/chip. O teto de 300 por dia do plano inicial ainda não está imposto pelo Android.
- Começar com uma linha lógica por sessão e uma ligação ativa por chip. Não coletar IMEI, ICCID ou número do chip como identidade técnica; cadastrar a linha corporativa pelo identificador operacional controlado pela empresa.
- A janela de tentativas por lead e o limite por chip devem ser configurações administráveis, auditáveis e desligáveis pelo Super-admin antes de escalar o piloto.

## 6. Contagem somente leitura

Consulta agregada executada em 19/11/2026 às 16:39 (São Paulo), em transação PostgreSQL `READ ONLY`; `transaction_read_only = on`. Não retornou nem imprimiu nomes, telefones, IDs ou outros dados pessoais.

| Medida | Contagem |
|---|---:|
| Leads frios sem corretor, não arquivados nem excluídos | 2.447 |
| Nesse total, `manual_hold` | 2.251 |
| Nunca entregues, em fila ativa, estado aberto e fora de retenção da fila | 3 |
| Filas habilitadas para a liberação de frios com candidatos | 1 |
| Unidades efetivas representadas | 1 |
| Elegíveis que já passaram do corte atual das 9h | 3 |
| Candidatos com opt-out IA, número errado, opt-out de pós-venda ou telefone inválido | 0 |
| Grupos de telefone duplicado entre os candidatos | 0 |

O total de 2.447 é uma base ampla, não uma lista discável. A contagem operacional de 3 aplica o escopo conservador da fila de liberação atual, estado não entregue, retenções existentes e os filtros de contato. A decisão de não esperar dois dias não amplia automaticamente o pool para os 2.251 em `manual_hold` nem remove a configuração de retenção da fila.

## 7. Riscos e decisões que faltam

1. **Alto, duplicidade de chamadas:** estado em memória não coordena processos/replicas e se perde em restart; dois processos podem reservar o mesmo lead. A atualização condicional só protege a atribuição depois do interesse. Mitigação para piloto: uma instância, tráfego de reserva roteado ao mesmo processo e monitoramento; correção definitiva exige reserva durável no Postgres.
2. **Alto, colisão com o job das 9h:** o job de distribuição não consulta estado em memória. Revalidar e reservar o lead no mesmo ponto em que o job tenta atribuir, ou garantir que leads do pool permaneçam em status que o job não consome. Sem essa coordenação, uma ligação pode acontecer para um lead já atribuído.
3. **Alto, opt-out não durável:** a base existente registra opt-out e número errado em conversas de IA, mas não há supressão de voz dedicada. Um estado temporário não impede contato depois de restart. Falta decidir escopo e persistência do “não ligar”.
4. **Médio, deduplicação por telefone:** o banco não garante um telefone por lead. Embora a amostra elegível atual não tenha duplicatas, novos imports podem criar dois leads para o mesmo número. Deduplicar por telefone normalizado durante o claim e, numa etapa persistente, por hash HMAC tenant-scoped.
5. **Médio, histórico:** sem tabela de tentativas, resultado e contador se perdem em reinício; não há prova durável de frequência, “Sem interesse” ou “Número errado”. A lista não deve ser liberada para uso contínuo sem este histórico.
6. **Médio, limite por chip:** 60/h e 3 s existem no Android local, não como política de servidor. O limite diário de 300 e janela de horário também precisam de enforcement server-side.
7. **Médio, origem:** não substituir origem de aquisição por Call Âncora; guardar como fonte de atribuição e evento. Confirmar como a interface e relatórios apresentarão essa distinção.
8. **Médio, requalificação em paralelo:** uma mensagem automática pode sair enquanto o lead está reservado para ligação. Falta coordenação persistente entre o worker de requalificação e a sessão do Call Âncora.
9. **A confirmar:** se “Sem interesse” volta à distribuição normal, fica em retenção para revisão ou marca o lead como perdido; se a supressão de opt-out é por telefone, por lead ou por tenant; e se a regra das 3 tentativas/24 horas é aprovada.
10. **A confirmar antes de ampliar:** validar origem/base legal dos telefones, opt-out, janela permitida e regras de telemarketing com Jurídico. Não guardar áudio ou gravação da ligação.

## Referências de implementação

- Sessão e estado atuais: `src/features/call-ancora/session-store.ts`, `src/app/api/call-ancora/session/route.ts` e `src/features/call-ancora/queue-source.ts`.
- Seleção e atraso atual de frios: `src/features/lead-distribution/cold-age-release.ts`, `src/features/lead-distribution/cold-age-release-rules.ts` e `src/features/lead-distribution/service.ts`.
- Retenções e job de distribuição: `src/features/lead-distribution/domain.ts`, `src/features/lead-distribution/jobs.ts`.
- Requalificação automática: `src/features/ai-qualification/cold-lead-requalification-policy.ts` e `src/features/ai-qualification/cold-lead-requalification.ts`.
- Atribuição e trilha: `src/features/lead-distribution/service.ts`, `lead_distribution_events`, `lead_interactions` e auditoria existente.

## Limite desta entrega

Este commit altera somente este documento. Não cria migration, não atualiza journal ou schema, não altera filas/API/app e não escreve no banco. A proposta original de migration fica substituída pela decisão de 19/11 de operar primeiro com a fila em memória e rever persistência antes de escalar.
