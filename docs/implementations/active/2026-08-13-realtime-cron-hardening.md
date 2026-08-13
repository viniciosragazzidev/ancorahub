# Sincronização segura e agendamentos operacionais

## Objetivo

Entregar atualização de notificações entre abas e sessões sem replicar linhas do
banco ao navegador, reduzir as consultas recorrentes e executar os jobs críticos
com cadência compatível com o plano Vercel pago.

## Escopo e arquivos

- `src/features/notifications/realtime-sync.ts`: tópico opaco por tenant e usuário
  e emissão server-side de sinais mínimos.
- Shell autenticado, contador, popover e feedback de leads: consumo do sinal e
  reconciliação pela API interna autenticada.
- `vercel.json`: SLA, lembretes, distribuição, efeitos, WhatsApp, Meta e WAHA.
- Configuração global auditada em Super-admin e documentação de decisão/local-first.

## Decisões

- DEC-077 aceita sinais sem PII e proíbe `postgres_changes` como autorização de
  leitura na sessão do CRM.
- Tenant e usuário continuam derivados exclusivamente do contexto de servidor.

## Validações

- `npm run type-check`: passou.
- `npm test -- --run src/features/notifications/realtime-sync.test.ts src/features/notifications/push-coalescing.test.ts`: 4 testes passaram.
- `npm run agent:verify -- --level fast`: 369 testes passaram e evidência foi registrada.
- `npm run build`: passou, com compilação, TypeScript e 96 rotas de produção.
- A verificação integral executou os diagnósticos. O lint global está bloqueado
  por 331 erros pré-existentes em arquivos temporários e auxiliares fora deste
  escopo; o lint direcionado não apontou erros, apenas avisos legados no
  workspace de conversas.

## Riscos e rollback

O Super-admin pode desligar `feature_realtime_sync_enabled` sem apagar dados. O
browser permanece com reconciliação autenticada de contingência; reverter o deploy
restaura a cadência anterior dos jobs sem migração de banco.
