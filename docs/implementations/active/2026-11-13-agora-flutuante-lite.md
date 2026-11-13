# Refino Lite: conversa, dados pelo olho e Agora flutuante

Estado: em implementação local. Vinicios confirmou explicitamente o bloco “Agora” da imagem em 2026-11-13. Preserva o estilo/metodologia atuais do Lite; não retoma a proposta de Home rejeitada. Escopo ampliado por instruções explícitas na mesma sessão: conversa ocupa a área principal; informações somente pelo olho ao lado do nome; WhatsApp/Ligar/Etapa como ícones no topo; remover faixa de conexão em todas as rotas; retirar cotações da ficha do corretor; compactar campos e regularizar alinhamento. Redução geral de fonte solicitada e CANCELADA antes de qualquer alteração tipográfica.

## Divisão de trabalho confirmada

Vinicios informou que Claude já modifica a tela Registrar venda. Nenhuma alteração direta permanece em `register-sale-panel.tsx`, `beneficiaries-section.tsx` ou `currency-input.tsx`. O refinamento dos campos do painel de dados usa a variante de densidade no seu host `PeopleDataSection`, sem editar o formulário compartilhado com o registro. A tela de registro e seu layout ficam com Claude. Mantida somente a passagem no host do chat: ao abrir venda/etapa/recusa, desmontar o painel de dados e liberar foco. QA em fixture de passagem usa diálogo genérico explicitamente identificado; não valida o novo fluxo de quatro etapas.

## Decisões visuais e comportamento

- `LeadSocialLayout`: cabeçalho com nome/olho e ícones de 44 x 44 px, conversa ocupa o restante em todos os breakpoints; chegada, status, próximo passo, dados pessoais e venda dentro do sheet. Sem as antigas colunas de dados ou cards acima das mensagens.
- Variante compartilhada de densidade `data-form-density="compact"`: campos de 36 px e select/calendário de 40 px, raio e espaçamento com tokens existentes. Não reduz fontes; inputs mobile continuam 16 px. É uma escolha de densidade visual pedida pelo usuário; botões de ícone permanecem 44 px.
- Arc Button primário passa a usar `--primary`/`--primary-foreground` do tema, em vez de preto. Links de ação e botão Agora usam os mesmos tokens. `page.iconButton` ganha padding zero e dimensões mínimas para centralizar glifos também em Arc Button; variante semântica `data-tone="primary"` adicionada à base para WhatsApp. Gaps aprovados neste controle, sem tokens novos.
- Faixa `WhatsAppMissingBanner` retirada do shell, preservando o ícone de status/conexão e os avisos contextuais existentes. Cotações retiradas da ficha do corretor; dados e cotador canônico preservados, gestão não alterada.
- Sugestões longas da IA mantêm preview e passam a oferecer o texto completo por disclosure sem cortar a única cópia do próximo passo. Nenhum dado de outro tenant é carregado.

Papel: corretor, Home canônica. Objetivo: ver e executar aceite, resposta e retorno sem ocupar a lista de conversas. Retirar os blocos inline mobile/desktop e usar o botão flutuante existente com título e contagem real; abrir o BottomSheet Arc compartilhado com as mesmas ações, prazos, ordem e destinos canônicos. Sem abertura automática. Dados e autorização continuam no servidor.

Reutilizar superfície, botão, estados, tokens e spring do painel compartilhado. Skill transitions-dev aplicada à escolha de abertura/saída; não instalar CSS paralelo ou biblioteca sobre o gesto existente. O painel respeita o controle global de movimento e reduced motion; sem stagger de linhas nesta abertura recorrente. Nomes longos quebram; lista rola em um único detent (0,62 até dois itens, 0,85 para mais itens); foco retorna ao acionador.

Governança: flag global booleana específica no catálogo e no formulário existente de novidades do corretor, com guarda Super-admin e auditoria existentes. Ligada por padrão para atender o pedido; desativar restaura o bloco inline. Falha de configuração preserva inline. Não altera distribuição, elegibilidade, tenant, SLA, WhatsApp, presença ou outros papéis.

Estados: pendências carregadas, nenhuma pendência, oferta expirada, ação pendente/erro/retry canônicos, fechar/reabrir, teclado e nome longo. Preview exclusivamente de desenvolvimento com dados fictícios. Validações e prints serão registrados ao final. Sem deploy ou alteração de configuração em produção.

## Evidência visual

Capturas reais em `reports/design/lite-refinements-2026-11-13/`: `chat-mobile.jpg`, `chat-desktop.jpg`, `client-data-mobile.jpg`, `home-mobile.jpg`, `agora-mobile.jpg`, `agora-empty-mobile.jpg` e `handoff-mobile.jpg`. Preview usa componentes reais, dados fictícios e banco do processo em endereço local inacessível. Nenhum cadastro, mensagem, ligação, venda ou alteração de etapa foi enviado.

`responsive.json`: 320, 390 e 430 px sem overflow horizontal; quatro ícones de 44 x 44 px, centro de glifo com diferença medida de 0 px nos dois eixos. Conversa: 726,4 px de altura em viewport de 844 px nas duas primeiras larguras. Fonte dos inputs medida em 16 px, campo de nome em 36 px. Desktop conferido em 1280 x 800. Foco volta ao botão Agora após fechar e ao olho após fechar o diálogo de destino da fixture. Contagem de diálogos durante a passagem: um, com foco dentro do destino. Sugestão completa da IA expandida e legível.

A evidência `registration-mobile.jpg` é de uma investigação anterior à retirada desse escopo e não integra o conjunto final de aceite. O registro de venda real não foi alterado nem certificado por esta entrega; a fixture genérica valida somente a passagem de modais do host. O teste do novo fluxo de quatro etapas pertence ao trabalho do Claude.

## Verificações dirigidas

- 6 arquivos, 51 testes passaram em `2026-11-13-lite-refinement-tests-final.log` (Home, layout, script, foco do sheet, ChatScreen e contrato Lite).
- A suíte Home foi ampliada para incluir oferta vencida: 11 testes passaram em `2026-11-13-lite-refinement-offer-tests.log`. Total de testes únicos dirigidos aprovados: **52**. Nenhum teste global foi contado novamente nesse total.
- Lint dirigido em 21 arquivos TypeScript: sem erros, com dois warnings preexistentes em trechos de `super-admin/actions.ts` fora da alteração (variáveis `tenantId`/`admin`). Log: `2026-11-13-lite-refinement-eslint.log`.
- `git diff --exit-code` confirmou, após a delimitação de escopo pelo usuário, ausência de alterações nossas em `register-sale-panel.tsx`, `beneficiaries-section.tsx` e `currency-input.tsx`.
- Logs e relatórios de harness em `reports/agent/verification/`; fast/full/build finais serão registrados no complemento. Não equivale a QA autenticado ou aprovação de publicação.

### Harness final

Fast `2026-11-13T18-49-49.390Z.md`: documentação e **typecheck passaram**. Suíte global com bail 1 parou em `commission-rules-lite.test.tsx` ao procurar item de menu, fora do escopo; não certifica os outros testes.

Full `2026-11-13T18-52-28.201Z.md`: documentação, escopo, diagnósticos e **typecheck passaram**. Lint global mantém as mesmas 987 ocorrências de codificação em quatro arquivos anteriores (business-rules, monthly-duty-actions e dois testes). Suíte global parou em `meta-capture-controls.test.tsx`, por não encontrar feedback de sucesso; falha também observada em verificação anterior à tarefa. Não houve correção de comissões/Meta nem aprovação da suíte global. Logs: `2026-11-13-lite-refinement-fast.log` e `2026-11-13-lite-refinement-full.log`.

Os diagnósticos são estáticos: arquitetura aponta tamanho dos dois arquivos administrativos e do preview de presença anterior. A alteração administrativa é uma entrada na lista canônica de flags e dois pontos de render/leitura, sem nova fronteira de tenant. O alerta de `tenantId` em `super-admin/actions.ts` refere-se ao arquivo inteiro; esta mudança não adiciona parâmetro de tenant, e reutiliza guarda de Super-admin, normalização booleana e auditoria da configuração global. Desempenho aponta componentes interativos grandes já existentes; não foram criadas cópias de controles, dependências ou camadas de animação. O novo layout remove a medição por ResizeObserver e as colunas laterais, e o Agora não monta sua lista/timer enquanto fechado. Relatórios: `2026-11-13T18-51-07.951Z.md`, `2026-11-13T18-51-10.643Z.md`, `2026-11-13T18-51-13.363Z.md`.

Build de produção independente executado com `npm run build -- --webpack`, sem desativar o typecheck (`SKIP_BUILD_TYPECHECK=0`), banco do processo em endereço local inacessível e limite de 180 s para não disputar indefinidamente recursos com os demais trabalhos. Resultado e log em `reports/agent/verification/2026-11-13-lite-refinement-build.log`; uma tentativa sem conclusão não é aprovação de produção.
