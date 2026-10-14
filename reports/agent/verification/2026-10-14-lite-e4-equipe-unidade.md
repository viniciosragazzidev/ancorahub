# Verificação E4: equipe e unidade no Lite

Data: 2026-10-14  
Branch: `feat/lite-e4-equipe-unidade`

## Escopo entregue

- Gestor consulta e convida corretores e supervisores somente para a unidade do contexto autenticado. A seleção inicial de corretores livres para o supervisor é revalidada no aceite.
- Supervisor convida corretores para a equipe atual; convites pendentes aparecem com ações de reenvio e cancelamento. O escopo de leituras e mutações continua sendo `tenantId + branchId + supervisorId`.
- A tela `/unidades/<branchId>` do gestor mostra indicadores, membros e ranking em leitura. `/equipe` e `/unidades/<branchId>` estão na allowlist Lite.
- A migration `0199_team_invitation_supervisor_scope.sql` persiste `supervisor_id` e `supervised_broker_ids`. A migration não foi aplicada a nenhum banco.
- Corrigido o gatilho do `BottomSheet` para compor o botão existente sem criar botões aninhados. O cartão de transferência organiza corpo e ações em coluna no celular.

## Validações

- Testes focados: **11 arquivos, 53 testes passaram** (`bottom-sheet-focus`, `manager-unit-scope`, `light-routes-manager`, `invitation-scope`, `create-user`, `resend-invitation`, `lite-team-scope`, `my-team-actions`, `transfer-actions`, `my-team-page`, `manager-lite-team`).
- `npm run type-check`: passou.
- ESLint dos arquivos TypeScript/TSX alterados: **0 erros**. Permanecem dois avisos anteriores de `no-explicit-any` em `src/features/team/onboarding-helpers.ts:10` e `:43`.
- `git diff --check`: passou.
- Não foi executado teste de banco, suite completa, `agent:verify` ou build de produção. Não existe `.env.local` neste worktree. A prévia usou fixtures sintéticas; o navegador bloqueou chamadas de API, e nenhum banco foi conectado.

## Prints comparativos

Cada PNG mostra a tela E4 e o Lite do corretor lado a lado. No desktop cada painel tem 1440 px (arquivo 2880 × 1000); no celular cada painel tem 390 px (arquivo 780 × 844).

- Gestor, lista: `tmp/e4/manager-team-desktop-1440-light.png`, `manager-team-desktop-1440-dark.png`, `manager-team-mobile-390-light.png`, `manager-team-mobile-390-dark.png`.
- Gestor, unidade: `tmp/e4/unit-desktop-1440-light.png`, `unit-desktop-1440-dark.png`, `unit-mobile-390-light.png`, `unit-mobile-390-dark.png`.
- Supervisor, equipe: `tmp/e4/supervisor-team-desktop-1440-light.png`, `supervisor-team-desktop-1440-dark.png`, `supervisor-team-mobile-390-light.png`, `supervisor-team-mobile-390-dark.png`.

O tema Arc usado pelo Lite está definido como claro (`color-scheme: light` em `venancor-scope.css`). Os arquivos `dark` foram capturados com a classe global `.dark`; o escopo Arc continua claro por decisão visual já registrada no controle UX.
