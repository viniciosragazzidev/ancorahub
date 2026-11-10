# Corretor troca a própria unidade em Configurações

Status: implementado na branch `feat/corretor-troca-unidade` (sem merge nem push).
Decisão: DEC-171. Regra: BR-013A.

## Como a unidade do corretor é guardada hoje

- `tenant_memberships.branch_id`: a unidade que vale para o contexto (`getRequiredTenantContext().branchId`),
  escopo do gestor (`manager-unit-scope*.ts` filtram por ela), distribuição sem plantão
  (`lead-distribution/service.ts` exige o corretor na unidade do lead) e listas de equipe.
- `broker_profiles.branch_id`: cópia usada por Conversas e telas de equipe do gestor. A gestão
  (`equipe/actions.ts`, `updateTeamMemberAction`) grava as duas juntas, limpa `supervisor_id` e derruba as sessões.
- `duty_roster_assignments.branch_id`: cada vaga de plantão guarda a unidade do plantão, não a do corretor.
  A distribuição por plantão (`service.ts`, `active-queue-duty-roster.ts`) **não** confere a unidade atual do
  corretor. Quem muda de unidade e mantém essas vagas continua recebendo leads da unidade antiga, e o gestor
  antigo perde o corretor do próprio escopo (não consegue mais mexer nessas vagas).
- `leads.branch_id` / `assigned_broker_id`: o corretor vê os leads dele pelo responsável, não pela unidade.

## Ponto de partida reaproveitado

A branch `codex/broker-self-unit-change` não tem commits; o trabalho estava só na pasta
`ancorahub-pdf-pme`, sem commit. Reaproveitado: a ação com checagens (papel, flag, unidade ativa do tenant,
update condicionado à unidade de origem, auditoria), a flag global e o controle no Super-admin. Refeito:
a tela (o rascunho mexia nas telas de diretor/abas e usava `Button` primário; o corretor usa o Lite), e
faltava tratar as escalas, avisar a gestão e testar.

## Decisões (opção recomendada adotada)

1. **Imediata ou com aprovação?** Imediata. Aprovação pediria fila de pedidos e tela nova para o gestor;
   a gestão é avisada e a ação é auditada.
2. **Escalas, plantões e leads da unidade antiga.** As vagas ativas do corretor em plantões da unidade
   antiga são encerradas na hora (semanais e datadas ainda não terminadas, inclusive o turno em andamento),
   tirando também a vaga da escala mensal publicada/rascunho, como faz "Remover da escala". Vagas datadas já
   terminadas ficam para o histórico. Leads e negociações continuam com o corretor; não mudam de unidade.
   Supervisão anterior é removida. Papel, cargo e disponibilidade não mudam. As sessões não caem (só o cache
   do contexto é invalidado), para o corretor não ser deslogado.
3. **Auditoria.** Sim: `tenant_membership / alterou_unidade_propria` com origem, destino e vagas encerradas;
   `supervisor_team / corretor_saiu_da_equipe_ao_mudar_unidade` quando havia supervisor; e um registro
   `duty_roster_assignment.removed_by_unit_change` por vaga encerrada.
4. **Flag.** Sim: `feature_broker_self_unit_change_enabled` (global, ligada por padrão), no Super-admin em
   Operações. Desligada, a seção some e a ação recusa no servidor.

Aviso: os gestores das duas unidades recebem notificação (`broker_unit_change`, desligável no catálogo de
notificações).

## Componentes

- `src/features/broker-unit-change/roster-release.ts`: regra pura de quais vagas encerrar.
- `src/features/broker-unit-change/service.ts`: troca transacional com lock da escala mensal.
- `src/app/(dashboard)/settings/actions.ts`: `changeOwnBranchAction` (contexto confiável, flag, zod).
- `src/app/(dashboard)/settings/_components/light-unit-section.tsx`: seção "Minha unidade" do Lite:
  unidade atual, lista de unidades ativas (RadioCards), botão secundário e confirmação em BottomSheet.
- `src/app/(dashboard)/settings/page.tsx`: seção no Lite do corretor quando a flag está ligada.
- Flag no catálogo, ação e cartão no Super-admin; capacidade de notificação no catálogo.

## Validação

- Testes novos: `src/features/broker-unit-change/*.test.ts` e `settings/_components/light-unit-section.test.tsx` (28 testes).
- Testes de Configurações, notificações, flags e Super-admin: passaram.
- `tsc --noEmit`: limpo. ESLint nos arquivos novos: limpo.
- Navegador interno: `/dev/troca-unidade-preview` (só em desenvolvimento, dados sintéticos e ação simulada, porque
  o banco do `.env.local` é o remoto). Prints no celular e no computador na pasta de notas da sessão.
- Não verificado: a troca contra um banco real (transação, escala mensal e notificações), só por testes com mock.

## Pendências conhecidas (fora do escopo)

- A troca de unidade feita pela gestão em `/equipe` também não encerra as vagas de plantão da unidade
  antiga. Dá para extrair a parte de escalas de `changeOwnBranch` e usar lá.
- Plantões gerais da empresa (sem unidade) mantêm a vaga do corretor.
