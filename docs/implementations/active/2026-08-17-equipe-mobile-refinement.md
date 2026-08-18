# Refinamento mobile da rota /equipe

## Objetivo

Melhorar a responsividade e a experiencia em dispositivos moveis da pagina de equipe, eliminando a rolagem horizontal da tabela e compactando o header e as metricas.

## Escopo e arquivos

- `src/app/(dashboard)/equipe/page.tsx`: grid das metricas passa a escalar 1 -> 2 -> 4 colunas (`sm:grid-cols-2 lg:grid-cols-4`) e botoes do header ficam compactos no mobile (rotulo oculto abaixo de 559px, com icone e aria-label).
- `src/app/(dashboard)/equipe/team-invite-section.tsx`: botao "Novo Funcionario" fica apenas com icone no mobile.
- `src/app/(dashboard)/equipe/team-members-table.tsx`: lista de cards mobile (`sm:hidden`) com avatar, nome/email, badges de papel/status/filial, acoes por membro, busca propria e paginacao; a tabela desktop (`max-sm:hidden`) preserva selecao em lote, busca, colunas e paginacao originais. A pagina mobile e derivada no render (sem reset em efeito) para evitar cascata.

## Decisoes

- Segue o padrao ja adotado em `minha-fila/queue-client.tsx`: cards no mobile + tabela no desktop.
- Nenhuma regra de negocio, permissao, integracao ou dado foi alterado. A selecao em lote (ativar/desativar) permanece disponivel no desktop.
- A pagina da lista mobile usa derivacao (`Math.min(mobilePage, pageCount - 1)`) em vez de reset via efeito, mantendo o lint limpo.

## Validacoes

- ESLint dirigido nos 3 arquivos: sem erros; apenas o aviso preexistente de `set-state-in-effect` na reconciliacao de status.
- `npx tsc --noEmit`: aprovado.
- `npx vitest run "src/app/(dashboard)/equipe"`: 3 testes aprovados.
- `npm run agent:verify -- --level fast`: aprovado, com documentacao valida, verificacao de tipos e 427 testes Vitest aprovados. Evidencia em `reports/agent/verification/2026-08-17T16-46-38.106Z.md`.

## Riscos e rollback

As mudancas sao exclusivamente de apresentacao e isoladas na rota /equipe. Reverter os 3 arquivos acima restaura a aparencia anterior sem migracao, perda de dados ou alteracao de estado.