# ADR-0016: Registro obrigatório de implementação no roadmap

## Contexto

O roadmap é a fonte operacional do progresso do MVP. Marcar apenas um status não
preserva o que foi entregue, quais arquivos foram afetados ou como a mudança foi
validada.

## Decisão

Toda implementação concluída deve atualizar o item correspondente em
`src/features/roadmap/roadmap-data.ts` e refletir a mudança na rota `/roadmap`.
Cada item deve registrar:

- status (`done`, `partial`, `planned` ou `external`);
- descrição do escopo funcional entregue;
- resumo técnico da implementação;
- arquivos e fluxos afetados;
- validações executadas, como type-check, testes, lint ou build;
- pendências, quando o status não for `done`.

## Consequências

O status `done` passa a exigir evidência objetiva. Entregas incrementais permanecem
como `partial` até que o escopo esteja completo, evitando que o roadmap comunique
progresso maior que o produto real.
