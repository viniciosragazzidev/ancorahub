# Abertura do sheet ao clicar na linha de Leads

## Escopo

Na lista principal de `/leads`, a linha inteira do lead abre o mesmo sheet de
detalhes já acionado pelo nome e pelo botão “Ver Detalhes”. Checkboxes, botões e
links continuam executando suas próprias ações sem abrir o sheet.

## Implementação

- `src/components/data-table/data-table.tsx` recebeu a API explícita
  `onRowClick` e protegeu links de navegação da ação da linha.
- `src/app/(dashboard)/leads/leads-data-table.tsx` conectou as tabelas de leads
  e de qualificação ao callback explícito, resolvendo o item original pelo ID.

## Validação

- `node_modules/.bin/tsc.cmd --noEmit` passou.
- ESLint direcionado passou sem erros; os quatro avisos `any` já existentes foram
  preservados fora do escopo desta correção.
- `node_modules/.bin/next.cmd build` passou; os avisos de `headers` em rotas
  dinâmicas são o comportamento esperado do shell autenticado durante a coleta
  estática.
