# Verificação das correções da revisão C1 da carteira Lite

Data: 2026-11-11

Worktree: `ancorahub-carteira`, branch `feat/carteira-corretor-lite`.
Escopo: lista `/clientes`, filtros, recortes e fallback da flag. A ficha C2 já estava integrada e nenhum arquivo `/clientes/[clientId]` ou `light-client-detail` foi alterado.

## Resultado

- `npx vitest run src/features/customers/broker-client-wallet.test.ts src/features/broker-workspace/components/broker-client-wallet.test.tsx`: passou, 2 arquivos e 15 testes.
- `npx tsc --noEmit`: passou.
- ESLint focado nos arquivos alterados da rota, serviço, componente, testes, prévia e schema: passou.
- `npx next build --webpack`: passou. Compilação em 6,9 min, TypeScript em 2,3 min, 137 páginas geradas e build finalizado com código 0.
- `git diff --check`: passou antes dos commits.

O build exibiu avisos: dependência `unpdf` acessa `import.meta` de forma não suportada no webpack; cache webpack serializou strings grandes; rotas dinâmicas que usam `headers` foram classificadas como dinâmicas durante a coleta. Esses avisos não impediram o build.

## Mudanças validadas

- Atenção de renovação exige contrato ativo, `renewal_status` `pending_window` ou `in_renewal`, vencimento hoje ou futuro e janela persistida em até 30 dias.
- Contagens usam subconsultas `IN` não correlacionadas. A hidratação de contrato fica coberta por índice tenant + cliente.
- O selo do contrato segue o mesmo contrato selecionado pelo filtro, incluindo clientes com múltiplos contratos.
- Retornos vencidos usam `dueAt < agora`; retornos de hoje usam `dueAt >= agora` e antes do fim do dia em São Paulo.
- Busca telefônica só adiciona predicado para consulta numérica com pelo menos quatro dígitos.
- `view=renewals` sem dados elegíveis é resolvida para `all` no servidor, preservando os outros filtros.
- Removido o `back` sem consumidor e adicionado `aria-label="WhatsApp de <nome>"`.
- A rota reutiliza `carteiraFichaLiteLigada()`, que fecha para `false` quando a leitura da flag falha; o teste cobre flag ligada/desligada e papel.

## Migration

Arquivo novo `drizzle/0227_active_customers_tenant_client_idx.sql`, separado e não executado:

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS "active_customers_tenant_client_idx"
  ON "active_customers" ("tenant_id", "client_id");
```

O build carregou a configuração do `.env.local` e registrou o hostname do pool Supabase de produção. Não foi executada migration, SQL manual ou operação de escrita no banco.

## Capturas e baseline

Capturas sintéticas da C1 permanecem em `reports/agent/carteira-corretor-lite/`: telas 360, 390 e 1440 px, fim da lista, sheet de filtros e `c1-layout.json`.

O relatório de execução anterior documenta que a suíte integral/harness encontrou falhas preexistentes e foi interrompida sem novo progresso. Nesta correção foram rodados apenas os testes e o lint focados solicitados; `agent:verify --level full` não foi executado.
