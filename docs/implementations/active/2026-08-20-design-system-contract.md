# Registro — Contrato de Design System v1.0.0

## Escopo entregue

Criação documental do contrato de design system derivado de `design.md`, com taxonomia, tokens rastreáveis, padrões genéricos, regras de componente, acessibilidade, responsividade, motion e lacunas. Não houve alteração de código de produção, CSS, rota, dependência, banco ou migração.

## Decisões e riscos

- A referência é de landing page e não especifica o CRM operacional por completo.
- Valores confirmados foram preservados; valores sem evidência foram declarados `MISSING`.
- Divergências com `globals.css` e primitives existentes foram documentadas, não migradas.
- Adoção de novos valores bloqueados depende dos gaps DG-001 a DG-008.

## Verificação executada

- `npm run agent:docs`: passou (18 referências verificadas).
- validação JSON de `.agent/design-contract.json`: passou.
- `git diff --check` para os arquivos da entrega: passou.
- `npm run agent:verify -- --level fast`: iniciado; a etapa documental passou e o harness prosseguiu para type-check/test.
- `npm run agent:verify -- --level full`: os diagnósticos registraram 34 achados arquiteturais, 6 de segurança e 38 de desempenho pré-existentes; o lint também encontrou mojibake pré-existente em `src/features/platform-admin/purge-job.ts`.
- `npm run build`: bloqueado por lock de outro `next build` no workspace. O lock não foi removido nem o processo externo foi interrompido.

## Rollback

Reverter exclusivamente os arquivos desta entrega; nenhuma alteração runtime exige rollback operacional.
