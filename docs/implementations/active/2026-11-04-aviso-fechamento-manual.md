# Disparo manual de aviso de fechamento pendente

**Status:** implementado e buildado; suíte geral parcial por falhas de teste e mocks.

## Objetivo e escopo

Permitir que a Direção recupere o aviso de parabéns ao corretor atual quando o lead já está em fechamento e o evento automático não chegou a ser registrado. A ação não muda a etapa, não registra venda e não envia mensagem sem confirmação explícita.

## Comportamento entregue

- A ficha do lead oferece a ação apenas para Diretor com capacidade efetiva `alterar_status_lead`, lead ativo em `documentation_pending` ou `under_analysis`, corretor atual, aviso habilitado e sem envio registrado para o par lead/corretor.
- A confirmação explica o destinatário e o disparo único. O servidor valida tenant, capacidade, etapa, unidade quando aplicável, telefone e configuração do aviso.
- O envio reutiliza template, outbox e notificação existentes; a chave idempotente impede reenvios duplicados. Auditoria registra o solicitante, destinatário e resultado (`sent`, `queued` ou `failed`).

## Arquivos e fluxos

- `src/features/leads/closing-stage-notice.ts`: entrega compartilhada entre o evento automático e a recuperação manual.
- `src/features/leads/closing-stage-notice-action.ts`: ação de servidor autenticada, validada e auditada.
- `src/features/leads/components/send-missed-closing-notice-button.tsx`: confirmação e feedback na interface.
- `src/app/(dashboard)/leads/[id]/page.tsx`: disponibilidade contextual na ficha.
- Regras: BR-089 e DEC-167. Controle de UI: `docs/ux/UX_REDESIGN_CONTROL.md`.

## Validação

- `npm run agent:verify -- --level fast`: documentação e type-check passaram; suíte geral terminou com 18 arquivos falhos (14 testes falhos), 4.228 testes passaram e 22 foram ignorados. O teste legado da ficha falha ao resolver `server-only` no Vitest; os demais erros incluem snapshots, mocks e timeouts.
- `npm run build`: passou (compilação otimizada, TypeScript e geração de 130 páginas estáticas/dinâmicas).
- Evidência do harness: `reports/agent/verification/2026-11-04T15-57-23.318Z.md`.
- `git diff --check`: passou.

## Limites conhecidos

- A ação recupera somente o aviso quando não existe registro de saída. Mensagens já registradas na outbox não são reenviadas, mesmo que tenham falhado; retry exige o fluxo próprio de operação da outbox.
- O botão é mostrado somente para Diretor na ficha com os controles atuais. Ação de Gestor não aparece nesse fluxo.
- A suíte Vitest do repositório tem falhas em rotas, snapshots, mocks e timeouts, incluindo a resolução de `server-only` no teste legado da ficha; o type-check e o build de produção passaram. O botão está disponível na ficha clássica e Lite.
