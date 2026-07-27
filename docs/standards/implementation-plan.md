# Plano mestre de organização sem mudança funcional

## Objetivo

Organizar o código existente por fronteiras claras e aplicar padrões profissionais sem alterar rotas, permissões, regras, dados ou integrações. A implementação deve ser incremental e sempre reversível.

## Matriz de trabalho

| Fase | Arquivos/áreas | Entrega | Risco | Critério de saída |
|---|---|---|---|---|
| 0. Inventário | `src/app`, `src/features`, `src/shared`, imports, testes | mapa real e owners | baixo | mapa revisado; nenhum movimento |
| 1. Contratos | `features/*/types.ts`, `schema.ts`, `policy.ts` | interfaces profundas e invariantes | médio | type-check + testes de contrato |
| 2. Segurança | `shared/auth`, `tenant`, `audit`, `storage`, route handlers | helpers centrais, validação e auditoria | alto | testes cross-tenant/papel + logs sanitizados |
| 3. Persistência | `shared/db`, `drizzle`, queries/actions | queries escopadas, transações, índices | alto | migration testada e N+1 auditado |
| 4. UI compartilhada | `src/components/ui`, `unlumen-ui`, tokens | variantes reutilizáveis e estados | médio | visual/a11y light-dark e sem regressão |
| 5. Rotas | `src/app/**/page.tsx`, layouts, loading/error | páginas finas, tabs/dialogs/sheets | médio | fluxos e links profundos mantidos |
| 6. Integrações/jobs | `src/app/api`, `features/*/integrations`, jobs | adapters idempotentes, timeout, retry | alto | replay, falha externa e observabilidade testados |
| 7. Qualidade | `tests`, `e2e`, `.github`, scripts | gates e runbooks | médio | lint/type/test/build no CI |
| 8. Limpeza | imports obsoletos, adapters temporários | remoção pós-migração | médio | `rg` sem referências e rollback documentado |

## Sequência de organização por arquivo

### Rotas

Manter apenas composição e autorização de entrada. Extrair query para `features/<domínio>/queries.ts`, mutation para `actions.ts`, regra para `service.ts`/`policy.ts`, estados para `loading.tsx`/`error.tsx` e UI repetida para componentes compartilhados.

### Features

Cada domínio deve ter, quando necessário:

```text
features/<dominio>/
├─ components/
├─ actions.ts
├─ queries.ts
├─ service.ts
├─ policy.ts
├─ schema.ts
├─ types.ts
├─ events.ts
├─ adapters/       # somente quando houver integração/variação real
└─ *.test.ts
```

Não criar arquivos vazios para cumprir uma árvore; criar somente quando o contrato existir.

### Shared

`shared/auth`, `shared/tenant`, `shared/audit`, `shared/storage` e `shared/db` devem ser módulos profundos com interfaces pequenas. Não exportar internals do adapter. `shared/ui` contém apenas primitives sem negócio.

### Banco

Schema fonte, migration e consumidores devem ser alterados no mesmo lote. Queries de domínio não podem depender de colunas implícitas ou de migrations não aplicadas.

### Testes

Testes ficam próximos do contrato; E2E fica em `e2e/`; factories e helpers não devem carregar credenciais reais. Nomes descrevem comportamento, não implementação.

## Plano de segurança por arquivo

- `route.ts`: schema, auth/HMAC, rate limit, timeout, status HTTP e erro sanitizado.
- `actions.ts`: sessão, policy, tenant, transação, auditoria e resultado tipado.
- `queries.ts`: escopo obrigatório, seleção mínima, paginação e ordenação segura.
- `service.ts`: invariantes, idempotência, retry explícito e dependências injetáveis.
- `storage/*`: chave privada, autorização por recurso, URL temporária e auditoria.
- `shared/audit/*`: evento append-only, PII minimizada e request ID.
- `drizzle/*`: migration revisada, índice e estratégia expand/migrate/contract.
- `components/*`: nunca receber segredo, tenant ou papel como autoridade; tratar estado de erro e permissão.

## Plano de acessibilidade por superfície

- Página: landmark, `h1`, foco inicial e estado de carregamento.
- Lista/tabela: caption, headers, paginação, alternativa móvel e estado vazio.
- Formulário: labels, descrição, erro associado, preservação de entrada e submit anunciado.
- Dialog/sheet: foco preso, Escape, retorno de foco, título e descrição.
- Tabs: padrão de teclado, aba ativa anunciada e contexto recuperável.
- Toast/status: texto equivalente e live region sem depender de cor.

## Plano de design por arquivo

- Primitives em `src/components/ui` usam tokens e variantes.
- Domínio compõe sem duplicar estilos.
- Rotas longas usam abas para contexto paralelo, steps para pré-requisito e dialogs para decisões pontuais.
- Motion novo fica em leaf client e segue `transitions-dev`.
- Cada tela é validada em light/dark, desktop/mobile, teclado e reduced motion.

## Plano de desempenho por módulo

- Listas: paginação, filtros no banco, seleção mínima e virtualização somente após medição.
- Dashboards: agregações server-side, janelas temporais e cache com escopo.
- Uploads: stream/presigned URL, limite e processamento assíncrono.
- Integrações: timeout, backoff, idempotência, circuit breaker e logs métricos.
- UI: server-first, client leaves pequenos, skeleton estável e imagens dimensionadas.

## Regras de não regressão

Nenhuma etapa pode alterar:

- permissões observáveis por papel;
- isolamento entre tenants/unidades;
- estados e histórico de leads;
- cálculo de cotação, venda ou comissão;
- entrega de webhook, notificações ou jobs;
- formato público de integração;
- dados já persistidos.

Se uma alteração for necessária, parar a reorganização, criar decisão/ADR e separar a mudança funcional.

## Resultado final esperado

Um desenvolvedor consegue localizar a rota, o caso de uso, a policy, a persistência, o adapter e os testes de qualquer domínio sem procurar lógica duplicada em páginas ou componentes. O comportamento externo permanece igual, e cada módulo oferece uma interface menor, testável e observável.
