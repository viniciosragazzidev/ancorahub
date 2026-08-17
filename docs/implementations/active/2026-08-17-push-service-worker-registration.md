# Registro do Service Worker para notificações push

## Problema

O cartão de ativação de push em `/notificacoes` permanecia no estado de carregamento.
O componente aguardava `navigator.serviceWorker.ready`, mas `AppProviders`
desregistrava todos os workers assim que o CRM abria.

## Correção

O provedor agora registra e atualiza `/sw.js` no mesmo escopo, preservando o worker
necessário ao Push API. O worker continua ignorando navegações e requisições internas
do App Router, portanto a medida anterior de proteção contra cache de rotas não é
necessária.

## Validação

- Teste de regressão em `src/components/app-providers.test.tsx` confirma que nenhum
  worker é desregistrado e que `/sw.js` é registrado.
- Testes de disponibilidade de push e type-check.
