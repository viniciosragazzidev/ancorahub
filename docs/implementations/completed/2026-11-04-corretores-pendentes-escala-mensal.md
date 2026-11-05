# Corretores pendentes na escala mensal — 2026-11-04

## Resultado

O Diretor pode pesquisar, configurar e publicar corretores pendentes em ocorrências da escala mensal quando a flag global existente de inclusão em escala está ativa. A UI mostra o estado de convite pendente. Até o aceite, o plano publicado conserva a reserva sem criar linha de escala ativa, enviar notificação operacional ou distribuir leads.

No aceite, o onboarding promove reservas de ocorrências futuras ainda válidas para linhas datadas ativas e atualiza a referência do perfil para o usuário. Datas passadas, plantões inativos e unidades divergentes são removidos da escala e auditados. Reservas publicadas são preservadas quando a flag é desligada; uma proposta pendente não pode ser publicada com a flag desligada.

## Contrato e arquivos

- DEC-168 complementa a DEC-130 somente para escala mensal; BR-090 documenta a regra.
- `src/features/lead-distribution/monthly-duty-actions.ts` valida a política ao carregar candidatos, gerar, editar e publicar o plano; origem `pending` não cria linha ativa nem notificação.
- `src/features/lead-distribution/roster-queries.ts` expõe perfis sem conta e usuários com status pendente somente ao planejador mensal.
- `src/features/lead-distribution/duty-roster-pending.ts` promove as datas futuras no onboarding aceito e audita itens não promovidos.
- `src/features/lead-distribution/duty-plan-generation.ts` conserva a origem pendente no sorteio.
- `src/app/(dashboard)/leads/distribuicao/plantao/_components/monthly-duty-planner.tsx` identifica convites pendentes.

## Verificação

- `npm run type-check`: passou.
- `npm run agent:docs`: passou; 18 referências verificadas.
- `npm run build`: passou; Next.js 16.2.10 compilou, verificou TypeScript e gerou 130 páginas.
- Testes automatizados não foram executados nesta tarefa.

## Riscos e limites

- A flag `feature_duty_inactive_brokers_enabled` cobre esta política junto com inclusão de cadastros desativados, para preservar a configuração global existente.
- Convite aceito não recebe uma notificação retroativa pelo ato de promoção; a linha ativa segue a distribuição e os avisos operacionais existentes.
