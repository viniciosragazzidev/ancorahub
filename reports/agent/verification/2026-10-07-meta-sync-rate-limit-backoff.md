# Verificação — backoff da sincronização Meta

- Diagnóstico de produção, somente leitura: últimas sincronizações do tenant terminam em `User request limit reached`; conexão `connected`, permissões `ads_read` e `leads_retrieval` presentes; job registrado a cada 10 minutos no runbook anterior.
- `npm run type-check`: passou.
- `npm run build`: passou (Next.js 16.2.10; compilação, TypeScript e 86 rotas geradas).
- `git diff --check`: passou.
- Testes automatizados: não executados.
- Sincronização manual com a Meta: não disparada enquanto a API está limitando chamadas.
