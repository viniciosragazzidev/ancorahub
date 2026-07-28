# Engineering Harness

Este diretório é o contrato operacional para agentes e colaboradores. Ele reduz o
contexto carregado por tarefa, preserva decisões e exige evidência objetiva antes do
encerramento. Não substitui `AGENTS.md`, `AI_RULES.md` ou as regras de negócio.

## Uso

1. Rode `npm run agent:context -- --task "objetivo da tarefa"`.
2. Leia o contexto obrigatório e os módulos sugeridos; não carregue documentação sem
   relação com o escopo.
3. Escreva um plano curto em `docs/implementations/active/` quando a tarefa tiver mais
   de uma alteração coesa.
4. Execute `npm run agent:verify -- --level fast` a cada ciclo relevante.
5. Antes de concluir, rode `npm run agent:verify -- --level full`, registre a evidência
   em `docs/implementations/completed/` e atualize o roadmap quando houver feature.

Os relatórios efêmeros ficam em `reports/agent/` e não são versionados. O conteúdo
durável fica em `docs/`, decisões em `docs/decision-log.md` ou ADRs e termos em
`CONTEXT.md`.

## Leitura por nível

| Nível | Quando | Fonte |
| --- | --- | --- |
| 0 | Sempre | `AGENTS.md`, `PROJECT_CONTEXT.md`, `DEVELOPMENT_RULES.md`, `DEFINITION_OF_DONE.md` |
| 1 | Pelo domínio | `docs/architecture/modules/*.md` indicado pelo manifest |
| 2 | Quando muda contrato ou decisão | ADR, `decision-log.md`, implementação relacionada |
| 3 | Apenas para bloqueio/incidente | `FAILURE_PLAYBOOK.md`, `KNOWN_ISSUES.md`, runbook aplicável |

O manifest em `.agent/context-manifest.json` é a única fonte para roteamento de
contexto. Atualize-o ao introduzir um domínio ou alterar a localização de um contrato.
