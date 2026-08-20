# Registro — Etapa 3: Componentes Canônicos

## Escopo

Consolidação documental dos primitives existentes, mapa de substituição, baseline visual pendente de aprovação e atualização do ledger. Nenhuma página foi migrada e nenhum comportamento de domínio foi alterado.

## Evidência

- A auditoria listou Button, Input, Select, Card, Dialog, Drawer, Table e Tabs já centralizados em `src/components/ui`.
- A matriz canônica definiu uma única origem por família e bloqueou DataTable, FormField e overlays até decisões de design registradas.

## Verificação

- JSONs de canonicalização: válidos.
- `npm run agent:docs`: passou (18 referências).
- `git diff --check`: passou para os artefatos da etapa.

## Limites

Não foram adicionados testes de componente nem enforcement de CI nesta entrega porque a definição de tokens e APIs de DG-009 a DG-011 ainda é pendência explícita; marcar componentes visualmente aprovados agora seria evidência falsa.
