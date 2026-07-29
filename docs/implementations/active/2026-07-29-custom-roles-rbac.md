# Cargos e permissões delegáveis por empresa

## Escopo entregue

- Migration `0096_custom_roles_rbac` para cargos, permissões, eventos e liberação por tenant.
- Catálogo versionado de capacidades delegáveis e escopos seguros.
- Diretor-only em `/equipe/cargos` para criar, editar, publicar como ativo e arquivar cargos.
- Flags auditadas no Super-admin: controle global e piloto por empresa.
- Resolução de capacidades efetivas no servidor; a navegação e `/leads` não herdam permissões do papel legado quando um cargo ativo é atribuído.

## Limites conhecidos

- A cobertura de autorização das rotas legadas é incremental; o piloto deve manter cargos em superfícies já protegidas pelo resolvedor.
- A atribuição por membro possui serviço e auditoria, mas a seleção compacta na tabela de Equipe será a próxima entrega.
- Antes de ampliar o piloto, executar testes de integração multi-tenant e E2E de criação, atribuição e arquivamento.

## Verificação

- `npm run agent:verify -- --level fast` — 199 testes aprovados e evidência em `reports/agent/verification/2026-07-29T12-52-17.082Z.md`.
- `npm run type-check`
- `npm run db:check`
- `npm run build`
