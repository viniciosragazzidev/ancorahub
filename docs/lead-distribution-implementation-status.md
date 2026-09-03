# Sistema de distribuição de leads — estado da implementação

## Motor resiliente — 20/07/2026

- A tabela `lead_distribution_jobs` persiste trabalhos de atribuição e impede jobs ativos duplicados por lead.
- O executor interno trabalha em lotes, usa atualização condicional, lease recuperável, backoff e falha visível após o limite configurado.
- A rota protegida `/api/internal/jobs/distribution` é executada por agendador a cada dois minutos; `CRON_SECRET` é obrigatório. A frequência é compatível com o ambiente de produção e a fila continua preservada para nova tentativa se uma execução falhar.
- O Super-admin pode pausar, parametrizar e executar um ciclo manual com auditoria.
- A tela de Distribuição informa pendências, processamento e exceções reais. A migration 0059 é pré-requisito para esta telemetria.

### Pendência obrigatória de infraestrutura

Em qualquer mudança de ambiente, manter as chamadas autenticadas para `/api/internal/jobs/distribution` e `/api/internal/jobs/qualification-timeout` a cada **2 minutos** e preservar `CRON_SECRET` tanto no executor quanto no CRM. O Super-admin pode processar a fila manualmente em contingência.

## Pendência urgente de infraestrutura

- **Upgrade do agendador:** atualizar o projeto para Vercel Pro ou configurar um executor externo autorizado para recuperar a frequência de 2 minutos. O cron diário atual existe somente para manter o deploy compatível com o plano Hobby; ele não atende o SLA operacional de recebimento e distribuição.
- **Critério de conclusão:** deploy de produção aprovado com `schedule: "*/2 * * * *"`, duas execuções consecutivas confirmadas nos logs e um lead de teste processado sem intervenção manual.

Atualizado em 15/07/2026.

## O que está operacional

- Inbox de leads sem unidade ou sem corretor em `/leads/distribuicao`.
- Seleção em lote para enviar leads a uma unidade.
- Routing separado da atribuição: Inbox → Unidade → Fila → Corretor.
- Atribuição manual para Gestor e Diretor, com escopo de tenant e unidade.
- Distribuição automática por carga ativa, disponibilidade e capacidade da fila.
- Fila geral criada sob demanda para cada unidade.
- Plantões em `/leads/distribuicao/plantao`, com horário, prioridade, vigência, ativação e desativação.
- Notificação in-app ao corretor atribuído.
- Eventos de movimentação e auditoria em cada ação relevante.
- Estouro do SLA de primeiro contato desatrela o corretor vencido, exclui-o da tentativa seguinte, redistribui leads da origem Diretor na mesma unidade e devolve-os à fila central quando não há elegíveis; leads da origem Gestor ficam na fila da unidade para distribuição manual.
- Ajuda contextual em `/guia`, no tema “Distribuição de leads”.

## Regras de segurança

O servidor resolve tenant, papel, unidade e elegibilidade. IDs enviados pelo navegador são apenas entradas validadas; eles não ampliam o escopo. A atribuição usa atualização condicional dentro de transação, então duas operações concorrentes não devem assumir o mesmo lead.

## Estados técnicos

`unassigned`, `queued`, `assigning`, `assigned`, `distribution_failed` e `returned_to_queue` pertencem ao ciclo de distribuição e não substituem os status comerciais do lead.

## Operação diária

1. Diretor ou Gestor abre Distribuição.
2. Leads sem destino aparecem na Inbox.
3. O responsável envia para uma unidade.
4. A fila recebe o lead e pode atribuir manualmente ou executar Auto.
5. O corretor recebe a notificação e passa a ser o owner.
6. O histórico da movimentação permanece disponível para auditoria.

## Próxima camada

Os serviços estão preparados para serem chamados por jobs, plugins e integrações. Ainda falta conectar o gatilho serverless de `process_queued_leads`, `recover_stuck_assignments` e uma tela dedicada de governança do Super Admin para ativação global por tenant. Até essa camada existir, o roadmap permanece `partial`.
