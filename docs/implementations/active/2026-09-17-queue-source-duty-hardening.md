# Filas: múltiplos plantões, fontes e ativação completa de ativos Meta

## Status

Implementado na branch `codex/distribution-production-fixes`; aguardando decisão de commit/push.

## Escopo

- Filas podem referenciar mais de um plantão padrão. A coluna legada `exclusive_duty_schedule_id` continua preenchida com o primeiro item para compatibilidade; a lista canônica fica em `exclusive_duty_schedule_ids`.
- O formulário de fila permite restringir fontes de entrada (Manual/importação, Webhook, Meta Lead Ads, WhatsApp, Google Ads, Indicação e Site/orgânico). Lista vazia mantém o comportamento anterior de aceitar qualquer fonte.
- Manual e Webhook são fontes exclusivas: o servidor impede a mesma fonte explícita em duas filas ativas do tenant. Rotas de campanha e anúncio Meta continuam protegidas pela unicidade tenant/ativo existente e agora rejeitam uma tentativa de apontar o mesmo ativo para outra fila sem desativar a rota anterior.
- O motor filtra os corretores pelos plantões escolhidos e deixa o lead aguardando quando a escala selecionada não está ativa, sem cair para uma escala não autorizada.
- O controle “todos os ativos” de `/integrations/meta` agora cria/reativa, de forma idempotente, a elegibilidade de todas as campanhas, anúncios e formulários ativos (somente quando conta/página e a hierarquia pai também estão ativas), preservando `queue_id` já configurado e registrando auditoria.
- A tabela de resumo diário usa altura mínima de 250px para evitar colapso visual.

## Segurança e compatibilidade

Todas as consultas novas derivam o tenant da sessão e validam unidade/plantão no servidor. Filas existentes sem allow-list de fontes permanecem válidas. Nenhum destino Meta configurado é sobrescrito ao ativar todos os ativos.

## Verificação

- `npm test -- --run src/features/lead-distribution/routing-engine.test.ts src/features/lead-distribution/domain.test.ts src/features/meta-ads/components/meta-integration-view.test.tsx`: 52 testes aprovados; o teste de normalização cobre lead manual sem `sourceChannel` e webhook sem canal explícito.
- Suíte completa: 169 arquivos / 786 testes aprovados; 1 teste preexistente falhou em `src/features/broker-workspace/broker-lite-experience.test.tsx` (ordem textual do dashboard Lite), sem relação com filas, fontes ou Meta.
- `npm run db:check`: aprovado.
- ESLint direcionado aos arquivos alterados: 0 erros; apenas avisos preexistentes de imports/tipos não utilizados.
- `npm run type-check` e `npm run build`: bloqueados exclusivamente por `scripts/_tmp-diag2.ts:64`, arquivo temporário não versionado preexistente (`userId` possivelmente nulo). Não houve erro nos arquivos deste escopo.

## Rollback

Reverter a migration `0150_queue_sources_and_duty_schedules` e os arquivos deste registro. A ativação Meta é idempotente e não exige limpeza de rotas; se necessário, o modo mestre pode voltar para seletivo pela própria tela.
