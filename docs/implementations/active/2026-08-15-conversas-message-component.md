# Substituir componente de mensagem das conversas pelo shadcn Message

## Objetivo

Trocar a renderização das mensagens em `/conversas` pelo componente shadcn `Message`
(estilo base-rhea) com `Bubble`/`BubbleContent`, slots de avatar, header e footer e
estados refinados. Resultado observável: mensagens usam `MessageGroup`/`Message`,
avatar do cliente apenas no último item de cada grupo, remetente no `MessageHeader`,
hora e status no `MessageFooter`, estado "Enviando..." via `Marker` com `role="status"`,
e entrada sutil com `ct-reveal-fast` respeitando `prefers-reduced-motion`. Critério de
aceite: nenhuma regra de negócio alterada (mesmos direções, status, ordenação e agrupamento)
e `agent:verify --level fast` passando.

## Escopo e arquivos

- `src/components/ui/message.tsx` (novo): `MessageGroup`, `Message`, `MessageAvatar`,
  `MessageContent`, `MessageHeader`, `MessageFooter` — source oficial base-rhea adaptado
  aos imports do projeto.
- `src/components/ui/marker.tsx` (novo): `Marker`, `MarkerIcon`, `MarkerContent` — usado
  para o estado de envio com acessibilidade (`role="status"`).
- `src/app/(dashboard)/conversas/conversations-workspace.tsx`: apenas `ConversationHistory`,
  `MessageRow` (ex-`MessageBubble`), `MessageSenderBadge` e `MessageStatusIndicator`;
  refactor neutro do hook `useMemo` em `ConversationHistory`. Nenhuma outra área da tela
  (lista, header, perfil, input) foi alterada.
- `src/app/(dashboard)/conversas/official-broker-conversations.tsx`: mesma migração do
  `MessageBubble` da aba "Número oficial · corretores" (diretor), preservando conteúdo
  informativo (status, template, tentativas, erro) e a identidade `success` do canal.

## Decisões

- Consultadas com o usuário antes de codar: avatar somente no cliente (último item do
  grupo, com slot invisível para alinhamento) e motion de entrada sutil por mensagem
  (`ct-reveal-fast`), sem stagger cumulativo em históricos longos.
- Não há decisão arquitetural nova registrável em ADR; mudança exclusivamente visual e de
  estados no componente de mensagens.

## Validações

- `npm run type-check` — passou.
- `npx eslint` nos 3 arquivos alterados — 0 erros; apenas avisos pré-existentes não
  relacionados (ex.: `closeConversationAction`, `initials`, `formatMessageDateTime`).
- `npm run agent:verify -- --level fast` — passou (docs válidas, type-check, 396 testes).
  Evidência: `reports/agent/verification/2026-08-15T17-29-00.993Z.md`.
- `npm run agent:verify -- --level full` — passou em docs, changed, architecture, security,
  performance, type-check, teste (396) e build de produção (rota `/conversas` compilada).
  O passo `lint` falhou por dívida pré-existente fora do escopo: árvore legada
  `temp_deskcomm_crm/` e `update_cards.js` (erros `no-require-imports`, etc.), sem nenhuma
  ocorrência nos arquivos alterados. Evidência:
  `reports/agent/verification/2026-08-15T17-35-58.772Z.md`.
- `npm run agent:verify -- --level fast` (após a migração da aba de corretores) — passou.
  Evidência: `reports/agent/verification/2026-08-15T17-40-35.697Z.md`.

## Riscos e rollback

- Mudança localizada e reversível via `git revert`/checkout de
  `conversations-workspace.tsx` + remoção de `message.tsx` e `marker.tsx` (componentes
  novos, sem efeito em outros módulos). Sem migração, sem dados.