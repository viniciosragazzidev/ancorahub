# Registro — Etapa 2: Auditoria e Inventário de UI

## Escopo entregue

Inventário estático da superfície frontend atual contra o contrato de design system. Foram produzidos os mapas de rotas, componentes, famílias, violações com evidência, ledger de migração e ondas recomendadas.

## Limites preservados

Nenhum componente de produção, CSS, token runtime, rota, dependência, comportamento, acessibilidade ou responsividade foi alterado. O script em `scripts/design-system/audit-ui-inventory.mjs` é ferramenta de auditoria e gera somente artefatos de inventário.

## Resultados observados

- 110 rotas e 364 componentes candidatos catalogados.
- 1.419 itens de triagem com arquivo, linha, regra, motivo, confiança e classificação inicial.
- 20 famílias com mais de uma implementação candidata.
- Novos gaps: DataTable (DG-009), composição de formulários (DG-010) e ownership de overlays (DG-011).
- Auditor existente `npm run ui:audit` confirmou 17 selects nativos fora da pasta de primitives.

## Verificação executada

- `node --check scripts/design-system/audit-ui-inventory.mjs`: passou.
- JSON dos cinco artefatos `.agent` validado por parser Node: passou.
- `npm run agent:docs`: passou (18 referências verificadas).
- `git diff --check` nos arquivos da entrega: passou.
- `npm run ui:audit`: falhou como esperado, expondo 17 selects nativos fora de `src/components/ui/`; a falha é evidência da auditoria, não regressão criada nesta etapa.

## Rollback

Reverter exclusivamente os arquivos de inventário/documentação e a ferramenta de auditoria. Não há alteração de runtime para reverter.
