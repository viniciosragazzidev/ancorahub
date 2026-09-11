# Sistema de distribuição de leads — estado da implementação

## Titularidade provisória e autoridade única (DEC-097) — 11/09/2026

- `src/features/lead-distribution` resolve unidade, fila, elegibilidade, ordem,
  oferta, redistribuição e SLA; os canais de entrada não escolhem corretor.
- A criação durável da oferta já persiste o corretor como owner provisório.
- Recusa, expiração e SLA fazem troca direta para o próximo elegível, sem limpar o
  owner antes da substituição.
- Leads sem unidade usam a unidade automática de menor carga com desempate estável.
- Cooldown, menor fila sem contato e menor carga evitam sequências no mesmo corretor;
  capacidade é meta e não deixa o lead órfão quando todos atingem o alvo.
- As tasks rodam 24/7 e re-semeiam `queued`/`unassigned`, campos de qualificação
  nulos e ofertas provisórias vencidas. A janela da Meta continua na outbox.
- Fila manual, qualificação ativa ou ausência real de corretor elegível permanecem
  com motivo auditável; nunca se burlam tenant, unidade, plantão ou disponibilidade.

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
- Estouro do SLA de primeiro contato mantém o owner vencido até a troca atômica e oferece diretamente ao próximo corretor elegível da mesma unidade.
- Ajuda contextual em `/guia`, no tema “Distribuição de leads”.

## Regras de segurança

O servidor resolve tenant, papel, unidade e elegibilidade. IDs enviados pelo navegador são apenas entradas validadas; eles não ampliam o escopo. A atribuição usa atualização condicional dentro de transação, então duas operações concorrentes não devem assumir o mesmo lead.

## Estados técnicos

`unassigned`, `queued`, `assigning`, `assigned`, `distribution_failed` e `returned_to_queue` pertencem ao ciclo de distribuição e não substituem os status comerciais do lead.

## Operação diária

1. O canal de entrada registra o lead e a intenção durável.
2. O motor resolve unidade e fila pelas regras configuradas em `/distribuicao`.
3. O corretor elegível melhor ranqueado recebe a oferta e vira owner provisório.
4. Aceite confirma; recusa, expiração ou SLA trocam para o próximo elegível.
5. As tasks recuperam qualquer pendência e o histórico permanece auditável.

## Próxima camada

Os serviços estão preparados para serem chamados por jobs, plugins e integrações. Ainda falta conectar o gatilho serverless de `process_queued_leads`, `recover_stuck_assignments` e uma tela dedicada de governança do Super Admin para ativação global por tenant. Até essa camada existir, o roadmap permanece `partial`.
