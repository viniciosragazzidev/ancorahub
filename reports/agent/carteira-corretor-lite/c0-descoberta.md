# Carteira Lite do corretor: descoberta C0

Data: 2026-11-11  
Worktree: `ancorahub-carteira`  
Escopo: fontes, serviços, permissões e prévia sintética. Nenhuma escrita em dados operacionais.

## Matriz de domínio e autorização

| Requisito | Fonte/serviço encontrado | Contrato confirmado | Decisão desta entrega |
|---|---|---|---|
| Carteira pessoal | `clients` (`tenantId`, `leadId`, `corretorId`, `nome`, `telefone`, `email`, `convertedAt`) | A rota `/clientes` deriva o contexto de `getRequiredTenantContext`; `buildClientScopeWhere` sempre aplica tenant e, para broker, `corretorId = context.userId`. | Continuar no `/clientes`; paginação e filtros virão do servidor. Nome e telefone são a busca inicial; não incluir email. |
| Unidade e tenant | `clients.tenantId/branchId`, `leads.tenantId/branchId/corretorId` | `buildClientScopeWhere` nega contexto sem permissão e gestor sem unidade; a ficha faz lookup novamente pelo mesmo escopo. | Não aceitar tenant, unidade nem corretor vindos da URL. Lista, contagem e ficha usarão o mesmo resolvedor de carteira. |
| Oportunidade e funil | `clients.leadId` para `leads`; estados definidos por `leadStatus` e DEC-071. | `clients` representa o pós-venda; Leads continua responsável por atendimento e negociação. | Não criar status, kanban ou máquina de estados para a carteira. |
| Próxima ação e retorno | `lead_tasks` (`tenantId`, `leadId`, `title`, `dueAt`, `priority`, `completedAt`); `criarTarefaDoLead`; `createLeadTaskAction`, `setLeadTaskDoneAction`. | `autorizarTarefaDoLead` confere tenant, corretor próprio e unidade efetiva; mutações existentes geram `auditLogs`. | Agendar, concluir e reagendar usam `lead_tasks`; nenhuma agenda nova ou gravação de contato fictícia. |
| Início do corretor | `broker-workspace/queries.ts` lê tarefas abertas em `lead_tasks` para `agenda`/prioridades. | O Início já consulta a fonte de tarefa canônica e deriva a carteira do usuário. | A atualização aparecerá no Início pela mesma consulta; as mutações revalidam as rotas consumidoras. |
| Contrato e renovação | `active_customers` com status, `renewalWindowStartDate`, `contractAnniversary`, `expirationDate`; serviços em `post-sale`. | A data de início da janela é persistida; existe somente quando contrato/venda estruturados foram registrados. | O recorte Renovações depende de cliente ativo e `renewalWindowStartDate`; contrato ausente não vira renovação presumida. |
| Controle e auditoria | `FEATURE_FLAGS`; `getSystemSetting`/`setSystemSetting`; `platformAuditLogs`; ação Super-admin. | Settings globais já têm padrão de toggle e evento auditável. | `feature_broker_client_wallet_lite_enabled`, valor padrão `false`; desligar preserva a lista anterior. |

## Decisões adotadas pelo recomendado

- DEC-178 e BR-098: preservar as definições de Leads e Clientes e usar tarefa canônica como retorno.
- “Precisa de atenção” será fato persistido: retorno vencido/hoje ou janela contratual nos próximos 30 dias. Sem tarefa ou contrato, não dizer que está em dia.
- Só mostrar Renovações se houver cliente ativo com `renewalWindowStartDate`.
- Etiquetas, histórico importado, clientes antigos, comissões, cadastro novo e outras áreas do benchmark ficam fora de C0-C2.
- Nenhuma migration é necessária.

## Prévia

`/dev/carteira-corretor-lite?tela=carteira|ficha|retorno|estados` é bloqueada fora de `NODE_ENV=development`, declara os dados como sintéticos e não chama serviços de escrita. A prévia demonstra lista, ficha, retorno e os estados vazio, busca vazia, carregamento, erro e movimento reduzido.

Capturas C0 em `reports/agent/carteira-corretor-lite/`: `c0-carteira-390.png`, `c0-carteira-1440.png`, `c0-ficha-390.png`, `c0-retorno-390.png`, `c0-estados-390.png` e `c0-estados-1440.png`. O script reproduzível é `capture-previews.mjs`.

## Validação C0

- `npx tsc --noEmit`: aprovado.
- `vitest run src/shared/feature-flags/catalog.test.ts src/app/(platform-admin)/super-admin/broker-client-wallet-settings.test.ts`: 10 testes aprovados.
- Os testes de controle mockam autenticação, setting e auditoria; não acessam o banco.
