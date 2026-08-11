# Central de relatórios operacionais

## Objetivo

Concentrar em `/relatorios` exportações operacionais autorizadas, sem transferir conjuntos brutos de dados para o navegador e com escopo aplicado no servidor.

## Escopo entregue nesta etapa

- Catálogo editável em código para seis relatórios operacionais: leads, qualificação, vendas e conversão, performance de corretores, distribuição e tarefas.
- Gerador único para CSV e XLSX, com período máximo de 366 dias, limite de 10 mil linhas, sanitização contra fórmulas de planilha e auditoria por geração.
- Diretor com visão do tenant; Gestor limitado à filial autorizada; Supervisor limitado aos corretores ativos vinculados por `tenant_memberships.supervisor_id`.
- Supervisor pode gerar apenas relatórios operacionais e, no relatório de vendas, nunca recebe valor ou comissão.
- Central com seleção de período e formato, feedback de preparação, sucesso e erro.

## Decisões

- Não foram incluídos relatórios financeiros, comissões, IA, automações globais ou dados de outras unidades para Supervisor.
- A exportação é síncrona somente dentro do limite de linhas. Exportações maiores exigirão job persistido e processamento assíncrono em uma próxima etapa.

## Arquivos principais

- `src/features/reports/report-registry.ts`
- `src/features/reports/report-export-service.ts`
- `src/app/api/reports/[reportId]/route.ts`
- `src/app/(dashboard)/relatorios/_components/report-center.tsx`

## Validações executadas

- `npx vitest run src/features/reports/report-registry.test.ts --reporter=dot`: 2 testes aprovados.
- `npm run agent:verify -- --level fast`: 71 arquivos de teste e 302 testes aprovados; evidência em `reports/agent/verification/2026-08-11T20-23-54.742Z.md`.
- `npm run build`: produção compilada com a rota `/api/reports/[reportId]` incluída.

## Riscos e rollback

- O endpoint pode ser removido sem afetar os relatórios existentes de comissão.
- O limite síncrono protege banco e egress; uma necessidade de arquivo maior deve ser tratada por fila, não por aumento do limite.
