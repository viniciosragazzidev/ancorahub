# Fase 2, lote 1: Home, aceite e ferramentas do corretor

Estado: **PROPOSTA VISUAL REJEITADA pelo Vinicios** após o print. Pedido vigente: preservar o estilo e a metodologia do modo Lite atual. A integração no dashboard, a prévia alternativa e o formulário administrativo foram retirados; os três hosts retornaram ao conteúdo anterior à proposta. Código exploratório e evidências abaixo são históricos, sem aprovação para ativação/publicação. Autorização original de execução: 2026-11-13, “Faça a 1 e me de um prind de como ficou real”. Plano: `docs/ux/phase2/2026-11-13-corretor-redesign-plan.md`.

Revisão de direção: evoluir a tela Lite existente, mantendo organização, navegação, linguagem de conversa, componentes e movimentos atuais; validar pequenas alterações visuais antes de uma nova composição. Nenhuma nova alternativa foi implementada nesta retirada. Não houve mudança de configuração ou dados em produção.

Validação da retirada: `git diff --exit-code` confirmou os três hosts sem diferença em relação ao estado anterior da proposta. Harness full: `reports/agent/verification/2026-11-13T17-39-13.229Z.md`; documentação, escopo, diagnósticos e typecheck passaram. Lint permanece bloqueado pelas ocorrências de codificação já descritas; suíte global com bail 1 parou em `meta-capture-controls.test.tsx`, fora dos arquivos retirados (feedback de sucesso não encontrado). Não certifica o restante da suíte. Build da retirada executado com limite explícito de 60 s, sem declaração de aprovação; log em `reports/agent/verification/2026-11-13-broker-home-rejected-build.log`. A reversão não é uma nova proposta visual aprovada.

Papel: corretor Lite. Ação principal: próximo passo calculado pelo servidor, incluindo aceite. Disclosure: tarefa prioritária, outras pendências, ferramentas e acompanhamento. Sem mudar distribuição, SLA, escopo ou envio WhatsApp.

G01: preservar tokens; Button compartilhado com primária existente neste lote. Nenhuma cor global ou variante nova. Legado preservado. Piloto desligado por padrão, por empresa e corretores explícitos, configurável pelo Super-admin com auditoria e reversão.

G03: o limpar do SearchField-base mantém o glifo compacto e ganha área transparente de toque de 44 px, usando o token existente e o mesmo princípio já aplicado a fechar sheets. Não cria variante, token ou estilo de controle local. Ajuda inicial não abre sobre oferta, próxima ação urgente ou confirmação de presença.

Inspeção real encontrou a raiz em 95%: `2.75rem` produzia 41,8 px. Os tokens existentes de controle sm/md recebem piso de 44 px com `max()`, preservando ampliação de texto. Essa correção compartilhada beneficia outros controles Arc; o rollback do piloto restaura a composição anterior, mantendo o piso acessível. Ícones locais sem dimensão intrínseca receberam width/height para medir corretamente no botão-base.

Baseline: `/dev/inicio`, componentes reais com dados sintéticos; `reports/design/broker-home-phase2-2026-11-13/before-desktop.jpg`. Não equivale a QA autenticado de produção. UX-M1.10 continua pendente; este lote corretor é explicitamente autorizado, sem avanço global.

Validação: testes dirigidos de piloto/aceite/composição, typecheck, lint dirigido, build, harness e capturas reais desktop/mobile. Sem dados pessoais reais nos prints. Cotador permanece pausado.

## Entrega

- Composição `BrokerHomeOverview`: próximo item canônico do Agora, prazo e CTA principal, pendências secundárias, números do dia, destinos permitidos e aprendizagem recolhível. Mantém rail em desktop; busca e nova ação alcançáveis no celular.
- Busca explica o escopo das conversas carregadas e apresenta estado sem resultado. Ferramentas agrupadas em trabalho, acompanhamento e preferências, preservando as capacidades canônicas.
- Aceite mantém a ação de servidor vigente e adiciona botão-base, bloqueio imediato de duplo envio, loading, erro com retry e recuperação de popup bloqueado. Oferta expirada fica desabilitada; o servidor continua sendo autoridade de prazo e elegibilidade.
- Configuração JSON por tenant e lista explícita de corretores ativos; desligada, ausente, inválida ou indisponível mantém a home anterior. Somente o Super-admin altera; valida empresa/participantes e grava configuração e auditoria atomicamente. Nenhuma query de corretor usa tenant vindo do cliente.
- Super-admin > Empresas > detalhe: formulário do piloto com participantes, aprendizagem, feedback e pending. Outros papéis não recebem a composição.
- BottomSheet-base respeita o controle global de movimento e aceita referência explícita de retorno de foco, preservando suas transições existentes. Tokens sm/md recebem piso de 44 CSS px e SearchField mantém glifo compacto com alvo expandido.

## Evidências locais

Diretório: `reports/design/broker-home-phase2-2026-11-13/`. Capturas reais, sem imagem gerada: `after-desktop-1440.jpg`, `after-mobile-390.jpg`, `tools-desktop.jpg`, `tools-mobile-390.jpg`, `offer-expired-mobile.jpg`, `paused-mobile.jpg`, `empty-mobile.jpg`. Dados de demonstração; nenhuma operação real de aceite foi enviada.

Matriz `responsive-matrix.json`: larguras 320, 360, 375, 390, 412 e 430 CSS px sem overflow horizontal do documento, botão principal com 44 px de altura. Busca, abertura do painel, pausa local e oferta expirada foram observadas. O teste de teclado nativo não foi conclusivo; retorno de foco no navegador terminou em BODY e requer confirmação/correção no QA autenticado. Não declarar acessibilidade integral aprovada. `prefers-reduced-motion` do SO não estava ativo; o desligamento global de movimento foi observado no preview.

Testes dirigidos finais: **7 arquivos, 34 testes passaram**, incluindo home anterior, experiência Lite, configuração/auditoria, aceite, composição e foco do BottomSheet. Log: `reports/agent/verification/2026-11-13-broker-home-tests-delivery.log`. Os testes de foco da base passaram, mas não substituem a pendência real acima.

Lint dirigido: passou, sem erros/avisos, nos 22 arquivos TypeScript alterados/adicionados (inclui formulário do Super-admin, composição, ações, bases e harness). Log: `reports/agent/verification/2026-11-13-broker-home-eslint-delivery.log`.

Harness full executado com `--test-pool threads --test-workers 1 --test-bail 1`, sem alterar os padrões da suíte. Validação documental e escopo passaram. Diagnóstico de segurança: zero achados (`2026-11-13T17-21-59.811Z.md`). Arquitetura apontou somente o preview `roteiro-presenca`, anterior e fora deste lote (`2026-11-13T17-21-57.924Z.md`). Desempenho apontou tamanho dos componentes interativos existentes ChatHome/BottomSheet e desse mesmo preview (`2026-11-13T17-22-02.496Z.md`): sem retirar client boundaries necessárias a foco, gesto e interação; composição nova separada e ação de aceite carregada no cliente. Não constitui medição de runtime nem aprovação de toda a aplicação.

Lint global falhou nas 987 ocorrências de codificação preexistentes em quatro arquivos: `docs/business-rules.md`, `monthly-duty-actions.ts`, `management-actions.test.ts` e `lead-quality-period.test.ts`. Não foram reescritos por esta tarefa. Fast anterior registrou typecheck aprovado, mas testes globais interrompidos; não vale como aprovação da revisão final. Full e build final têm seus resultados no complemento abaixo.

Full final: `reports/agent/verification/2026-11-13T17-30-31.422Z.md`. **Typecheck final passou**. A suíte global parou no primeiro arquivo por timeout de 5 s no inventário de ações (`action-areas.test.ts`), sem conclusão dos outros 761 arquivos. Reexecução dirigida do inventário com timeout de 30 s: **3 testes passaram em 4,59 s**, sem mudar configuração ou teste; a ação nova usa a regra existente de plataforma e guarda própria de Super-admin. Log: `2026-11-13-broker-home-action-inventory.log`. Assim, 37 testes dirigidos passaram ao todo; não há aprovação da suíte global. Log full: `2026-11-13-broker-home-full-delivery.log`.

## Reversão e pendências

Desligar o piloto no detalhe da empresa restaura a composição anterior na próxima atualização; a configuração e a reversão geram auditoria. Nenhuma migração, dependência, conta de produção ou implantação foi alterada. Não há corretores habilitados por esta tarefa. Revisar tenant/capacidades, aceite real autorizado, popup, teclado/foco, atualização após salvar e matriz M1.10 em sessão autenticada antes de ampliar o piloto.

Build de produção tentado com `npm run build -- --webpack`, banco do processo apontado para endereço local inacessível (sem escrita em produção). A compilação emitiu repetidos `read ECONNRESET`, não avançou a saída por aproximadamente dez minutos e foi interrompida para liberar memória à verificação de tipos. A causa exata da conexão não foi isolada; não atribuir a uma fonte específica nem declarar build aprovado. Evidência: `reports/agent/verification/2026-11-13-broker-home-build.log`. Nova compilação bem-sucedida é obrigatória antes de publicar.
