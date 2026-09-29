# Persistência da edição de membros de equipe

Status: em validação

## Problema

O quadro de equipe exibe corretor a partir de `broker_profiles`, mas a edição de
membros ativos atualizava apenas `user` e `tenant_memberships`. Com isso, nome e
e-mail antigos continuavam aparecendo. Convites pendentes também usam o ID do
perfil e eram rejeitados pela ação que procurava somente um membership.

## Correção

- Atualizar `professional_name` e `invited_email` do perfil quando o membro tem
  um `broker_profile`.
- Resolver, validar e atualizar convites pendentes pelo perfil dentro do tenant,
  incluindo unidade, papel, cargo e cargo personalizado.
- Não exibir o texto de fallback como valor de e-mail em um campo `type=email`;
  convites sem e-mail podem ser editados e membros ativos continuam obrigados a
  informar um e-mail.
- Revalidar e-mails contra identidades globais e perfis da própria corretora.
- Registrar auditoria para a atualização e revogar sessões quando a autoridade
  de um perfil pendente já vinculado a uma identidade for alterada.

## Validação

- `npx vitest run "src/app/(dashboard)/equipe/actions.test.ts"`: 5 testes aprovados.
- ESLint dirigido: sem erros; somente avisos preexistentes de efeitos/imports.
- `git diff --check`: aprovado.
- `npm run build`: compilação do Next.js concluída; type-check bloqueado pelo
  erro preexistente em `scripts/_tmp-diag2.ts` (`p.userId` possivelmente nulo).
- `npm run agent:verify -- --level fast`: harness documental válido; mesma falha
  preexistente registrada em `reports/agent/verification/2026-09-22T15-48-12.756Z.md`.

## Rollback

Reverter os arquivos da ação, página e tabela restaura o comportamento anterior;
nenhuma migração de banco é necessária.
