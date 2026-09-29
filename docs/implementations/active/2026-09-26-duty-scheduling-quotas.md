# Escala mensal de plantões por cotas

## Objetivo

Adicionar classificação configurável aos plantões e permitir que a gestão monte escalas mensais por cota, com geração determinística, revisão, ajustes e publicação auditada, sem mudar o motor de distribuição de leads.

## Modelo atual e fonte de verdade

- `unit_duty_schedules` continua sendo a definição recorrente semanal, global por corretora segundo DEC-110.
- `duty_roster_assignments` continua sendo o roster recorrente usado pelos resolvedores em produção.
- `duty_presence_confirmations` já representa confirmações de ocorrências em datas locais, mas não é a fonte de atribuição da escala mensal.
- Tipos são catálogo por tenant e classificação somente. Plantões legados podem manter `typeId = null`.
- O limite máximo é opcional; `null` significa sem teto e mantém compatibilidade.

## Plano de entrega

1. Registrar a decisão, regras e vocabulário de domínio antes de alterar o comportamento.
2. Estender a definição recorrente com tipo e capacidade máxima, catálogo arquivável por tenant, validação server-side, trilha de auditoria e controles administrativos.
3. Modelar períodos mensais, cotas editáveis em lote, propostas versionadas e itens de escala por ocorrência sem reaproveitar incorretamente linhas semanais.
4. Implementar motor puro, determinístico e testado: elegibilidade, cobertura temporal, limite máximo, conflito com escalas publicadas, cota, ocupação, distribuição semanal e espaçamento; insuficiências são reportadas, nunca forçadas.
5. Implementar fluxo gestão: mês → cotas → gerar rascunho → revisar conflitos/pendências → editar → publicar transacionalmente e idempotentemente.
6. Ao publicar, materializar ocorrências em uma fonte que o runtime consuma explicitamente, auditar e gerar uma notificação in-app consolidada. Não acoplar o motor a provedores externos.
7. Expor “Minha escala” para corretor, respeitando tenant e identidade, e controles globais reversíveis para Super-admin.
8. Fazer rollout por feature flag global, ativa por padrão após a migration 0160; manter a possibilidade de desativação auditada pelo Super-admin.
9. Atualizar `/roadmap`, `src/features/roadmap/roadmap-data.ts`, changelog UX e registro de implementação com escopo entregue e evidências.

## Estado da implementação

Já entregue no código desta etapa:

- A tela `/distribuicao?view=plantao` inclui configuração da cota por corretor e mês.
- A ação de geração resolve ocorrências semanais dentro do mês, separa unidades, considera janelas de disponibilidade, capacidade, conflitos de horário e cotas, e grava uma revisão em rascunho.
- Rascunhos podem ser consultados novamente; um mês publicado não pode ser gerado por cima.
- A publicação revalida vínculo, unidade, regra do plantão e capacidade; materializa cada ocorrência como atribuição válida somente no dia local. O runtime prioriza essa atribuição naquele plantão/unidade/data e preserva o roster semanal nos outros dias.
- O corretor consulta em `/minha-fila` somente as ocorrências publicadas associadas à própria identidade, tanto na experiência padrão quanto no Corretor Lite. A leitura e a seção visual ficam atrás da mesma feature flag.
- Publicação usa transação, proteção contra concorrência, auditoria e notificação in-app por corretor. A confirmação de presença atual pode operar nas atribuições materializadas usando o processador existente.
- A flag global `feature_duty_monthly_scheduling_enabled`, ativa por padrão quando não há configuração salva, tem ação auditada no painel Super-admin. Um valor explícito `false` continua prevalecendo.
- Migration `0160_duty_schedule_monthly_plans.sql` cria armazenamento versionado mensal sem alterar o roster semanal existente.
- Teste do alocador cobre restrição por unidade.

Ainda pendente: teste autenticado de ponta a ponta. A migration 0160 foi aplicada de forma isolada e transacional ao banco configurado em `.env.local` e registrada no histórico do Drizzle antes da mudança do padrão. O N97 segue parcial até QA e validação do rollout.

### Refinamento da interface de planejamento

- A rota mantém apenas um resumo da escala mensal, com mês, situação e alocações. O editor de cotas foi transferido para o `Sheet` compartilhado.
- O sheet separa os meses, mantém o mês selecionado em `escalaMes` na URL, agrupa corretores elegíveis por unidade, oferece busca e controles de quantidade por corretor. Rascunho e publicação têm revisão própria, totais e confirmação contextual.
- Alterações de cota ficam locais até gerar uma nova proposta. O fechamento com alterações pendentes pede confirmação para descartá-las; trocar de mês preserva as edições enquanto o painel permanecer aberto.
- Com a flag desligada, o componente não consulta a tabela mensal e informa a indisponibilidade. Meses publicados ficam em leitura. O sheet usa a transição existente e os realces de seleção usam os tokens de motion com suporte a movimento reduzido.
- Esta mudança de composição não altera elegibilidade, alocação, permissões, auditoria ou publicação. Permanecem pendentes build e QA autenticado nas larguras previstas em UX-M1.10.

## UX e permissões

Gestão: Diretor no tenant e Gestor em unidades autorizadas; ações de editar cota, gerar, alterar e publicar sempre revalidadas no servidor. Corretor vê apenas as próprias ocorrências publicadas. A interface deve indicar ocupação/capacidade, cotas não atendidas, conflitos, estado do rascunho e resultado da publicação; estados vazio, erro e carregamento; edição em lote; confirmação de publicação; navegação por teclado e layout estreito. Reutilizar os componentes e tokens existentes, sem nova primitiva visual.

## Segurança e integridade

Tenant e escopo derivam da sessão no servidor. Toda FK e leitura cruza o tenant. Cotas, geração, edição, publicação e cancelamento geram auditoria. Publicação deve revalidar versão, capacidade, conflito temporal e permissões na mesma transação e usar chave de idempotência. Não alterar silenciosamente escala publicada: novas gerações criam revisão e preservam ocorrências já publicadas.

## Rollback e compatibilidade

Campos opcionais não alteram linhas existentes. O resolver atual continuará consultando o roster semanal sem linhas de ocorrência. A flag interrompe geração/publicação, sem apagar rascunhos nem histórico. A camada datada só passa a afetar distribuição depois de contrato de runtime explicitamente testado.

## Validação da base anterior

- `node node_modules/typescript/bin/tsc --noEmit`: passou.
- `node node_modules/vitest/vitest.mjs run src/features/lead-distribution/duty-scheduling-engine.test.ts`: passou (4 testes).
- ESLint dos arquivos alterados: passou; a tela mantém um aviso preexistente `react-hooks/set-state-in-effect` no debounce de busca.
- `node node_modules/next/dist/bin/next build`: passou após corrigir a captura da filial na transação.
- O prebuild padrão da extensão falhou por acesso negado do esbuild ao diretório acima do workspace; o comando `npm` também aponta para `npm-cli.js` inexistente.
- Harness `agent:context`/`agent:verify --level full` não executou: o primeiro falha pelo launcher npm e a chamada direta ao `tsx` falha com `uv_os_get_passwd returned ENOMEM`.
- Migration 0159 foi criada e registrada, mas não aplicada a banco nesta etapa.

## Validação da gestão mensal

- `node node_modules/vitest/vitest.mjs run src/features/lead-distribution/duty-scheduling-engine.test.ts src/features/lead-distribution/dated-duty-roster.test.ts`: 10 testes passaram, incluindo elegibilidade restrita por unidade e preferência da atribuição datada no dia correto.
- ESLint do motor, ações mensais e resolvedores de runtime tocados passou sem avisos.
- ESLint direcionado aos arquivos de escala, UI, schema, flags e roadmap: sem erros. Restaram apenas avisos preexistentes em `duty-operations-workspace.tsx` (estado do debounce) e em duas ações preexistentes do Super-admin.
- `tsc --noEmit` não terminou após 30 segundos sem produzir saída; foi interrompido por consumo alto de memória e não conta como aprovado.
- `next build` foi iniciado e permaneceu mais de dois minutos na compilação otimizada sem resultado final; build não confirmado.
- `git diff --check` não encontrou erros de whitespace; Git emitiu avisos de conversão LF/CRLF no working tree.
- Migration 0160 foi criada e registrada; não foi aplicada a banco nesta etapa.

Evidência: `reports/agent/verification/2026-09-26-duty-scheduling-quotas.md`. A entrega permanece `partial`: Minha escala está implementada; build e regressão autenticada ainda não foram confirmados nesta sessão.
