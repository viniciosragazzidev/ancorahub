# Diretor Lite, aba Funil de qualificação

Status: implementação concluída na branch `feat/diretor-lite-funil`.

## Contrato

- Papel: Diretor, autenticado e com `feature_director_lite_style` ativa no tenant.
- Objetivo: acompanhar a turma de leads que chegou no período, da primeira mensagem à venda.
- Ação principal: comparar o funil usando os filtros de período e unidade já existentes.
- Dados: `getQualificationFunnel` e as métricas atuais, sem métrica nova. A unidade vem da lista permitida no servidor; o tenant vem de `TenantContext`.
- Estados: dados, coorte vazia, carregamento pelo boundary existente e erro pelo boundary existente. Custo da Meta permanece empresarial e não aparece com unidade selecionada.
- Reversão: desligar a flag retorna a `QualificationFunnelView` e a chamada antiga, sem o parâmetro de unidade.

## Implementação

- Criar a apresentação Lite da aba em `src/features/dashboard/components/director-lite/` e compartilhá-la com `/dev/diretor-dashboard-preview` usando fixtures tipadas.
- Validar `?period=` pelo parser existente e `?unidade=` contra unidades autorizadas; filtrar a mesma coorte pela unidade escolhida. Gestores continuam no escopo da unidade da sessão.
- Reusar CSS, tokens Arc e `components/lite/motion`; não criar regra ou métrica de negócio.
- A mudança de seleção no `DashboardPage` deve ser o único ponto que escolhe entre Lite e visual antigo.

## Resultado e validação

- `getQualificationFunnel` mantém a coorte e as métricas atuais, com tenant em todas as consultas e filtro de `branch_id` somente após validar a unidade autorizada. O custo da Meta, que é empresarial, fica oculto ao selecionar uma unidade.
- A chave desligada mantém o componente anterior e a chamada sem filtro adicional. Gestores seguem na tela anterior, com unidade derivada da sessão.
- Vitest focado: 4 arquivos, 13 testes aprovados, cobrindo escopo, filtros, vazio, apresentação da prévia e chave ligada/desligada.
- `npx tsc --noEmit -p .`, ESLint dos arquivos alterados e `node scripts/check-lite-skin.mjs` concluídos sem erro. O relatório global do check-lite-skin inclui desvios preexistentes fora deste escopo.
- Prévia visual conferida nos arquivos `scratchpad/abas-prints/funil-1440.png` (1440 × 1100) e `scratchpad/abas-prints/funil-390.png` (390 × 844), com fixtures sintéticas tipadas.
- Não foi necessário alterar o roteamento das abas nem executar consulta de banco em teste.
