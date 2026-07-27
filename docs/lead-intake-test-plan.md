# Recebimento e distribuicao de leads — fluxo e plano de testes

**Estado:** implementacao de testes sem alterar regras de negocio.

## Fluxo atualmente executado

1. A entrada chega por `POST /api/webhooks/leads` (Bearer), `POST /api/webhooks/leads/[token]` (landing page) ou pelo alias `/api/webhook`.
2. A rota exige JSON, limita o corpo a 32 KB, resolve o request ID e autentica o hash do token junto ao tenant.
3. O contrato realmente usado pelas rotas e `lpFormPayloadSchema`: `nome`, `telefone`, e opcionalmente `email`, `plano_interesse`, `website` e `receivedAt`.
4. O servico normaliza nome, telefone e e-mail; o honeypot `website` descarta a entrada como sucesso.
5. A credencial fixa a filial quando possui `branch_id`. Sem filial, o codigo atual resolve a primeira filial ativa que aceita leads.
6. A chave `Idempotency-Key`, quando valida, e deduplicada por credencial; a mesma chave com outro conteudo retorna conflito.
7. A distribuicao tenta escolher um corretor elegivel; se nao houver, o lead fica em fila. O lead, a entrega do webhook, a auditoria e a timeline sao persistidos e a notificacao e enviada depois.

## Matriz entregue

| Camada | Cenários cobertos | Arquivo |
|---|---|---|
| Contrato de payload | obrigatorios, opcionais, formato, campos administrativos proibidos, honeypot e limites | `lp-form-payload.test.ts` |
| HTTP Bearer | content type, token ausente, sucesso, repeticao, conflito e corpo grande | `webhook-route-contract.test.ts` |
| HTTP token de landing page | autenticacao pelo caminho, criacao e erro de validacao | `webhook-token-route-contract.test.ts` |
| Orquestracao de intake | unidade fixa, fila sem corretor, fallback sem unidade, replay, conflito, honeypot e rejeicao | `webhook-intake-sync.test.ts` |
| Resolucao de filial | filial padrao, ausencia, filial externa valida/invalida | `webhook-branch-resolution.test.ts` |
| Idempotencia | replay, conflito, identificador externo e primeira entrega | `webhook-idempotency.test.ts` |
| Distribuicao | elegibilidade e ordem round-robin | `src/features/lead-distribution/domain.test.ts` |

Os testes de unidade e contrato usam dublês do banco e de efeitos externos: sao deterministas e nao acessam dados reais.

## Lacunas deliberadamente expostas

- **Fila geral/matriz:** o comportamento pedido de manter a entrada sem unidade numa fila geral ainda nao e o comportamento atual; hoje ocorre fallback para a primeira filial elegivel. A mudanca deve ser decidida e registrada antes de ser implementada.
- **Fonte da credencial:** `source` aceita `site_pixel` e `landing_page`; o intake sincrono grava `distributionOrigin: "landing-page"`.
- **Idempotencia concorrente:** o fluxo consulta a chave antes de inserir. Sob duas entregas simultaneas, a restricao unica pode ser atingida apos a consulta e virar erro interno em vez de replay.
- **Persistencia de distribuicao:** esse caminho nao cria os eventos e tentativas usados pelo modulo de distribuicao; isso reduz a rastreabilidade operacional.
- **Efeitos apos o banco:** auditoria, timeline, entrega e notificacao nao formam um unico mecanismo de outbox. Uma falha parcial pode deixar o lead criado sem todos os efeitos observaveis.

## Matriz pendente de ambiente isolado

Nao ha `TEST_DATABASE_URL`, banco de testes nem factory de dados no repositorio. Por isso, os itens abaixo estao especificados, mas nao foram executados contra PostgreSQL:

1. Integracao Drizzle/PostgreSQL: constraints unicas de `lead_webhook_deliveries` e `leads`, rollback, isolamento por tenant, credencial revogada/expirada e filial de outro tenant.
2. Concorrencia: duas ou mais entregas simultaneas com a mesma chave, com `external_id` e sem chave; deve resultar em um unico lead e resposta idempotente.
3. E2E de landing page e integracao Bearer: envio, validacao, distribuicao/fila, timeline, auditoria e visibilidade por papel.
4. Contrato de cada provedor futuro: assinatura, mapeamento de payload, retry e origem persistida.

Para executar essa camada com seguranca, crie um banco PostgreSQL descartavel em `TEST_DATABASE_URL`, aplique migrations nele e inclua limpeza/seed por teste. Nunca aponte testes para `DATABASE_URL` de desenvolvimento ou producao.

## Correcoes recomendadas em paralelo

| Prioridade | Correcao | Dependencia de decisao |
|---|---|---|
| P0 | Definir e implementar a semantica de entrada sem unidade: fila geral ou filial padrao; registrar no decision log e tornar parametrizavel/auditavel pelo Super-admin. | Sim |
| P0 | Unificar o contrato publico de webhook e preservar a fonte configurada pela credencial antes de expor novos adaptadores. | Sim, pois altera contrato e origem |
| P0 | Tratar violacao de unicidade de idempotencia como replay/conflito e adicionar teste concorrente real. | Nao para a correcao tecnica |
| P1 | Gravar evento/tentativa de distribuicao tambem no intake e usar outbox/retry para notificacoes e efeitos secundarios. | Nao, mas exige desenho de transacao |
| P1 | Criar banco de testes isolado, factories e a camada de integracao/E2E desta matriz. | Infraestrutura de CI/segredo |
| P1 | Adicionar autenticacao por assinatura e rate limit por credencial para provedores externos. | Contrato de cada provedor |
