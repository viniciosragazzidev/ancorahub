# Transferência manual de leads entre unidades

## Objetivo e decisão

Aplicar DEC-133 aos três fluxos confirmados: reatribuição individual do lead,
transferência de carteira entre corretores e envio em lote para unidade.

- Destino fica no mesmo tenant; unidade ativa e apta a receber leads.
- A atribuição individual escolhe unidade e corretor da unidade. Só vínculo ativo
  do corretor é exigido; pausa, agenda, escala e capacidade não bloqueiam.
- Alterar unidade atualiza fila para a fila padrão ativa do destino e preserva
  origem/campanha. A operação manual não executa validação de rota de campanha.
- Transferência individual pode ocorrer durante atendimento, reinicia os marcos
  de atendimento/SLA e preserva o histórico.
- Permissões e controle reversível `feature_lead_management_actions_enabled`
  permanecem server-side e auditados.

## Módulos

- `src/features/leads/management-actions.ts`
- `src/app/(dashboard)/leads/_components/lead-drawer-management-actions.tsx`
- `src/features/leads/reference-data.ts`
- `src/app/(dashboard)/equipe/actions.ts`
- `src/app/(dashboard)/leads/status-actions.ts`
- `src/features/lead-distribution/service.ts`
- regras, decisões, UX, roadmap e evidência de implementação

## Validação

- `npm.cmd exec tsc -- --noEmit`: passou.
- ESLint focado nos arquivos da mudança: passou sem erros; o comando reportou
  avisos já existentes nos módulos abrangidos.
- `npm.cmd exec vitest -- run src/features/leads/management-actions.test.ts`:
  passou (14 testes).
- `npm.cmd run build`: passou; compilação otimizada e geração de 86 páginas.
- `npm.cmd run agent:verify -- --level fast/full`: não iniciou as verificações;
  o processo `tsx` falhou antes delas com `uv_os_get_passwd returned ENOMEM`.
  Evidência: `reports/agent/verification/2026-10-06-manual-cross-unit-lead-transfer.md`.

## Risco e rollback

Risco principal: lead alterado de unidade com campanha originária de outra rota.
O fluxo manual atribui diretamente, sem executar roteamento de campanha; a
origem é mantida e qualquer distribuição automática futura volta às regras
normais. Rollback: reverter apenas os fluxos e a regra DEC-133; sem migration.
