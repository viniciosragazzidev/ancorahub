# Qualificação contextual e visibilidade de ofertas pendentes

## Objetivo

Evitar que uma frase livre seja registrada como cidade e conclua a qualificação
prematuramente; manter a primeira pergunta pendente como autoridade; exibir ofertas
ativas na aba de aceite do corretor; e preservar a criação de uma fila como rascunho
quando o usuário abrir as configurações de entradas. O aceite é que o fluxo avance
somente com fatos reconhecidos, o corretor encontre toda oferta vigente e o formulário
retome no mesmo estado após reabrir a criação.

## Escopo e arquivos

- `src/features/ai-agent/memory.ts` e seus testes: validação conservadora de cidade.
- `src/features/qualification-engine/service.ts` e `qualification-flow.test.ts`:
  primeira lacuna obrigatória e pergunta contextual de esclarecimento.
- `/minha-fila` e `LightLeadsList`: ofertas PENDING/SENT/DELIVERED/READ como fonte
  adicional da aba “Aguardando aceite”.
- `queue-control-center.tsx`: rascunho local versionado e restauração da criação de fila.
- Documentação do módulo de IA, distribuição e roadmap.

## Decisões

- Mantida a ordem determinística e o handoff existente; a IA continua apenas
  interpretando fatos permitidos e não escolhe a etapa.
- Mantida a autoridade server-side/tenant da distribuição. A oferta durável é a
  fonte de presença do lead na carteira antes do aceite, conforme DEC-104.
- Nenhuma migration ou dependência nova foi introduzida.

## Validações

- `npm test -- --run src/features/ai-agent/memory.test.ts src/features/ai-agent/qualification-flow.test.ts` — 37 testes aprovados.
- `npm test -- --run src/features/ai-agent src/features/lead-distribution/domain.test.ts src/features/lead-distribution/jobs.test.ts` — 134 testes aprovados.
- ESLint dirigido nos arquivos alterados — sem erros; avisos remanescentes são
  preexistentes em outros trechos.
- `npm run agent:verify -- --level fast` — documentação validada; interrompido no
  erro preexistente de `scripts/_tmp-diag2.ts` (`p.userId` possivelmente nulo).
- `npm run build` — compilação otimizada concluída; a etapa TypeScript foi bloqueada
  pelos mesmos artefatos preexistentes (`scripts/_tmp-diag2.ts` e contratos em
  `tests/e2e/core-flow.spec.ts`), sem erro apontado nos arquivos desta mudança.

## Riscos e rollback

Reverter o commit remove apenas a validação/visualização e o rascunho local; nenhuma
linha persistida é apagada. Rascunhos antigos podem ser descartados removendo a chave
`ancorahub:distribution:queue-draft:v1` do navegador. Ofertas e memória de qualificação
continuam duráveis e auditáveis.
