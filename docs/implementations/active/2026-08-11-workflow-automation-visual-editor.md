# Automation Builder: editor visual local-first

## Objetivo

Entregar em `/automacoes` uma superfície visual que permita ao Diretor compor um rascunho de workflow com nodes, conexões e configuração sem expor IDs, JSON ou detalhes de implementação.

## Escopo e arquivos

- `workflow-automation-studio.tsx`: biblioteca de nodes, canvas, conexão, quick-add, painel de configuração e feedback de salvamento.
- `editor-state.ts`: operações puras e testáveis para criar/remover nodes, validar conexão e organizar o fluxo.
- Registry/contratos/validação: ports declarativos, tipos, campos obrigatórios e revalidação server-side.
- `/automacoes`: editor como experiência principal; legado preservado em área recolhível.

## Decisões

- Sem dependência nova: não havia biblioteca de graph; o canvas usa eventos de ponteiro locais e os tokens/motion existentes.
- A interface é local-first e o servidor continua autoridade para tenant, papel, auditoria e publicação.
- Apenas estados seguros são publicáveis. IA e WhatsApp permanecem sob flags próprias e WhatsApp exige confirmação humana.

## Validações

- `npx vitest run src/features/workflow-automation --reporter=dot`: 4 arquivos, 11 testes aprovados.
- `npx eslint` direcionado, `npm run type-check` e `npm run agent:verify -- --level fast`: aprovados; suíte integrada com 69 arquivos e 297 testes aprovados. Evidência: `reports/agent/verification/2026-08-11T14-58-43.679Z.md`.
- `npm run build`: aprovado, incluindo compilação de `/automacoes`.
- A validação completa foi iniciada, gerou os diagnósticos em `reports/agent/verification/2026-08-11T15-00-*.md`, mas excedeu o limite local sem concluir. A checagem completa já é conhecida por varrer lint global fora do escopo.

## Riscos e rollback

- O canvas mantém a edição local quando o salvamento falha; o usuário recebe estado explícito e pode tentar novamente.
- Desativar `feature_workflow_automation_enabled` preserva rascunhos/versionamento/auditoria e bloqueia publicação.
- O executor ainda não existe; portanto esta tela não envia mensagens, altera donos, filas ou status de leads.
