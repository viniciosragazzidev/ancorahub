# Identidade visual do Capitão Âncora e da Sasá

**Status:** artes de interface e avatar/logo da Sasá atualizados nesta branch com URLs versionadas; os vídeos renderizados ainda precisam da fonte editável para concluir a migração audiovisual.
**Prioridade:** P1, definida pelo Vinicios em 18/11/2026.
**Decisão:** DEC-188.
**UX:** substituição de assets e texto. Não muda rota, papel, ação, estado de negócio, layout, componente-base ou etapa UX-M1.10.

## Objetivo

Substituir as artes e referências piratas ativas pelo Capitão Âncora da prancha oficial. Atualizar a identidade da conversa de avisos e perguntas de Jack para Sasá, assistente de convés com uniforme simples. Trocar vocabulário de fantasia por termos diretos de trabalho. Manter o funcionamento do CRM e os dez ícones objetuais das rotas.

## Direção aprovada

Capitão Âncora é um marinheiro adulto, experiente, sábio, acolhedor e positivo. O rosto é arredondado e cor de pêssego, com nariz alaranjado, olhos castanhos grandes e bigode branco curvado. Usa boné branco com aba azul-marinho e âncora dourada; camisa branca, gola e lenço azul-marinho, calça azul-marinho, sapatos pretos, listras douradas nos ombros e âncora dourada no peito.

Paleta: #002B73, #0B5ED7, #00B26B, #7ED957, #FFC400, #FF8A65, #FFF6E9 e #1F2937. A mesma identidade facial e de uniforme permanece em todas as poses.

Sasá é a assistente de convés da conversa de notificações. Sua arte usa camisa branca, gola e lenço azul-marinho e pequena âncora dourada, sem as listras de capitão. Sua função, ações, permissões, conversa e rota permanecem.

Por pedido de Vinicios em 18/11, o avatar/logo da Sasá é um recorte fechado apenas do rosto oficial do Capitão Âncora, com bigode branco, boné com âncora dourada e fundo azul #002B73. A forma de assistente com uniforme simples continua valendo para ilustrações de corpo inteiro.

## Escopo executado

- Fontes e referência oficial em design/mascote/capitao-ancora/; logo da Sasá em `sasa-logo-azul.png` e WebP otimizado em `public/mascote/2026-11-18/sasa-logo-azul.webp`.
- WebP otimizados publicados em public/mascote/ para repouso, boas-vindas, luneta, financeiro, distribuição, conquista e a logo da Sasá.
- Splash, banners, celebrações, feedback do mascote, desempenho, financeiro, distribuição e importação usam as novas artes em `public/mascote/2026-11-18/`. Início e Plantões compartilham a mesma URL nova para impedir que a versão pirata antiga permaneça no cache do navegador.
- Avatar, identificação, tour, cópias da conversa, prompt do agente e documentação ativa usam o nome Sasá.
- Cópias ativas de distribuição e financeiro descrevem equipe, atendimento, comissões e valores previstos/recebidos.
- Anúncios existentes continuam aceitando seus identificadores salvos; rótulos mostram poses novas e novos anúncios iniciam com boas-vindas.
- Os vídeos renderizados `boas-vindas-v3-celular.mp4` e `boas-vindas-v3-computador.mp4` ainda mostram Jack. A fonte editável HyperFrames não está disponível neste checkout; ambos precisam ser atualizados e renderizados quando ela for recuperada. Os arquivos não foram removidos nem alterados.
- Fontes anteriores de mascote foram preservadas fora do caminho ativo em design/mascote/_archive/identidade-anterior/.
- Os dez objetos funcionais em public/assistant-areas/ não foram alterados.

## Arquivos e áreas afetados

- src/components/chat/assistant-avatar.tsx, src/components/chat/types.ts e src/components/splash-screen*
- src/components/chat/ e src/features/broker-workspace/chat/
- src/features/ai-gateway/agents.ts e referências da conversa de assistente
- src/components/lite/banner/, src/components/lite/celebration/ e src/features/home-announcement/
- Banners de desempenho, distribuição, financeiro, jornada e importação de leads
- public/mascote/ e design/mascote/, incluindo `design/mascote/README.md`
- CONTEXT.md, docs/design-system/MASCOTE.md, docs/design-system.md, docs/decision-log.md, docs/features-log.md, docs/README.md, docs/onboarding/narracao-tour-lite.md, docs/onboarding/creditos-video-boas-vindas.md, docs/ux/phase2/2026-11-13-plano-modo-corretor.md e documentos ativos de UX/assistentes

## Preservações

- ID do agente ancora, URL /dashboard/c/ancora, permissões, ações sugeridas, prefixo funcional ask:, aviso de WhatsApp, distribuição, estado de conversas e dados persistidos.
- IDs já gravados em anúncios continuam aceitos para evitar invalidar configurações por empresa.
- Ícones objetuais de Leads, Carteira, Plantão, Agenda, Cotação, Desempenho, Dicas, Jornada, Equipe e Mensagens.
- Movimentos existentes, movimento reduzido, controles globais e etapa UX-M1.10.

## Validação

- Contexto do agente e documentação local de Next consultados para esta tarefa; `git diff --check` sem erros.
- `npm run build -- --webpack`: passou, compilação e TypeScript concluídos. Avisos existentes de `unpdf` (`import.meta`) e renderização dinâmica por `headers`; build terminou com código 0.
- Testes dirigidos de tour, chat, scripts, dados do chat, jornada e aviso do WhatsApp: 6 arquivos, 51 testes aprovados.
- `npm run agent:verify -- --level full`: documentação e type-check passaram; segurança sem achados; diagnóstico de arquitetura encontrou 5 itens e desempenho 9 itens. Lint interrompido pelo scanner antes do ESLint: 987 ocorrências de mojibake em quatro arquivos fora desta mudança (`docs/business-rules.md`, `src/features/lead-distribution/monthly-duty-actions.ts`, `src/features/leads/management-actions.test.ts` e `src/features/reports/metrics/lead-quality-period.test.ts`). Vitest global: 23 arquivos falharam, 929 passaram, 24 ignorados e 2 erros; inclui snapshots/rotas legadas, dependências/mocks do ambiente e falha inicial do teste de sincronização do roteiro, corrigida e revalidada nos testes dirigidos.
- Evidência do harness: `reports/agent/verification/2026-11-18T16-56-31.098Z.md`.
- Revisão visual no preview 3005 continua pendente; o servidor não foi reiniciado.
- Retificação visual desta revisão: a logo da Sasá agora usa o recorte apenas do rosto com bigode, âncora no boné e fundo #002B73. Todas as rotas ativas do Capitão usam arquivos versionados em `public/mascote/2026-11-18/`, incluindo o banner compartilhado de Início e Plantões, para impedir que o navegador continue mostrando a URL pirata antiga.
- Testes dirigidos do avatar, splash, banner de Plantões e celebração de venda: 4 arquivos, 19 testes aprovados. `git diff --check` passou.
- `npm run build` padrão falhou porque o Turbopack rejeita o symlink de `node_modules` do worktree; `npm run build -- --webpack` passou, incluindo compilação, TypeScript e geração das 171 páginas. Permanecem avisos de `unpdf` e rotas dinâmicas com `headers`.
- Verificação full desta revisão: documentação, arquivos alterados, arquitetura, segurança, desempenho e type-check passaram. Lint parou no scanner por 987 ocorrências preexistentes de mojibake em quatro arquivos não alterados; a suíte global falhou em testes legados de navegação/com snapshots (2 falhas; 7 arquivos ignorados com `--test-bail=1`). Evidência: `reports/agent/verification/2026-11-18T18-20-48.853Z.md`.
- Ajuste solicitado depois: no banner compacto de Plantões, a arte mobile do Capitão passa de 116 px para 144 px com coluna dedicada, preservando espaço para o texto. Rota, ação e estados sem plantão/atual/próximo permanecem iguais. `git diff --check` e `npm run build -- --webpack` passaram; o build gerou as 171 páginas. Testes não executados nesta revisão CSS. Preview 3005 excedeu o tempo limite, então a revisão visual no navegador ficou pendente. Evidência: `reports/agent/verification/2026-11-18T16-06-15.110.md`.

## Risco e reversão

Risco limitado à apresentação das novas artes, ao ajuste de rótulos e ao novo nome da conversa. Os identificadores existentes, ações e rotas permanecem. Dois vídeos de boas-vindas ainda mostram a identidade anterior até que a fonte editável seja recuperada. A reversão é feita revertendo o commit dedicado; os assets antigos continuam disponíveis no Git e no diretório de arquivo histórico.
