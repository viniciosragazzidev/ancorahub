# Disparo em massa para membros sem histórico

Status: em validação

## Objetivo

Permitir que Diretor e Gestor encontrem e selecionem todos os corretores elegíveis
em `/conversas?tab=corretores`, inclusive quando ainda não houve uma mensagem
anterior, e enviem o lote pela outbox oficial sem depender de contato prévio.

## Regras implementadas

- A lista não descarta mais perfis sem mensagens; o estado vazio do histórico fica
  no painel da conversa selecionada.
- Membros ativos do tenant e convites pendentes com telefone podem aparecer.
- Perfis inativos/arquivados não são elegíveis; Gestor continua limitado à própria
  filial.
- A Server Action revalida a mesma elegibilidade e não confia nos IDs enviados pelo
  navegador.
- O envio continua auditado no tenant e usa a outbox Meta existente.

## Arquivos

- `src/app/(dashboard)/conversas/page.tsx`
- `src/features/broker-workspace/broker-template-actions.ts`

## Validação

- ESLint dirigido: aprovado, com avisos preexistentes de imports não utilizados em
  `conversas/page.tsx`.
- Type-check: bloqueado somente pelo erro preexistente em
  `scripts/_tmp-diag2.ts` (`p.userId` possivelmente nulo).
- Build e harness fast: compilação do Next.js concluída, mas ambos foram
  interrompidos pelo mesmo erro de tipagem preexistente; evidência em
  `reports/agent/verification/2026-09-22T15-19-30.139Z.md`.
- `git diff --check`: aprovado.

## Rollback

Reverter os dois arquivos restaura a filtragem anterior por histórico e a consulta
de destinatários anterior; nenhuma migração é necessária.
