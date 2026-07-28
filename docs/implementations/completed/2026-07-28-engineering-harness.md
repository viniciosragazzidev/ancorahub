# Engineering Harness — 28/07/2026

## Objetivo

Criar uma base permanente para descoberta de contexto, execução limitada, verificação e memória de implementação sem carregar o repositório inteiro em cada tarefa.

## Entregue

- contrato de leitura e execução em `AGENTS.md`;
- contexto em camadas e módulos de maior risco em `docs/agent` e `docs/architecture`;
- manifestos e schemas versionados em `.agent`;
- comandos de contexto, documentação, changed files, arquitetura, segurança, performance, verificação e registro;
- CI passa a validar a documentação do harness e executar testes unitários;
- baseline de qualidade documentado em `KNOWN_ISSUES.md`.

## Validações

- `npm run type-check` passou antes da alteração.
- `npm test` passou: 35 arquivos e 178 testes.
- `npm run lint` revelou baseline de 71 erros e 114 avisos, registrado como ENG-001.
- `npm run build` passou após a implantação do harness; o prebuild também gerou o pacote da extensão.
- O gate completo executou todos os diagnósticos e passou em documentação, type-check, testes e build; somente o lint falhou pelo baseline ENG-001.

## Risco e rollback

Os checkers são diagnósticos e não alteram runtime. O rollback é remover os scripts da CI e os comandos `agent:*`; nenhum dado operacional é alterado.
