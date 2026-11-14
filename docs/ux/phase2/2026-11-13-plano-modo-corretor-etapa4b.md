# Etapa 4b do modo corretor: "Cliente que já possuo" e contratos anteriores

Data: 2026-11-13. Complementa as seções 4 e 5 de [2026-11-13-plano-modo-corretor.md](./2026-11-13-plano-modo-corretor.md).
Estado: **aprovada pela opção recomendada (Vinicios, 2026-11-13), registrada na DEC-187 e implementada em
`feat/corretor-carteira-etapa4b`** com a migration `0231_broker_prior_clients.sql` (não aplicada). Diferença da proposta:
o CHECK também exige `lead_id` nulo para `prior_portfolio`, então "cliente de venda" é `lead_id is not null`, filtro
que funciona antes e depois da migration.

## Problema

O corretor precisa cadastrar clientes que já atendia fora do CRM (carteira anterior) e os contratos que eles já têm,
sem que isso gere venda, comissão, conversão, pontos ou lead no funil. Hoje isso não cabe no modelo:

- `clients.lead_id` é obrigatório e único: todo cliente nasce de um lead convertido por venda aprovada.
- `active_customers` exige `sale_id` (e `lead_id`): contrato ativo só existe a partir de uma venda.
- Taxa de conversão, comissão, repasse, metas e jornada leem `sales`, `leads.status = converted` e eventos de venda.

## Opções

| Opção | Como | Prós | Contras |
|---|---|---|---|
| **A. Cliente com origem própria e contrato anterior separado** (recomendada) | `clients.lead_id` passa a aceitar nulo; nova coluna `clients.source` (`sale` ou `prior_portfolio`) com CHECK `source = 'sale'` exige `lead_id`; nova tabela `client_prior_contracts` | Uma pessoa, um cadastro; nada toca venda, funil ou pontos; o perfil do cliente (etapa 5) mostra os dois tipos | Consultas que assumem `lead_id` precisam tratar o nulo; contagens de "clientes" pós-venda precisam filtrar `source = 'sale'` |
| B. Lead sintético convertido | Cria lead `converted` e venda fictícia para caber no modelo | Sem migration | Polui conversão, funil, ranking e comissão; contradiz o plano ("não gera venda...") |
| C. Tabela paralela de contatos próprios | `broker_portfolio_contacts` fora de `clients` | Isolamento total | Duplica pessoas e listas; a carteira passa a juntar duas fontes; o perfil fica dividido |

## Recomendação (opção A)

### Modelo

- `clients`
  - `lead_id` nullable (mantém o índice único: vários nulos são permitidos no Postgres).
  - `source text not null default 'sale'`, CHECK `source in ('sale', 'prior_portfolio')` e
    CHECK `source <> 'sale' or lead_id is not null`.
  - `origin_note text null` (de onde veio: carteira própria, indicação); origem comercial continua distinta da situação.
  - `created_by text null` (quem cadastrou a carteira anterior).
  - `converted_at` continua obrigatório por compatibilidade; para `prior_portfolio` recebe a data do cadastro e **não**
    é lido como conversão (as consultas de conversão já partem de `leads`/`sales`; as que contam `clients` passam a
    filtrar `source = 'sale'`).
- `client_prior_contracts` (nova)
  - `id`, `tenant_id`, `client_id` (FK `clients`, cascade), `broker_id`, `branch_id`.
  - `product_type` (`PF`, `PJ`, `adesao`, `odonto`, `outro`), `carrier_name text null`, `carrier_id text null`
    (quando casar com o catálogo), `coverage_start_date date null`, `renewal_date date null`,
    `status` (`active`, `cancelled`, `unknown`, default `unknown`), `notes text null`.
  - Campo desconhecido fica nulo e aparece como **pendente** na tela; nunca é preenchido por suposição.
  - `created_by`, `updated_by`, `created_at`, `updated_at`; índices `(tenant_id, client_id)` e `(tenant_id, renewal_date)`.
  - Sem `sale_id`, sem valor, sem comissão: a tabela não alimenta financeiro, metas, ranking nem jornada.

### Fluxo

- Painel **Adicionar contato** ganha a opção **Cliente que já possuo**: nome, telefone, e-mail opcional, origem,
  observação opcional e, opcionalmente, um ou mais contratos (produto, operadora, início de vigência, renovação).
- Duplicidade checada só no escopo autorizado (clientes e leads do próprio corretor); fora dele, aviso genérico sem
  nome nem responsável, como na etapa 4a.
- Responsável é o corretor da sessão; tenant e filial vêm do servidor.
- A visão **Clientes** lista os dois tipos (com etiqueta "Carteira anterior"); **Precisa de atenção** passa a incluir
  `client_prior_contracts` ativos com `renewal_date` em até 30 dias (mesma janela da DEC-180), e contrato sem data
  de renovação nunca conta como "em dia".
- Próxima ação de cliente sem lead: hoje `lead_tasks` é por lead. Na 4b o retorno de carteira anterior fica fora;
  a agenda unificada (etapa 6) decide entre `lead_tasks.client_id` nullable ou tabela própria.

### Migration

- Maior número em qualquer branch `origin` hoje: `0230` (`origin/codex/erp-foundation`, `drizzle/0230_erp_operational.sql`).
  A 4b usa **`0231_broker_prior_clients.sql`**, conferindo de novo o maior número de todas as branches no dia da
  implementação (o journal precisa da tag com o `.sql` correspondente).
- Conteúdo: `alter table clients alter column lead_id drop not null`, colunas `source`, `origin_note`, `created_by`
  com os CHECKs, `create table client_prior_contracts` com índices. Aditiva e reversível: nenhum dado existente muda
  (todo cliente atual recebe `source = 'sale'` pelo default).
- O código deve tolerar a tabela ausente enquanto a migration não for aplicada (a opção some do painel).

### Impacto a revisar no código

- Leituras que fazem join obrigatório por `clients.lead_id` (carteira Lite `buildBrokerClientWalletWhere`, ficha
  `/clientes/[clientId]`, retorno da ficha, relatórios de pós-venda) passam a tratar `lead_id` nulo ou filtrar
  `source = 'sale'` quando o número for de venda.
- Métricas em `/clientes` para gestão (total, conversão, média por corretor) filtram `source = 'sale'`.
- Nenhuma mudança em distribuição, funil, conversão, comissão, repasse, metas ou pontos.

### Auditoria

`audit_logs` com `entidade` e `acao` próprios, sempre com `tenantId` e o ator da sessão no `metadata`:
`client.prior_portfolio.created`, `client.prior_portfolio.updated`, `client_prior_contract.created`,
`client_prior_contract.updated`, `client_prior_contract.removed` e tentativas recusadas por duplicidade
(`client.prior_portfolio.duplicate_blocked`, sem dados do outro corretor). Exportações seguem as regras atuais.

### Chave do Super-admin

- `feature_broker_prior_clients_enabled`: global, desligada por padrão, editável e auditada no Super-admin como as
  demais chaves do modo corretor. Depende de `feature_broker_navigation_reorg_enabled` e
  `feature_broker_client_wallet_lite_enabled`; com qualquer uma desligada, a opção some e os cadastros continuam
  guardados (desligar não apaga dados).

### Testes previstos

Escopo por tenant e corretor nas consultas novas; CHECK de origem; cliente de carteira anterior fora de conversão,
comissão e pontos; atenção de renovação só com data; duplicidade sem vazamento; tela com a chave ligada e desligada.
