# Perfil administrativo de membros da equipe

## Objetivo

Permitir que Diretor e Gestor consultem o perfil operacional de um membro em
`/equipe/[id]`, com carteira, atendimento, vendas, tarefas, cotações,
interações e redistribuições baseados em dados reais do CRM.

## Escopo e segurança

- A URL usa o `userId` do membro, mas a resolução deriva tenant, papel e unidade
  exclusivamente da sessão no servidor.
- Diretor consulta membros do próprio tenant. Gestor consulta somente membro
  vinculado à própria unidade; o filtro de unidade também é aplicado em cada
  agregação e lista de leads.
- A rota retorna acesso negado tanto para ID inexistente como fora do escopo,
  sem revelar a estrutura de outra unidade. Leituras autorizadas são auditadas.
- `feature_team_member_profile_enabled` é o kill switch global, exposto em
  `/super-admin/settings`; desligá-lo remove o atalho e bloqueia a consulta,
  preservando os dados.

## Interface

- Nome do membro na tabela de Equipe abre o perfil quando a funcionalidade está
  ativa e o usuário tem papel administrativo.
- A página prioriza identidade, saúde da carteira, resultado comercial,
  carteira recente e redistribuições, destacando quantas ocorreram antes do
  primeiro atendimento. Informações sem fonte confiável são
  omitidas, não simuladas.

## Decisões

- DEC-068 e BR-065 formalizam escopo, não enumeração e auditoria de consulta.

## Validações

- `npm run type-check`: aprovado.
- `npx vitest run src/features/team/member-profile.test.ts`: 3 testes aprovados.
- `npm run agent:verify -- --level fast`: aprovado, com 49 arquivos de teste e
  218 testes; evidência em `reports/agent/verification/2026-07-29T18-22-08.156Z.md`.
- `npm run agent:verify -- --level full`: aprovado; type-check, 218 testes e
  build de produção concluídos. Permanecem apenas avisos de lint preexistentes;
  evidência em `reports/agent/verification/2026-07-29T18-24-33.680Z.md`.

## Riscos e rollback

O kill switch global é o rollback operacional. A alteração é aditiva e não cria
nem altera dados de equipe, leads, vendas ou distribuição.
