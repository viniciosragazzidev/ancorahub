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
- Validar `?periodo=` com `parseOverviewPeriod` e `?unidade=` contra unidades autorizadas; filtrar a mesma coorte pela unidade escolhida. Gestores continuam no escopo da unidade da sessão.
- Reusar CSS, tokens Arc e `components/lite/motion`; não criar regra ou métrica de negócio.
- A mudança de seleção no `DashboardPage` deve ser o único ponto que escolhe entre Lite e visual antigo.

## Resultado e validação

- `getQualificationFunnel` mantém a coorte e as métricas atuais, com tenant em todas as consultas e filtro de `branch_id` somente após validar a unidade autorizada. O custo da Meta, que é empresarial, fica oculto ao selecionar uma unidade.
- A chave desligada mantém o componente anterior e a chamada sem filtro adicional. Gestores seguem na tela anterior, com unidade derivada da sessão.
- Vitest focado na implementação inicial: 4 arquivos, 13 testes aprovados, cobrindo escopo, filtros, vazio, apresentação da prévia e chave ligada/desligada.
- `npx tsc --noEmit -p .`, ESLint dos arquivos alterados e `node scripts/check-lite-skin.mjs` concluídos sem erro. O relatório global do check-lite-skin inclui desvios preexistentes fora deste escopo.
- Prévia visual conferida nos arquivos `scratchpad/abas-prints/funil-1440.png` (1440 × 1100) e `scratchpad/abas-prints/funil-390.png` (390 × 844), com fixtures sintéticas tipadas.
- Rotas existentes do painel foram mantidas; o cabeçalho compartilha `?periodo=` e `?unidade=` entre as abas.

## Cabeçalho compartilhado e prévia real

- Rebaseada em `feat/diretor-lite-qualidade`, a aba usa `DirectorLiteHeader` para saudação, abas, período e unidade. As três abas compartilham Hoje, 7 e 30 dias em `?periodo=` e preservam a unidade selecionada.
- O período Hoje é mapeado por `funnelPeriodForOverview` para o início do dia operacional às 19h em `America/Sao_Paulo`; 7 e 30 dias preservam as janelas existentes.
- `/dev/diretor-dashboard-real?tab=funnel&periodo=hoje` renderiza este componente real com fixtures, sem a moldura da prévia.
- Vitest focado final: 6 arquivos, 31 testes aprovados, cobrindo aba, filtros, unidades autorizadas, vazio, janela do período Hoje e rota real de desenvolvimento.
- `npx tsc --noEmit -p .` passou após regenerar os tipos do Next e remover dois arquivos corrompidos do cache `.next/dev/types`. ESLint dos arquivos TS/TSX alterados passou.
- A rota real retornou 200 em navegador com movimento reduzido e sem erro de hidratação. Sem `DATABASE_URL`, o endpoint de preferências de movimento responde 503, sem afetar os dados de exemplo.

- Prints atuais: `scratchpad/dash-real-fix/funil-1440.png` (1440 × 1100, 165846 bytes, 18:57:56 -03:00) e `funil-390.png` (390 × 844, 57775 bytes, 18:58:11 -03:00); ambos foram regenerados pela rota real, abertos e conferidos.
