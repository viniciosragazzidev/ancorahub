# Exportação de planilha do plantão

## Escopo

Adicionar ao detalhe do plantão uma ação `Exportar planilha` ao lado de
`Exportar PDF`, gerando um arquivo `.xlsx` estruturado conforme a aba
`29092026` da planilha de referência `Setembro 2026`.

## Implementação

- A rota `GET /api/reports/duty-schedule/[scheduleId]?format=xlsx` reutiliza a
  consulta autorizada do plantão, aplica escopo de tenant/filial e registra a
  exportação em `audit_logs`.
- O arquivo contém título mesclado, cabeçalho e as colunas `CÓDIGO`, `CORRETOR`,
  `CANAL`, `CLIENTE`, `TELEFONE` e `E-MAIL`, com filtros, congelamento de linhas,
  larguras e bordas compatíveis com a referência.
- Leads usam `externalId` como código quando disponível, preservando o ID local
  como fallback; o canal PME Facebook é normalizado para `PME FACEBOOK`.
- A exportação agora inclui somente leads atribuídos, ordena pelo `assignedAt`
  do mais antigo ao mais novo, separa os blocos `MANHÃ` e `TARDE` e usa
  temporariamente o número no final do nome do corretor como `CÓDIGO`.

## Validação

- TypeScript passou.
- ESLint direcionado passou sem erros; somente avisos preexistentes de variáveis
  não utilizadas no perfil do plantão permaneceram.
- Build de produção executado após esta alteração.
