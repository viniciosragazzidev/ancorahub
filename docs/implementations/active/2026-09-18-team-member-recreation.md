# Recriação segura de membro excluído com o mesmo e-mail

Status: em validação

## Objetivo

Permitir que um membro removido de uma empresa seja convidado novamente com o
mesmo e-mail, sem apagar a identidade Better Auth nem alterar a credencial que
pode ser usada em outro tenant.

## Regras implementadas

- O servidor consulta o vínculo do e-mail dentro do tenant autenticado; nenhum
  `tenantId` vindo do formulário participa da decisão.
- Um e-mail com vínculo existente no tenant continua bloqueado para impedir
  duplicidade.
- Uma identidade global ativa, sem vínculo no tenant atual, é reutilizada no
  novo perfil e o convite registra essa recuperação para auditoria.
- Identidades pendentes ou desativadas não são reativadas silenciosamente.
- No primeiro acesso, uma identidade reutilizada conserva sua conta e senha;
  uma conta de credencial só é criada quando ainda não existir.

## Arquivos

- `src/features/team/identity-reuse-policy.ts`
- `src/features/team/create-user.ts`
- `src/app/primeiro-acesso/onboarding-actions.ts`
- `src/features/team/create-user.test.ts`

## Validação

- Testes focados do cadastro, autorização e política de identidade: 3 arquivos,
  28 testes aprovados.
- ESLint dos arquivos alterados: aprovado.
- Harness fast: documentação aprovada; evidência em
  `reports/agent/verification/2026-09-18T17-44-22.026Z.md`.
- `npm run type-check`: bloqueado por erro preexistente em
  `scripts/_tmp-diag2.ts`, fora do escopo (`p.userId` possivelmente nulo).

## Rollback

Reverter os arquivos listados restaura o bloqueio global anterior; não é
necessária migração porque a correção reutiliza as tabelas existentes.
