# T54: ligações da Onda B

Branch: `feat/diretor-visual-lite`. Implementação sem commit, conexão ou aplicação de migração.

## Entrega

- Ações próprias do corretor para marcar até 20 celebrações vistas e escolher presença no placar. Validação Zod, tenant autenticado, transação e auditoria. IDs são texto de 1 a 80 caracteres.
- GET `/api/journey/celebrations` lê somente a fila de celebrações do usuário, sem cache HTTP. Flag desligada ou tabela ausente devolve lista vazia.
- `journeyEnabled` percorre layout, AppShell, LightChrome e Mais. `/jornada` tem título Minha jornada. Supervisor não recebe o destino. A conversa `/dashboard/c/jornada` valida flag e audiência e evita redirecionar para si mesma.
- Conversa Jornada com nível, pontos da semana, missões abertas, resumo diário e links para jornada/extrato. Os resumos vistos continuam no histórico de sete dias.
- Placar em Configurações do corretor Lite: Switch Arc, finalidade e escolha de visibilidade, pendência, erro com nova tentativa e confirmação no próprio controle. A saída do placar preserva progresso pessoal.
- B5: coletor gera uma celebração `daily_summary` após 19h São Paulo, com chave por corretor/data. Soma pontos persistidos não revertidos e bônus efetivamente inseridos no lote. Reexecução não duplica a mensagem.
- B7: `steps.coverage` usa atribuições reais de pelo menos 30 minutos, apenas carteira própria não excluída/arquivada. Numerador conta leads que avançaram de `new`/`distributed`. A barra representa o motor; o próximo lead pertence ao período diário. Bônus padrão 10 pts, editável na missão armazenada. Fechamento diário aguarda 00h30 para incluir a maturação das últimas atribuições; o coletor revisita essa janela e mudanças de etapa.
- O cron funciona com `BROKER_JOURNEY` sem exigir a flag legada. O placar tem tag por tenant, expirada imediatamente ao mudar visibilidade; leituras continuam com TTL de 60 s.

## Arquivos

Novos:

- `src/features/journey/actions.ts`, `actions.test.ts`, `ranking-preferences.tsx`, `ranking-preferences.module.css`, `ranking-preferences.test.tsx`.
- `src/app/api/journey/celebrations/route.ts`, `route.test.ts`.
- `src/features/engagement/journey-cache.ts`, `daily-summary.ts`, `journey-wave-b.test.ts`, `broker-stats-journey.test.ts`.
- `src/components/chat/week-ranking-journey.test.tsx`.
- `src/app/(dashboard)/dashboard/c/[assistant]/journey.test.tsx`.

Alterados:

- `src/app/(dashboard)/layout.tsx`, `settings/page.tsx`, `settings/_components/light-settings.tsx`, `dashboard/c/[assistant]/page.tsx`.
- `src/components/app-shell.tsx`; `src/components/light/light-chrome.tsx`, `light-more-sheet.tsx`, `light-routes.ts`, `light-routes.test.ts`.
- `src/components/chat/types.ts`, `week-ranking.tsx`.
- `src/features/broker-workspace/chat/assistant-scripts.ts`, `assistant-scripts.test.ts`, `chat-rail-data.ts`; `components/chat-home-content.tsx`.
- `src/features/engagement/broker-stats.ts`, `collector.ts`, `collector-replay.test.ts`, `journey-collector.ts`, `journey-collector.test.ts`, `journey-facts.ts`, `journey-facts.test.ts`, `journey-queries.ts`, `journey-queries.test.ts`, `journey-types.ts`, `journey-validation.ts`, `leaderboard-queries.ts`, `missions.ts`.

Páginas de Jornada e componentes/host de celebrações pertencem ao Maestro; somente passagem de props no chrome foi feita pelo executor.

## Arc review

- [x] Sentence case, sem eyebrow/travessão, tokens e pesos existentes, erros com tentativa novamente.
- [x] Switch instalado com props públicas; foco de teclado compartilhado; cores de estado acompanhadas por mensagem; sem token/primitive novo.
- [x] Estados pendente, sucesso, erro e indisponibilidade, conteúdo com quebra e largura de leitura até 640px.
- [x] Barra reutiliza movimento de transformação e tokens Arc, respeita reduced motion; gaveta existente usa `arc-venancor`.
- [x] IDs estáveis, primeira renderização segura, controle com alvo de 44px, estado assíncrono anunciado.
- [x] CSS revisado para 390/768/1024/1440, sem largura fixa mínima ou linhas sem quebra. Cores semânticas acompanham tema/acento. Não houve sessão visual autenticada nem benchmark SQL, pois nenhuma conexão com banco foi autorizada.

## Como testar

1. Ative BROKER_JOURNEY em ambiente de teste preparado; entre no corretor Lite e confira Mais, Jornada e os dois links da conversa.
2. Abra Configurações, Placar; altere a escolha e confira confirmação, preservação dos pontos e exclusão do placar público.
3. Em testes com relógio controlado, confira resumo após 19h, replay sem duplicação e etapas com progresso parcial/bônus após fechamento.

Resultados automatizados registrados em `reports/agent/verification/2026-10-10-T54.md`.
