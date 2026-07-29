# Escopo de unidade para cargos administrativos

## Objetivo

O Diretor pode criar cargos administrativos com abrangência **Geral da empresa**
ou **Uma unidade**. Gestor e Corretor continuam obrigatoriamente vinculados a
uma unidade ativa. O cargo padrão Marketing passa a ser geral por padrão, mas
uma versão local pode ser criada para uma unidade.

## Escopo e arquivos

- `src/features/custom-roles/member-scope.ts` centraliza a decisão pura de
  vínculo por perfil e abrangência.
- O catálogo permite capacidades de Marketing em escopo geral ou de unidade;
  a tela de cargos explica a consequência de cada escolha.
- `tenant-context` e a edição de membros revalidam a exigência no servidor;
  a UI permite selecionar “Geral da empresa” somente quando o acesso não exige
  unidade.
- `drizzle/0097_custom_role_member_scope.sql` migra os cargos Marketing já
  existentes para a abrangência geral, sem remover dados.

## Decisões

- DEC-064 foi mantida como a fundação de cargos personalizados.
- DEC-066 define a separação entre perfis operacionais e cargos
  administrativos gerais ou locais.
- BR-013 e BR-016 foram atualizadas para registrar a invariante verificável.

## Validações

- `npm run test -- src/features/custom-roles/member-scope.test.ts`: 3 testes
  aprovados.
- `npm run type-check`: aprovado.
- `npm run agent:verify -- --level fast`: aprovado, com 47 arquivos e 212
  testes aprovados; evidência em
  `reports/agent/verification/2026-07-29T17-25-18.631Z.md`.
- `npm run agent:verify -- --level full`: aprovado; lint apresentou somente
  182 avisos preexistentes, type-check, 212 testes e build de produção
  concluídos. Evidência em
  `reports/agent/verification/2026-07-29T17-27-28.169Z.md`.

## Riscos e rollback

A migração apenas altera o padrão de escopo de cargos chamados Marketing. Para
rollback, o Diretor pode editar cada cargo para “Sem operação” ou “Uma unidade”
sem apagar membros, permissões ou auditoria. Reverter o código restaura a regra
anterior, mas não deve ser feito antes de revisar cargos gerais já atribuídos.
