# Correção de conclusão de diálogo após exclusão de lead

## Objetivo

Impedir que o diálogo de exclusão de lead permaneça em estado pendente depois de a operação ter sido concluída no servidor.

## Diagnóstico

A exclusão lógica removia o lead da consulta da rota atual e, logo depois, revalidava
essa mesma rota. O novo render encontrava `notFound()`, o que impedia o retorno
completo da Server Action ao componente que mantinha o diálogo aberto.

## Implementação

- preservar a validação, isolamento por tenant e auditoria da exclusão;
- revalidar somente a lista ativa de leads;
- redirecionar pelo servidor para `/leads` após a mutação, fechando o diálogo pela
  troca de rota e evitando atualização manual;
- cobrir o caminho de sucesso e o de lead ausente com teste automatizado.

## Risco e rollback

O escopo se limita ao pós-sucesso da exclusão lógica. Reverter restaura a revalidação
da rota individual, mas também restaura o travamento reportado.

## Validações e evidências

- Teste focado: `src/app/(dashboard)/leads/actions.test.ts` e
  `src/features/leads/deletion-policy.test.ts` — 3 cenários aprovados.
- `npm run type-check` — aprovado.
- `npm run test` — 90 arquivos e 361 testes aprovados.
- `npm run build` — aprovado.
- `npm run agent:verify -- --level full` executou arquitetura, segurança,
  desempenho, testes e build com sucesso. O comando termina com falha somente por
  erros de lint anteriores em diretórios auxiliares fora do CRM
  (`temp_deskcomm_crm` e scripts soltos); os arquivos deste ajuste passam no linter
  de codificação e no TypeScript.
