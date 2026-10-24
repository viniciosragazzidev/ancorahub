# Auditoria de desvios visuais do modo diretor

Data da varredura: 2026-10-24. Checkout: ancorahub-lite-listas, branch feat/lite-listas, HEAD 5026f66e.

## Escopo e método

Arquivos varridos: **825** arquivos .tsx e .css. Inclui src/app/(dashboard), src/features/<feature>/components e src/components, excluindo src/components/arc, src/components/light e src/components/chat. A busca segue os padrões de exclusão do ripgrep.

As contagens são ocorrências lexicais, sem deduplicação entre categorias. from-/via-/to- contam como sinais de gradiente; paletas nessas mesmas classes também podem entrar em cores. h-7/h-8/h-9 e size=sm/icon são sinais aproximados de alvos pequenos, pois classes de altura podem aparecer em controles que não são botões. O total de desvios soma gradientes, sombras, pesos fora de 400 a 700, uppercase, tracking amplo, cores cruas, valores arbitrários, classes dark e sinais de alvo pequeno. Imports e bibliotecas são inventário separado e não entram nessa soma.

## Totais por categoria

| Categoria | Ocorrências | Arquivos com ocorrência |
| --- | --- | --- |
| Gradientes | 132 | 31 |
| Sombras | 591 | 244 |
| Pesos fora 400-700 | 2 | 2 |
| Texto uppercase | 172 | 74 |
| Tracking amplo | 131 | 57 |
| Cores cruas | 1619 | 175 |
| Valores arbitrários | 1193 | 254 |
| Classes dark | 316 | 78 |
| Sinais de alvo <44px | 1201 | 282 |

Total de sinais de desvio: **5357**. Arquivos com ao menos um sinal: **483 de 825**.

## Totais por rota ou feature

| Rota/feature | Arquivos | Desvios | Grad. | Sombras | Peso | Upper + track | Cores | Arbitr. | Dark | Alvo <44 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rota /leads | 21 | 525 | 1 | 12 | 0 | 20 | 294 | 85 | 54 | 59 |
| components (raiz) | 55 | 372 | 2 | 34 | 0 | 21 | 96 | 82 | 25 | 112 |
| components/ui | 133 | 305 | 1 | 57 | 0 | 4 | 87 | 73 | 41 | 42 |
| rota /conversas | 7 | 268 | 1 | 14 | 0 | 12 | 93 | 91 | 17 | 40 |
| rota /qualificacao | 9 | 212 | 0 | 4 | 0 | 14 | 91 | 42 | 13 | 48 |
| feature leads | 19 | 185 | 0 | 12 | 0 | 19 | 31 | 46 | 2 | 75 |
| rota /leads/distribuicao | 12 | 161 | 0 | 1 | 0 | 0 | 36 | 91 | 8 | 25 |
| rota /leads/:id | 10 | 157 | 4 | 16 | 0 | 26 | 8 | 48 | 18 | 37 |
| rota /settings | 24 | 153 | 4 | 27 | 0 | 2 | 43 | 31 | 6 | 40 |
| feature onboarding | 13 | 140 | 28 | 16 | 0 | 13 | 45 | 15 | 12 | 11 |
| feature automations | 3 | 139 | 0 | 0 | 0 | 2 | 91 | 7 | 29 | 10 |
| rota /assistente | 2 | 130 | 3 | 5 | 0 | 7 | 66 | 34 | 1 | 14 |
| rota /leads/distribuicao/plantao | 20 | 114 | 0 | 2 | 0 | 0 | 2 | 70 | 1 | 39 |
| components/whatsapp | 12 | 113 | 10 | 12 | 1 | 0 | 80 | 1 | 1 | 8 |
| feature workflow-automation | 1 | 99 | 0 | 10 | 0 | 3 | 38 | 12 | 10 | 26 |
| feature reports | 4 | 98 | 16 | 4 | 0 | 4 | 28 | 21 | 8 | 17 |
| feature conversation-intelligence | 3 | 97 | 13 | 7 | 0 | 8 | 34 | 20 | 9 | 6 |
| feature broker-workspace | 58 | 96 | 1 | 56 | 0 | 0 | 2 | 13 | 0 | 24 |
| components/motion | 19 | 95 | 0 | 12 | 0 | 0 | 34 | 18 | 11 | 20 |
| rota /relatorios | 22 | 91 | 0 | 2 | 0 | 2 | 35 | 4 | 11 | 37 |
| feature meta-ads | 12 | 86 | 0 | 12 | 0 | 9 | 13 | 33 | 4 | 15 |
| components/base | 16 | 80 | 6 | 43 | 0 | 0 | 14 | 4 | 0 | 13 |
| rota /propostas | 2 | 75 | 0 | 9 | 0 | 6 | 31 | 9 | 0 | 20 |
| feature noc | 2 | 72 | 0 | 3 | 0 | 4 | 39 | 8 | 11 | 7 |
| feature goals | 4 | 65 | 9 | 8 | 0 | 6 | 25 | 2 | 4 | 11 |
| feature financeiro | 2 | 64 | 0 | 6 | 0 | 16 | 16 | 8 | 3 | 15 |
| feature communication-channels | 11 | 56 | 0 | 16 | 0 | 2 | 9 | 2 | 0 | 27 |
| feature documents | 2 | 53 | 4 | 6 | 0 | 4 | 12 | 14 | 1 | 12 |
| rota /vendas/:id | 4 | 51 | 0 | 6 | 0 | 2 | 29 | 1 | 5 | 8 |
| components/foundations | 15 | 50 | 0 | 14 | 0 | 2 | 5 | 10 | 0 | 19 |
| components/data-table | 13 | 49 | 0 | 0 | 0 | 0 | 7 | 9 | 0 | 33 |
| rota /roadmap | 1 | 48 | 0 | 10 | 0 | 2 | 18 | 14 | 0 | 4 |
| rota /clientes/:clientId | 2 | 46 | 4 | 9 | 0 | 18 | 0 | 8 | 0 | 7 |
| rota /marketing/importacoes | 2 | 41 | 0 | 3 | 0 | 2 | 18 | 14 | 0 | 4 |
| rota /equipe/cargos | 2 | 38 | 0 | 4 | 0 | 7 | 1 | 17 | 0 | 9 |
| rota /minha-fila | 5 | 35 | 0 | 4 | 0 | 2 | 3 | 13 | 0 | 13 |
| feature ai-qualification | 3 | 34 | 0 | 1 | 0 | 2 | 11 | 4 | 1 | 15 |
| feature journey | 18 | 33 | 12 | 9 | 0 | 1 | 11 | 0 | 0 | 0 |
| rota /equipe | 10 | 32 | 0 | 2 | 0 | 0 | 11 | 6 | 0 | 13 |
| components/agent-drawer | 3 | 30 | 0 | 4 | 0 | 4 | 2 | 7 | 0 | 13 |
| rota /leads/distribuicao/plantao/:scheduleId | 1 | 29 | 1 | 6 | 0 | 2 | 0 | 9 | 0 | 11 |
| feature next-best-action | 4 | 28 | 4 | 3 | 0 | 6 | 0 | 5 | 0 | 10 |
| rota /equipe/:id | 5 | 27 | 0 | 4 | 0 | 0 | 4 | 16 | 0 | 3 |
| components/branding | 1 | 26 | 0 | 0 | 0 | 0 | 24 | 0 | 2 | 0 |
| components/onboarding | 5 | 26 | 0 | 2 | 0 | 4 | 3 | 4 | 0 | 13 |
| feature operator-catalog | 5 | 25 | 0 | 0 | 0 | 0 | 0 | 16 | 0 | 9 |
| rota /integrations/whats_alt | 6 | 25 | 0 | 4 | 0 | 0 | 0 | 8 | 0 | 13 |
| feature catalog | 2 | 24 | 0 | 1 | 0 | 1 | 8 | 2 | 2 | 10 |
| feature relationship | 9 | 24 | 1 | 10 | 0 | 0 | 4 | 0 | 0 | 9 |
| rota /noc | 2 | 24 | 0 | 5 | 0 | 2 | 9 | 2 | 1 | 5 |
| feature branches | 8 | 23 | 0 | 0 | 0 | 0 | 5 | 2 | 0 | 16 |
| feature customer-record | 1 | 23 | 0 | 1 | 0 | 14 | 0 | 8 | 0 | 0 |
| feature promotional-materials | 2 | 23 | 0 | 3 | 0 | 0 | 4 | 1 | 0 | 15 |
| feature dashboard | 8 | 22 | 0 | 1 | 0 | 3 | 0 | 14 | 0 | 4 |
| rota /integrations/whatsapp | 6 | 22 | 0 | 4 | 0 | 1 | 7 | 4 | 2 | 4 |
| feature commissions | 1 | 21 | 0 | 6 | 0 | 2 | 0 | 3 | 0 | 10 |
| feature user-profile | 6 | 20 | 0 | 8 | 0 | 0 | 6 | 1 | 0 | 5 |
| feature notifications | 1 | 19 | 0 | 5 | 0 | 0 | 0 | 2 | 0 | 12 |
| rota /notificacoes | 3 | 19 | 0 | 1 | 0 | 4 | 1 | 8 | 0 | 5 |
| components/application | 1 | 16 | 0 | 2 | 0 | 0 | 0 | 13 | 0 | 1 |
| feature broker-availability | 5 | 15 | 0 | 6 | 0 | 1 | 0 | 1 | 0 | 7 |
| feature conversations | 3 | 15 | 0 | 0 | 0 | 0 | 2 | 7 | 0 | 6 |
| feature super-admin | 2 | 15 | 7 | 4 | 0 | 0 | 4 | 0 | 0 | 0 |
| rota /atendimento/situacoes | 4 | 15 | 0 | 0 | 0 | 0 | 0 | 9 | 0 | 6 |
| rota /atendimento/mensagens | 3 | 13 | 0 | 0 | 0 | 0 | 0 | 7 | 0 | 6 |
| rota /integridade | 1 | 13 | 0 | 2 | 0 | 2 | 4 | 3 | 0 | 2 |
| rota /leads/distribuicao/queues | 4 | 12 | 0 | 0 | 0 | 0 | 1 | 7 | 0 | 4 |
| components/pdf | 15 | 11 | 0 | 0 | 0 | 11 | 0 | 0 | 0 | 0 |
| components/setup | 1 | 11 | 0 | 3 | 0 | 0 | 2 | 0 | 1 | 5 |
| rota /clientes | 3 | 11 | 0 | 1 | 0 | 0 | 2 | 2 | 0 | 6 |
| components/dashboard | 7 | 10 | 0 | 1 | 0 | 0 | 0 | 6 | 0 | 3 |
| feature lead-tags | 3 | 10 | 0 | 0 | 0 | 0 | 1 | 3 | 0 | 6 |
| rota /equipe/recuperacoes | 2 | 10 | 0 | 1 | 0 | 0 | 5 | 0 | 0 | 4 |
| feature guide | 1 | 9 | 0 | 2 | 0 | 2 | 0 | 1 | 0 | 4 |
| rota /assinatura | 1 | 9 | 0 | 3 | 0 | 2 | 2 | 0 | 0 | 2 |
| rota /internal/design-system/motion | 1 | 9 | 0 | 1 | 1 | 0 | 1 | 1 | 0 | 5 |
| rota /dashboard | 2 | 8 | 0 | 0 | 0 | 0 | 0 | 6 | 0 | 2 |
| rota /unidades/:branchId | 2 | 8 | 0 | 3 | 0 | 0 | 0 | 4 | 0 | 1 |
| rota /vendas | 3 | 8 | 0 | 1 | 0 | 0 | 0 | 1 | 0 | 6 |
| rota /equipe/minha | 2 | 7 | 0 | 0 | 0 | 0 | 0 | 6 | 0 | 1 |
| rota /settings/feedback-templates | 2 | 7 | 0 | 2 | 0 | 0 | 0 | 4 | 0 | 1 |
| feature qualification-turbo | 2 | 6 | 0 | 0 | 0 | 0 | 0 | 4 | 0 | 2 |
| rota /atendimento/fluxo | 2 | 6 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 5 |
| rota /empresas | 1 | 6 | 0 | 4 | 0 | 0 | 0 | 0 | 0 | 2 |
| rota /guia/webhook | 2 | 6 | 0 | 0 | 0 | 0 | 3 | 1 | 0 | 2 |
| rota /jornada | 2 | 6 | 0 | 0 | 0 | 0 | 0 | 5 | 0 | 1 |
| rota /internal/design-system | 1 | 5 | 0 | 0 | 0 | 0 | 1 | 2 | 0 | 2 |
| feature assist | 9 | 4 | 0 | 4 | 0 | 0 | 0 | 0 | 0 | 0 |
| feature performance | 1 | 4 | 0 | 0 | 0 | 0 | 3 | 0 | 0 | 1 |
| feature post-sale | 2 | 4 | 0 | 2 | 0 | 0 | 0 | 0 | 0 | 2 |
| feature roadmap | 1 | 4 | 0 | 1 | 0 | 0 | 1 | 1 | 0 | 1 |
| rota /desempenho | 1 | 4 | 0 | 4 | 0 | 0 | 0 | 0 | 0 | 0 |
| rota /leads/arquivados | 1 | 4 | 0 | 0 | 0 | 0 | 2 | 1 | 1 | 0 |
| rota /leads/dashboard | 1 | 4 | 0 | 3 | 0 | 0 | 0 | 1 | 0 | 0 |
| feature payment-proof-validator | 1 | 3 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 2 |
| rota /equipe/minha/configurar | 1 | 2 | 0 | 0 | 0 | 0 | 0 | 2 | 0 | 0 |
| rota /settings/extension | 4 | 2 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| components/illustrations | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 |
| components/providers | 3 | 1 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| rota /equipe/convidar | 1 | 1 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| rota /marketing/campanhas | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 |
| rota /relacionamento | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 |
| rota /relatorios/drill/:drillId | 1 | 1 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| rota /settings/waha-diagnostic | 1 | 1 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 |
| components/loading | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| components/notifications | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| components/plugins | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| components/unlumen-ui | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| feature global-catalog | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| feature platform-admin | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| feature tools | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| rota / (início) | 4 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| rota /agenda | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| rota /atendimento | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| rota /configuracoes/comissoes | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| rota /conversas/broker | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| rota /conversas/dashboard | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| rota /cotacao | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| rota /dashboard/c/:assistant | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| rota /dashboard/drill/:drillId | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| rota /distribuicao | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| rota /distribuicao/dashboard | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| rota /documentos | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| rota /equipe/dashboard | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| rota /equipe/desempenho | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| rota /equipe/plantao | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| rota /equipe/repassar | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| rota /equipe/transferencia | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| rota /ferramentas | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| rota /ferramentas/materiais-operadoras | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| rota /ferramentas/validador-comprovante | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| rota /filiais | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| rota /fluxos-whatsapp | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| rota /gestao | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| rota /gestao/equipes/:supervisorId | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| rota /guia | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| rota /integrations | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| rota /integrations/meta | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| rota /leads/:id/feedback | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| rota /marketing | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| rota /marketing/campanhas/:id | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| rota /marketing/meta | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| rota /mensagens | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| rota /mensagens/:leadId | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| rota /plantoes | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| rota /plantoes/agora | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| rota /plantoes/corretor/:brokerId | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| rota /qualificacao/turbo | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| rota /settings/integrations | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| rota /settings/meta | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| rota /settings/whatsapp | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| rota /tarefas/dashboard | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| rota /vendas/dashboard | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| rota /welcome | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## 60 arquivos com mais desvios

Ordenados pela soma dos indicadores visuais descritos acima; empates por caminho. Colunas UI e Arc são números de imports por arquivo; Ícones e Charts são imports de bibliotecas.

| Arquivo | Rota/feature | Total | Grad. | Sombras | Peso | Upper | Tracking | Cores | Arbitr. | Dark | Alvo <44 | UI | Arc | Ícones | Charts |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| src/app/(dashboard)/leads/leads-table-columns.tsx | rota /leads | 232 | 0 | 0 | 0 | 0 | 0 | 177 | 13 | 38 | 4 | 5 | 0 | 1 | 0 |
| src/app/(dashboard)/conversas/conversations-workspace.tsx | rota /conversas | 173 | 0 | 4 | 0 | 5 | 3 | 68 | 59 | 14 | 20 | 17 | 0 | 1 | 0 |
| src/app/(dashboard)/assistente/_components/assistente-chat-client.tsx | rota /assistente | 130 | 3 | 5 | 0 | 4 | 3 | 66 | 34 | 1 | 14 | 7 | 0 | 1 | 0 |
| src/app/(dashboard)/leads/leads-workspace.tsx | rota /leads | 105 | 0 | 3 | 0 | 0 | 0 | 73 | 17 | 8 | 4 | 14 | 0 | 0 | 0 |
| src/components/corretop-sidebar.tsx | components (raiz) | 102 | 0 | 8 | 0 | 2 | 0 | 58 | 11 | 17 | 6 | 7 | 0 | 1 | 0 |
| src/features/workflow-automation/components/workflow-automation-studio.tsx | feature workflow-automation | 99 | 0 | 10 | 0 | 3 | 0 | 38 | 12 | 10 | 26 | 6 | 0 | 1 | 0 |
| src/components/whatsapp/whatsapp-plantao-notice.module.css | components/whatsapp | 85 | 8 | 11 | 1 | 0 | 0 | 65 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| src/features/onboarding/components/welcome-screen.tsx | feature onboarding | 85 | 22 | 11 | 0 | 1 | 1 | 36 | 1 | 11 | 2 | 3 | 0 | 0 | 0 |
| src/app/(dashboard)/leads/[id]/page.tsx | rota /leads/:id | 80 | 0 | 11 | 0 | 7 | 7 | 4 | 29 | 16 | 6 | 5 | 0 | 0 | 0 |
| src/app/(dashboard)/conversas/official-broker-conversations.tsx | rota /conversas | 79 | 1 | 3 | 0 | 2 | 2 | 25 | 26 | 3 | 17 | 14 | 0 | 1 | 0 |
| src/app/(dashboard)/qualificacao/_components/situational-playbooks-panel.tsx | rota /qualificacao | 79 | 0 | 3 | 0 | 0 | 0 | 33 | 14 | 5 | 24 | 10 | 0 | 1 | 0 |
| src/app/(dashboard)/leads/distribuicao/_components/queue-control-center.tsx | rota /leads/distribuicao | 76 | 0 | 0 | 0 | 0 | 0 | 23 | 45 | 4 | 4 | 11 | 0 | 0 | 0 |
| src/app/(dashboard)/propostas/_components/propostas-client.tsx | rota /propostas | 75 | 0 | 9 | 0 | 3 | 3 | 31 | 9 | 0 | 20 | 14 | 0 | 1 | 0 |
| src/features/conversation-intelligence/components/negotiations-radar-tab.tsx | feature conversation-intelligence | 71 | 6 | 6 | 0 | 4 | 4 | 26 | 14 | 7 | 4 | 6 | 0 | 1 | 0 |
| src/app/(dashboard)/qualificacao/_components/agent-triggers-panel.tsx | rota /qualificacao | 65 | 0 | 0 | 0 | 4 | 4 | 26 | 14 | 7 | 10 | 10 | 0 | 1 | 0 |
| src/app/(dashboard)/qualificacao/_components/qualification-hub-client.tsx | rota /qualificacao | 65 | 0 | 0 | 0 | 3 | 3 | 32 | 14 | 1 | 12 | 11 | 0 | 1 | 0 |
| src/features/reports/components/lead-quality-center.tsx | feature reports | 61 | 16 | 1 | 0 | 4 | 0 | 12 | 21 | 1 | 6 | 3 | 0 | 1 | 0 |
| src/app/(dashboard)/settings/_components/integrations-tab.tsx | rota /settings | 57 | 0 | 0 | 0 | 0 | 0 | 20 | 24 | 2 | 11 | 9 | 0 | 1 | 0 |
| src/app/(dashboard)/leads/_components/leads-filters.tsx | rota /leads | 56 | 0 | 4 | 0 | 9 | 9 | 0 | 16 | 0 | 18 | 6 | 0 | 0 | 0 |
| src/components/ui/badge.tsx | components/ui | 55 | 0 | 0 | 0 | 0 | 0 | 36 | 0 | 18 | 1 | 0 | 0 | 0 | 0 |
| src/features/automations/components/automations-client.tsx | feature automations | 51 | 0 | 0 | 0 | 0 | 0 | 31 | 5 | 8 | 7 | 10 | 0 | 0 | 0 |
| src/features/automations/components/ai-agent-wizard-client.tsx | feature automations | 49 | 0 | 0 | 0 | 1 | 1 | 35 | 1 | 11 | 0 | 7 | 0 | 0 | 0 |
| src/app/(dashboard)/roadmap/page.tsx | rota /roadmap | 48 | 0 | 10 | 0 | 2 | 0 | 18 | 14 | 0 | 4 | 4 | 0 | 0 | 0 |
| src/features/noc/components/noc-heatmap.tsx | feature noc | 48 | 0 | 2 | 0 | 4 | 0 | 25 | 8 | 7 | 2 | 5 | 0 | 0 | 0 |
| src/app/(dashboard)/clientes/[clientId]/page.tsx | rota /clientes/:clientId | 46 | 4 | 9 | 0 | 9 | 9 | 0 | 8 | 0 | 7 | 5 | 0 | 0 | 0 |
| src/components/status-badges.tsx | components (raiz) | 44 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 44 | 0 | 0 | 1 | 0 |
| src/features/financeiro/components/commission-details.tsx | feature financeiro | 43 | 0 | 4 | 0 | 7 | 7 | 8 | 8 | 2 | 7 | 9 | 0 | 0 | 0 |
| src/app/(dashboard)/marketing/importacoes/_components/marketing-import-client.tsx | rota /marketing/importacoes | 41 | 0 | 3 | 0 | 1 | 1 | 18 | 14 | 0 | 4 | 6 | 0 | 0 | 0 |
| src/features/automations/components/whatsapp-flows-client.tsx | feature automations | 39 | 0 | 0 | 0 | 0 | 0 | 25 | 1 | 10 | 3 | 6 | 0 | 0 | 0 |
| src/app/(dashboard)/equipe/cargos/workspace.tsx | rota /equipe/cargos | 38 | 0 | 4 | 0 | 3 | 4 | 1 | 17 | 0 | 9 | 10 | 0 | 0 | 0 |
| src/app/(dashboard)/relatorios/_components/funnel-section.tsx | rota /relatorios | 38 | 0 | 0 | 0 | 0 | 0 | 29 | 0 | 9 | 0 | 0 | 0 | 0 | 0 |
| src/features/leads/components/broker-documents-panel.tsx | feature leads | 36 | 0 | 2 | 0 | 0 | 0 | 16 | 6 | 0 | 12 | 2 | 0 | 0 | 0 |
| src/app/(dashboard)/leads/distribuicao/_components/distribution-inbox.tsx | rota /leads/distribuicao | 35 | 0 | 0 | 0 | 0 | 0 | 11 | 10 | 4 | 10 | 9 | 0 | 2 | 0 |
| src/features/goals/components/broker-goal-view.tsx | feature goals | 33 | 9 | 3 | 0 | 3 | 3 | 13 | 1 | 1 | 0 | 3 | 0 | 0 | 0 |
| src/app/(dashboard)/leads/_components/manual-qualification-dialog.tsx | rota /leads | 31 | 0 | 0 | 0 | 0 | 0 | 20 | 3 | 4 | 4 | 6 | 0 | 0 | 0 |
| src/app/(dashboard)/leads/distribuicao/plantao/_components/monthly-duty-planner.tsx | rota /leads/distribuicao/plantao | 31 | 0 | 0 | 0 | 0 | 0 | 0 | 23 | 0 | 8 | 11 | 0 | 0 | 0 |
| src/components/motion/attachment-upload.tsx | components/motion | 31 | 0 | 3 | 0 | 0 | 0 | 7 | 6 | 2 | 13 | 0 | 0 | 1 | 0 |
| src/features/leads/components/daily-action-panel.tsx | feature leads | 31 | 0 | 0 | 0 | 4 | 4 | 0 | 15 | 0 | 8 | 2 | 0 | 0 | 0 |
| src/features/meta-ads/components/campaign-detail-view.tsx | feature meta-ads | 31 | 0 | 7 | 0 | 1 | 1 | 1 | 14 | 1 | 6 | 7 | 0 | 0 | 0 |
| src/app/(dashboard)/leads/distribuicao/plantao/_components/duty-operations-workspace.tsx | rota /leads/distribuicao/plantao | 30 | 0 | 1 | 0 | 0 | 0 | 0 | 22 | 0 | 7 | 10 | 0 | 0 | 0 |
| src/app/(dashboard)/settings/_components/passkey-section.tsx | rota /settings | 30 | 4 | 5 | 0 | 1 | 1 | 2 | 4 | 1 | 12 | 4 | 0 | 0 | 0 |
| src/components/motion/animated-toast.tsx | components/motion | 30 | 0 | 4 | 0 | 0 | 0 | 15 | 4 | 6 | 1 | 0 | 0 | 1 | 0 |
| src/app/(dashboard)/leads/distribuicao/plantao/[scheduleId]/page.tsx | rota /leads/distribuicao/plantao/:scheduleId | 29 | 1 | 6 | 0 | 1 | 1 | 0 | 9 | 0 | 11 | 8 | 0 | 1 | 0 |
| src/components/agent-drawer/agent-drawer.tsx | components/agent-drawer | 29 | 0 | 4 | 0 | 2 | 2 | 2 | 6 | 0 | 13 | 5 | 0 | 1 | 0 |
| src/features/communication-channels/components/meta-manual-integration-workspace.tsx | feature communication-channels | 29 | 0 | 11 | 0 | 0 | 0 | 0 | 0 | 0 | 18 | 6 | 0 | 0 | 0 |
| src/app/(dashboard)/leads/[id]/supervision-panel.tsx | rota /leads/:id | 27 | 3 | 1 | 0 | 3 | 3 | 2 | 7 | 1 | 7 | 7 | 0 | 0 | 0 |
| src/features/documents/components/lead-documents-section.tsx | feature documents | 27 | 4 | 4 | 0 | 2 | 2 | 0 | 9 | 0 | 6 | 3 | 0 | 1 | 0 |
| src/components/branding/animated-logo.tsx | components/branding | 26 | 0 | 0 | 0 | 0 | 0 | 24 | 0 | 2 | 0 | 0 | 0 | 0 | 0 |
| src/components/ui/sidebar.tsx | components/ui | 26 | 0 | 3 | 0 | 0 | 0 | 3 | 12 | 0 | 8 | 7 | 0 | 0 | 0 |
| src/features/documents/components/documents-workspace.tsx | feature documents | 26 | 0 | 2 | 0 | 0 | 0 | 12 | 5 | 1 | 6 | 11 | 0 | 0 | 0 |
| src/features/reports/components/lead-quality-simple.tsx | feature reports | 26 | 0 | 3 | 0 | 0 | 0 | 16 | 0 | 7 | 0 | 2 | 0 | 0 | 0 |
| src/features/conversation-intelligence/components/ai-conversation-insight-card.tsx | feature conversation-intelligence | 25 | 7 | 1 | 0 | 0 | 0 | 8 | 5 | 2 | 2 | 4 | 0 | 1 | 0 |
| src/features/meta-ads/components/campaigns-dashboard-view.tsx | feature meta-ads | 25 | 0 | 1 | 0 | 0 | 1 | 6 | 11 | 3 | 3 | 5 | 0 | 0 | 0 |
| src/app/(dashboard)/leads/_components/lead-assignment-history.tsx | rota /leads | 24 | 0 | 2 | 0 | 0 | 0 | 2 | 18 | 0 | 2 | 1 | 0 | 0 | 0 |
| src/app/(dashboard)/noc/noc-client.tsx | rota /noc | 24 | 0 | 5 | 0 | 1 | 1 | 9 | 2 | 1 | 5 | 5 | 0 | 0 | 1 |
| src/features/noc/components/noc-anomaly-alerts.tsx | feature noc | 24 | 0 | 1 | 0 | 0 | 0 | 14 | 0 | 4 | 5 | 1 | 0 | 0 | 0 |
| src/app/(dashboard)/leads/distribuicao/_components/routing-matrix-panel.tsx | rota /leads/distribuicao | 23 | 0 | 0 | 0 | 0 | 0 | 1 | 18 | 0 | 4 | 10 | 0 | 1 | 0 |
| src/features/catalog/components/catalog-client.tsx | feature catalog | 23 | 0 | 1 | 0 | 1 | 0 | 7 | 2 | 2 | 10 | 11 | 0 | 0 | 0 |
| src/features/customer-record/components/person-record-details.tsx | feature customer-record | 23 | 0 | 1 | 0 | 7 | 7 | 0 | 8 | 0 | 0 | 2 | 0 | 0 | 0 |
| src/app/(dashboard)/minha-fila/page.tsx | rota /minha-fila | 22 | 0 | 3 | 0 | 1 | 1 | 0 | 13 | 0 | 4 | 3 | 0 | 0 | 0 |

## Imports de UI e Arc

Imports de @/components/ui: **1450** em **381** arquivos.
Imports de @/components/arc: **121** em **48** arquivos.

## Bibliotecas de ícones

| Biblioteca de ícones | Arquivos importadores |
| --- | --- |
| lucide-react | 97 |
| @phosphor-icons/react | 12 |
| @phosphor-icons/react/ssr | 2 |
| @hugeicons/core-free-icons | 1 |
| @hugeicons/react | 1 |

## Bibliotecas de gráficos

| Biblioteca de gráficos | Arquivos importadores |
| --- | --- |
| recharts | 8 |

## Componentes de src/components/ui por número de arquivos importadores

Ranking dos imports por alias encontrados nos 825 arquivos varridos. O módulo data-table/index.ts é um barrel e aparece como um único destino de import.

| Componente em src/components/ui | Arquivos importadores |
| --- | --- |
| src/components/ui/button.tsx | 264 |
| src/components/ui/sonner.tsx | 157 |
| src/components/ui/badge.tsx | 154 |
| src/components/ui/card.tsx | 142 |
| src/components/ui/input.tsx | 112 |
| src/components/ui/select.tsx | 79 |
| src/components/ui/dialog.tsx | 57 |
| src/components/ui/label.tsx | 46 |
| src/components/ui/table.tsx | 33 |
| src/components/ui/sheet.tsx | 31 |
| src/components/ui/dropdown-menu.tsx | 28 |
| src/components/ui/textarea.tsx | 28 |
| src/components/ui/section-card-header.tsx | 22 |
| src/components/ui/checkbox.tsx | 21 |
| src/components/ui/switch.tsx | 19 |
| src/components/ui/tabs.tsx | 16 |
| src/components/ui/data-table/data-table-frame.tsx | 15 |
| src/components/ui/tooltip.tsx | 15 |
| src/components/ui/data-table/index.ts (barrel) | 13 |
| src/components/ui/scroll-area.tsx | 13 |
| src/components/ui/user-avatar.tsx | 13 |
| src/components/ui/field.tsx | 12 |
| src/components/ui/popover.tsx | 12 |
| src/components/ui/sidebar.tsx | 12 |
| src/components/ui/separator.tsx | 11 |
| src/components/ui/skeleton.tsx | 10 |
| src/components/ui/chart.tsx | 7 |
| src/components/ui/ds-button-variants.ts | 7 |
| src/components/ui/ds-segmented-control.tsx | 7 |
| src/components/ui/responsive-data-view.tsx | 7 |
| src/components/ui/ds-empty-state.tsx | 6 |
| src/components/ui/ds-status-badge.tsx | 6 |
| src/components/ui/avatar.tsx | 4 |
| src/components/ui/context-note.tsx | 4 |
| src/components/ui/drag-scroll-table.tsx | 4 |
| src/components/ui/ds-outlined-action-button.tsx | 4 |
| src/components/ui/ds-section-header.tsx | 4 |
| src/components/ui/selection-toolbar.tsx | 4 |
| src/components/ui/button-variants.ts | 3 |
| src/components/ui/currency-input.tsx | 3 |
| src/components/ui/ds-input-field.tsx | 3 |
| src/components/ui/progress.tsx | 3 |
| src/components/ui/route-section-tabs.tsx | 3 |
| src/components/ui/search-add-list.tsx | 3 |
| src/components/ui/bubble.tsx | 2 |
| src/components/ui/command.tsx | 2 |
| src/components/ui/drawer.tsx | 2 |
| src/components/ui/ds-filled-dark-cta.tsx | 2 |
| src/components/ui/ds-tabs.tsx | 2 |
| src/components/ui/marker.tsx | 2 |
| src/components/ui/message.tsx | 2 |
| src/components/ui/animated-theme-toggler.tsx | 1 |
| src/components/ui/bulk-reassign-dialog.tsx | 1 |
| src/components/ui/bulk-status-dialog.tsx | 1 |
| src/components/ui/calendar.tsx | 1 |
| src/components/ui/combobox.tsx | 1 |
| src/components/ui/ds-bar-chart.tsx | 1 |
| src/components/ui/ds-count-up.tsx | 1 |
| src/components/ui/ds-dashboard-card.tsx | 1 |
| src/components/ui/ds-dialog.tsx | 1 |
| src/components/ui/ds-donut-chart.tsx | 1 |
| src/components/ui/ds-page-header.tsx | 1 |
| src/components/ui/ds-sheet.tsx | 1 |
| src/components/ui/ds-stat-tile.tsx | 1 |
| src/components/ui/ds-switch.tsx | 1 |
| src/components/ui/filter-toolbar.tsx | 1 |
| src/components/ui/info-tooltip.tsx | 1 |
| src/components/ui/slider.tsx | 1 |
| src/components/ui/stateful-button.tsx | 1 |
| src/components/ui/toggle.tsx | 1 |

## Leitura do resultado

A tabela superior prioriza os arquivos com maior concentração de indicadores, enquanto a tabela por rota/feature mostra onde o trabalho se agrupa. Os valores identificam alvos para revisão visual; não afirmam que toda ocorrência seja um defeito, pois a decisão final depende do contexto de cada componente e de tokens já aprovados.
