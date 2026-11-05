# Exportação da carteira atual do corretor

Status: concluído.

## Escopo e decisões

- Diretor e gestor com capacidade efetiva `exportar_relatorios_operacionais` ou `acessar_leads` podem exportar a carteira atual de um corretor.
- O gestor só acessa corretores e leads da própria unidade. O filtro é `tenantId` + `corretorId` atual; leads removidos são excluídos e convertidos/perdidos entram por padrão.
- O CSV usa UTF-8 com BOM, `;`, proteção de fórmula e streaming por lotes de 500, sem teto artificial de linhas.
- A rota registra `report.generated` com tenant, corretor, escopo e contagem, sem dados pessoais no metadata.
- A interface reutiliza Button, Checkbox e layout Lite existente; não cria token, primitive, animação nem altera a etapa global do redesign.

## Arquivos/fluxos

- `src/app/api/team/brokers/[brokerId]/leads/export/route.ts`
- `src/features/team/broker-lead-export.ts` e `broker-lead-export-access.ts`
- `src/features/reports/csv-export.ts` (também reutilizado pelo serviço existente de relatórios)
- Ação no perfil normal, perfil Lite e perfil Lite de gestor.

## Validação

- `npx tsc --noEmit`: passou.
- Vitest: 5 arquivos e 21 testes passaram (política/escopo/linhas, CSV, perfil de equipe e catálogo de relatórios).
- ESLint nos arquivos alterados: passou sem avisos.
- `git diff --check`: passou após remover uma linha em branco final da documentação.
- Build e harness não foram executados/concluídos a pedido do Maestro; o harness rápido iniciado foi encerrado.
- Variáveis `DATABASE_URL` e `SUPABASE_DB_URL` removidas dos processos de teste; nenhuma conexão ou escrita no banco foi feita.
