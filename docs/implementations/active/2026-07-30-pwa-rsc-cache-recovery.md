# Recuperação de navegação do App Router no PWA

## Objetivo

Eliminar o carregamento infinito e o erro de área indisponível causados por
respostas antigas do App Router armazenadas pelo service worker.

## Causa confirmada

O worker tratava apenas `/api` e `/_next` como dados dinâmicos. Requisições de
Flight/RSC, como `/dashboard?_rsc=...`, usam a rota de página e cabeçalhos do
App Router; por isso podiam cair na estratégia stale-while-revalidate. Uma
árvore de rota antiga podia então ser entregue ao cliente, mesmo quando o
servidor retornava `200` para a navegação atual.

## Mudança

- `public/sw.js` usa a versão de cache `5`, removendo os caches anteriores na
  ativação.
- Navegações, APIs, `/_next`, parâmetros `_rsc` e os cabeçalhos RSC/Router do
  Next.js são sempre atendidos pela rede.
- Somente ativos estáticos continuam elegíveis para cache.
- `AppProviders` solicita atualização do service worker a cada abertura da
  aplicação, sem expor dados ou segredos.

## Segurança e rollback

Não há migration ou mudança de dados. A remoção de cache de HTML autenticado
evita que uma sessão receba conteúdo de outra sessão ou estado de rota antigo.
O rollback é reverter a política do worker, embora isso não seja recomendado
para o CRM autenticado.

## Validação

- Teste de regressão executa o worker em isolamento e confirma que uma
  requisição RSC não consulta `caches.match`.
- `npm run type-check`: aprovado.
- `npm test -- --run src/components/service-worker-cache-policy.test.ts`:
  aprovado.
- `npm run agent:verify -- --level fast`: aprovado, 51 arquivos e 223 testes.
