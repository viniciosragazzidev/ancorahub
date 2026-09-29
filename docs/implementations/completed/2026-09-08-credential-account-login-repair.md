# Reparo de login após ativação e redefinição de senha

## Objetivo

Garantir que contas ativadas por convite e senhas redefinidas sejam reconhecidas pelo
login de e-mail e senha do Better Auth. O aceite exige que toda criação ou troca de
senha persista a identidade local `credential` completa e que registros anteriores
sejam reparados sem substituir o hash escolhido pelo usuário.

## Escopo e arquivos

- Contrato compartilhado de conta de credencial em `src/shared/auth/credential-account.ts`.
- Ativação do primeiro acesso e aceite de convite da equipe.
- Redefinição de senha e feedback fiel sobre a criação da sessão automática.
- Criação administrativa e scripts de bootstrap que gravam contas de credencial.
- Migração idempotente para reparar `issuer` e `account_id` dos registros existentes.

## Decisões

- `DEC-082`: o auto-login após primeiro acesso é desejado, mas sua falha não invalida
  a ativação; o login manual precisa continuar funcional.
- Não houve nova decisão de produto. A implementação apenas restaura o contrato exigido
  pela versão instalada do Better Auth (`issuer = local:credential` e `account_id = user.id`).
- Contas não relacionadas a senha não são mais removidas ao reativar
  uma identidade existente.

## Validações

- Regressão reproduzida em teste: conta sem `issuer` falhou contra o contrato esperado.
- `npm test -- --run src/shared/auth/credential-account.test.ts`: 2 testes aprovados.
- `npm run type-check`: aprovado.
- Suíte completa: 148 arquivos e 668 testes aprovados.
- Lint dos arquivos alterados: zero erros; imports sem uso foram removidos.
- `npm run agent:verify -- --level full`: documentação, arquitetura, segurança,
  desempenho, type-check e testes passaram. Evidência em
  `reports/agent/verification/2026-09-08T14-26-49.658Z.md`.
- Lint global: 18 erros preexistentes fora desta correção; não bloqueiam a
  compilação e foram mantidos fora do escopo.
- `npm run build`: aprovado na execução direta (compilação, TypeScript e 79 páginas).
  A repetição pelo harness após a mudança de sandbox falhou no empacotamento da
  extensão por acesso negado ao diretório, antes de compilar o aplicativo.

## Publicação

Publicar o código e aplicar `0143_repair_credential_account_identity.sql` pelo
migrador no ambiente de destino. A migração não foi executada em produção nesta
tarefa. Validar ativação e reset com uma conta de teste após o deploy.

## Riscos e rollback

A migração é idempotente e não altera hashes de senha. O rollback de código consiste em
reverter os consumidores do helper; não se deve apagar `issuer` de registros reparados,
pois isso voltaria a tornar o login incompatível com Better Auth. Caso o deploy precise
ser revertido, os dados reparados podem permanecer sem impacto negativo.
