# Refinamento das superficies operacionais e motion

## Objetivo

Preservar a linguagem visual e a estrutura operacional do AncoraHub enquanto reduz o peso percebido do shell, dos cards e dos dialogos. Nesta etapa, o editor de automacoes passa a respeitar o viewport e mantem seus paineis rolaveis sem deslocar o canvas.

## Escopo e arquivos

- `src/app/globals.css`: tokens de profundidade, motion e canvas compartilhado.
- `src/components/app-shell.tsx`: canvas neutro da area autenticada.
- `src/components/ui/dialog.tsx` e `src/components/ui/card.tsx`: superficies, bordas e transicoes compartilhadas.
- `src/app/(dashboard)/automacoes/page.tsx`: espacamento mais direto do construtor.
- `src/features/workflow-automation/components/workflow-automation-studio.tsx`: altura limitada pelo viewport, header fixo, scroll areas independentes na biblioteca e no inspector, e modos explicitos para mover o canvas, editar nos e conectar etapas.

## Decisoes

- DEC-072 permanece respeitada: a interface fica mais simples sem remover dados, capacidades ou controles.
- Nenhuma regra de negocio, permissao, integracao ou dado foi alterado.

## Validacoes

- ESLint dirigido para a rota e os componentes compartilhados: sem erros; tres avisos preexistentes permanecem em DashboardHeader e DataTable.
- `npx vitest run src/features/workflow-automation --reporter=dot`: 4 arquivos e 11 testes aprovados.
- `npm run type-check` e `npm run build`: aprovados apos a correcao do schema compartilhado.
- `npm run agent:verify -- --level fast`: aprovado, com documentacao valida, verificacao de tipos e 70 arquivos/300 testes Vitest aprovados. Evidencia em `reports/agent/verification/2026-08-11T16-04-06.045Z.md`.

## Riscos e rollback

As mudancas sao exclusivamente de apresentacao. Reverter os arquivos acima restaura a aparencia anterior sem migracao, perda de dados ou alteracao de estado.
