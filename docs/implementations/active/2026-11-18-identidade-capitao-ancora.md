# Identidade visual do Capitão Âncora e da Sasá

**Status:** implementação concluída; aguardando revisão visual no preview.
**Prioridade:** P1, definida pelo Vinicios em 18/11/2026.
**Decisão:** DEC-189.
**UX:** substituição de assets e texto. Não muda rota, papel, ação, estado de negócio, layout, componente-base ou etapa UX-M1.10.

## Objetivo

Substituir as artes e referências piratas ativas pelo Capitão Âncora da prancha oficial. Atualizar a identidade da conversa de avisos e perguntas de Jack para Sasá, assistente de convés com uniforme simples. Trocar vocabulário de fantasia por termos diretos de trabalho. Manter o funcionamento do CRM e os dez ícones objetuais das rotas.

## Direção aprovada

Capitão Âncora é um marinheiro adulto, experiente, sábio, acolhedor e positivo. O rosto é arredondado e cor de pêssego, com nariz alaranjado, olhos castanhos grandes e bigode branco curvado. Usa boné branco com aba azul-marinho e âncora dourada; camisa branca, gola e lenço azul-marinho, calça azul-marinho, sapatos pretos, listras douradas nos ombros e âncora dourada no peito.

Paleta: #002B73, #0B5ED7, #00B26B, #7ED957, #FFC400, #FF8A65, #FFF6E9 e #1F2937. A mesma identidade facial e de uniforme permanece em todas as poses.

Sasá é a assistente de convés da conversa de notificações. Sua arte usa camisa branca, gola e lenço azul-marinho e pequena âncora dourada, sem as listras de capitão. Sua função, ações, permissões, conversa e rota permanecem.

## Escopo executado

- Fontes e referência oficial em design/mascote/capitao-ancora/.
- WebP transparentes novos publicados em public/mascote/ para repouso, boas-vindas, luneta, financeiro, distribuição, conquista e Sasá.
- Splash, banners, celebrações, feedback do mascote, desempenho, financeiro, distribuição e importação usam as novas artes.
- Avatar, identificação, tour, cópias da conversa, prompt do agente e documentação ativa usam o nome Sasá.
- Cópias ativas de distribuição e financeiro descrevem equipe, atendimento, comissões e valores previstos/recebidos.
- Anúncios existentes continuam aceitando seus identificadores salvos; rótulos mostram poses novas e novos anúncios iniciam com boas-vindas.
- Vídeos e pôsteres anteriores do mascote foram removidos. O movimento compartilhado por estado, reduced motion, kill-switch e contrato opcional da Rive continuam.
- Fontes anteriores de mascote foram preservadas fora do caminho ativo em design/mascote/_archive/identidade-anterior/.
- Os dez objetos funcionais em public/assistant-areas/ não foram alterados.

## Arquivos e áreas afetados

- src/components/mascot/ e src/components/splash-screen*
- src/components/chat/ e src/features/broker-workspace/chat/
- src/features/ai-gateway/agents.ts e referências da conversa de assistente
- src/components/lite/banner/, src/components/lite/celebration/ e src/features/home-announcement/
- Banners de desempenho, distribuição, financeiro, jornada e importação de leads
- public/mascote/ e design/mascote/
- CONTEXT.md, docs/design-system/MASCOTE.md, docs/design-system.md, docs/decision-log.md, docs/features-log.md, docs/README.md, docs/onboarding/narracao-tour-lite.md e documentos ativos de UX/assistentes

## Preservações

- ID do agente ancora, URL /dashboard/c/ancora, permissões, ações sugeridas, prefixo funcional ask:, aviso de WhatsApp, distribuição, estado de conversas e dados persistidos.
- IDs já gravados em anúncios continuam aceitos para evitar invalidar configurações por empresa.
- Ícones objetuais de Leads, Carteira, Plantão, Agenda, Cotação, Desempenho, Dicas, Jornada, Equipe e Mensagens.
- Movimentos existentes, movimento reduzido, controles globais e etapa UX-M1.10.

## Validação

- Contexto do agente carregado com npm run agent:context para a tarefa.
- Documentação local de Next consultada para assets públicos e imagens.
- Build de produção: `npm run build -- --webpack` passou. O build padrão com Turbopack não iniciou porque ele rejeita o junction de `node_modules` do worktree por apontar para fora da raiz; nenhuma dependência foi instalada.
- `npm run agent:verify -- --level fast`: documentação e type-check passaram; testes reportaram 24 falhas e 2 erros, além de 941 aprovados e 31 ignorados.
- `npm run agent:verify -- --level full`: documentação, checagem de arquivos, arquitetura, segurança, performance e type-check passaram. Lint falhou antes do ESLint por 987 ocorrências de mojibake em quatro arquivos fora do escopo. Testes: 943 aprovados, 22 falhas, 31 ignorados e 2 erros. As falhas são de snapshots/rotas de legado e mocks ou dependências; os testes direcionados do mascote, do tour e da conversa passaram (22/22).
- Preview visual mobile e desktop: pendente após sincronizar a branch com o preview 3005.

## Risco e reversão

Risco limitado à apresentação das novas artes, ao ajuste de rótulos e ao novo nome da conversa. Os identificadores existentes, ações e rotas permanecem. A reversão é feita revertendo o commit dedicado; os assets antigos continuam disponíveis no Git e no diretório de arquivo histórico.
