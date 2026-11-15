# Avatares contextuais do Capitão Âncora

**Status:** assets e integração implementados no worktree; validações dirigidas passaram. Build e verificações globais registram dívida preexistente descrita abaixo; sem publicação.
**Pedido e prioridade:** Vinicios, 2026-11-14. Promovido a P1 após autorização explícita nesta conversa.

## Objetivo

Substituir os avatares abstratos dos assistentes do Lite por personagens/peças do universo do Capitão Âncora que identifiquem visualmente cada área. A imagem anexada com a lista de assistentes é o alvo inicial; a prancha do design system e as demais imagens do personagem são referências visuais, não instruções textuais para o agente.

## Contexto e experiência

- Papel inicial: Corretor Lite; os mesmos assets podem aparecer nos assistentes do Gestor e Supervisor quando representam a mesma área.
- Objetivo do usuário: reconhecer rapidamente qual assistente leva a Leads, Carteira/Clientes, Plantão, Agenda, Cotação, Desempenho, Dicas, Jornada, Equipe ou Mensagens.
- Ação principal: abrir a área/assistente pelo item da lista.
- Estados preservados: ativo, aguardando, não lido e sem atualização continuam comunicados pelo texto e indicadores atuais. O asset é decorativo e não vira fonte de estado.
- Avatares de pessoas/leads, marca verificada e Jack/Notificações ficam como estão.
- O mesmo asset contextual acompanha o assistente no cabeçalho da conversa.

## Direção e mapa de assets

Gerar dez WebPs quadrados, com transparência real e silhueta legível em 32–44 px. Preservar identidade, roupa e formas do Capitão da referência. Usar a paleta da prancha enviada (marinho, azul, verde, dourado, pele e creme), sem texto na imagem, marcas extras ou cenários. Usar o personagem auxiliar já mostrado nas referências onde ele comunica melhor a área.

| Área | Asset/ação visual | Reuso |
|---|---|---|
| Leads | `leads.webp`: Capitão observando uma oportunidade com luneta | Leads da equipe |
| Carteira/Clientes | `carteira.webp`: ajudante conferindo livro de clientes | Clientes da unidade |
| Plantão | `plantao.webp`: Capitão com relógio e sino do turno | Plantão da equipe |
| Agenda | `agenda.webp`: Capitão consultando calendário | Agenda pessoal |
| Cotação | `cotacao.webp`: Capitão comparando fichas de plano | Cotação |
| Desempenho | `desempenho.webp`: Capitão com gráfico de progresso e medalha | Desempenho da equipe |
| Dicas | `dicas.webp`: ajudante do Capitão com lanterna e nota | Dicas de Atendimento |
| Jornada | `jornada.webp`: Capitão seguindo mapa com bússola | Minha Jornada |
| Equipe | `equipe.webp`: Capitão apresentando o ajudante | Equipe |
| Mensagens | `mensagens.webp`: ajudante levando um envelope da Âncora | Mensagens da unidade/equipe |

Jack/Notificações mantém o asset `jack-capitao.webp`. Leads individuais continuam usando iniciais e temperatura.

## Integração e governança

- Guardar as peças em `public/mascote/areas/` e mapear por uma chave visual tipada.
- Reutilizar `feature_ui_contextual_illustrations`, seu controle auditado no Super-admin e o provider existente. O provider separa o escopo dos avatares do escopo anterior de ilustrações de seção/vazio; desligado, os avatares abstratos voltam em todos os papéis Lite.
- Preservar layout, links, ordenação, texto, badges, permissões e conteúdo; sem consultas, dados ou regras novas.
- Manter os avatares decorativos com `alt=""`/`aria-hidden`; o nome e o contexto continuam no link.
- Não criar token, primitive, feature flag, animação ou dependência nova.

## Validação e saída

- As dez saídas finais estão em `public/mascote/areas/`, 160 × 160 px, WebP com alpha verdadeiro, 7.9–12.1 KB; a prancha de revisão versionada está em `design/mascote/areas/visao-geral.png`.
- As peças foram geradas individualmente com fundo transparente, sem texto e referências locais da prancha do Capitão e das artes do capitão/ajudante; foram reduzidas para 160 × 160 com Sharp. A prancha de contato confirma recorte e distinção dos objetos em miniatura sobre fundo claro.
- Teste dirigido cobre flag ativa, flag inativa, erro de imagem e isolamento do escopo de ilustrações existente.
- Arquivos, validações, limitações e rollback são registrados aqui; contrato visual, controle de execução e `docs/features-log.md` foram atualizados.
- Não altera regras de negócio nem avança o gate global UX-M1.10.

## Implementação e rollback

- `AssistantAvatar` resolve a arte pela chave tipada em `src/components/chat/types.ts`; as linhas e cabeçalhos carregam `avatarAsset`. Jack, iniciais e marca têm precedência/preservação e não recebem arte de área.
- Os estados aguardando/trabalhando e o reduced motion permanecem nos wrappers atuais. A imagem tem `alt=""`, `aria-hidden`, lazy-load, sem prioridade de rede; erro volta ao SVG abstrato. O composer continua usando o ícone compacto de 20 px.
- O provider tem gates separados: ilustração existente mantém diretor/corretor; retratos podem aparecer para corretor/gestor/supervisor Lite e Diretor Lite. A flag global Super-admin ainda desliga ambos de forma auditada.
- Rollback: desligar `feature_ui_contextual_illustrations` restaura imediatamente os avatares simples; para remover o conjunto basta reverter este commit. Nenhuma migration ou dependência.

## Evidências de validação · 15/11/2026

- Assets: 10/10 abrem em Sharp como WebP 160 × 160 com alfa verdadeiro; tamanhos de 7.9 a 12.1 KB. A prancha `design/mascote/areas/visao-geral.png` foi revisada em miniatura.
- Testes dirigidos: `npm test -- src/components/chat/assistant-avatar.test.tsx src/features/broker-workspace/chat/assistant-scripts.test.ts src/components/illustrations/contextual-illustration.test.tsx src/features/supervisor-workspace/chat.test.ts` — 4 arquivos, 40 testes passaram.
- ESLint direto nos 19 arquivos TS/TSX alterados passou. `git diff --check` passou. `npm run agent:docs` validou as 23 referências do harness.
- `agent:verify --level full` registrou a evidência em `reports/agent/verification/2026-11-15T03-08-16.375Z.md`: docs, escopo, arquitetura, segurança e desempenho passaram; lint global foi bloqueado por 987 achados preexistentes de mojibake em `docs/business-rules.md`, `src/features/lead-distribution/monthly-duty-actions.ts`, `src/features/leads/management-actions.test.ts` e `src/features/reports/metrics/lead-quality-period.test.ts`. O type-check segue bloqueado por duas declarações duplicadas de `JourneyBanner` em `src/features/journey/components/journey-screen.tsx`, que não foi alterado. O harness parou antes de chamar a suíte completa e o build.
- `npm run build -- --webpack` chegou à compilação e falhou no mesmo `JourneyBanner` duplicado em `journey-screen.tsx`; não houve erro atribuído a estes assets ou ao mapeamento. A tentativa padrão Turbopack também não opera neste worktree porque seu `node_modules` é um junction para a pasta de dependências compartilhada fora da raiz do projeto.
- Commit de assets/código `8ab845ff`; merge na branch `preview/3005` em `68fd29e4`. A pasta do servidor foi destacada nesse merge. Na conferência de 15/11, o listener de `localhost:3005` estava ativo mas não respondeu às requisições HTTP (`HTTP 000`, timeout de 8 s); o servidor não foi parado nem reiniciado conforme a regra do projeto.
- Sem QA autenticado ou avanço de UX-M1.10; mudança visual isolada, papéis, áreas e falha/off do controle cobertos pelos testes dirigidos. Nenhuma alteração de dados, migration, permissões ou dependência.
