# Plano transversal de interação, feedback e progresso do CorreTop

**Estado:** proposta de produto e UX; nenhuma implementação autorizada por este documento.  
**Data:** 2026-09-27.  
**Abrangência:** CRM, Corretor Lite, administração do tenant e Super Admin.  
**Fontes internas:** `UX_REDESIGN_CONTRACT.md`, `UX_REDESIGN_CONTROL.md`, `UX_FOUNDATIONS.md`, `NAVIGATION_MAP.md`, `ACTION_MAP.md`, `UX_FUNCTIONALITY_MATRIX.md`, `docs/decision-log.md` e código atual.

## 1. Resultado desejado e limites

Toda ação deve responder a cinco perguntas: o comando foi recebido? Está em andamento? Foi confirmado pela fonte de verdade? O que mudou? Qual é o próximo passo? O sistema deve parecer vivo por ser claro, rápido e previsível. A sensação de conquista fica reservada a marcos reais; operações repetitivas mantêm baixa distração.

O contrato visual atual continua sendo a fonte de verdade: uma ação principal por contexto, disclosure progressivo, densidade operacional, componentes e tokens compartilhados, suporte light/dark e Corretor Lite preservado pela DEC-015. Não redesenhar rotas em lote. UX-M1.10 (QA mobile autenticado) ainda está pendente; este programa começa como inventário e protótipos, e cada entrega visual segue a etapa permitida no controle de execução.

**Não misturar três conceitos:** feedback da ação (universal e obrigatório), progresso operacional (dados do trabalho com fonte verificável) e gamificação/reconhecimento (opcional, com regras próprias). Ranking de distribuição, ranking gerencial, meta, temporada e premiação existentes não são a mesma coisa. A documentação de requisitos marca gamificação/ranking fora do MVP, mas o código já tem metas, temporadas e rankings; antes de expandir isso é preciso reconciliar os contratos e registrar decisão no `docs/decision-log.md`.

## 2. Evidência do estado atual

- Há infraestrutura aproveitável: `src/components/ui/sonner.tsx`, `src/components/motion/animated-toast.tsx`, `src/components/ui/stateful-button.tsx`, `src/components/motion/interface-motion-provider.tsx`, tokens em `src/app/globals.css`, componentes em `src/components/foundations/`, visualização em `/dev/component-preview` e uma configuração global `feature_interface_motion_enabled` no Super Admin.
- Há metas em `src/features/goals/` e temporadas/premiações em `src/features/performance/`; a base de dados define temporadas imutáveis. A DEC-067 aprova temporada por tenant, reinício com histórico e reconhecimento por colocação sem pagamento automático. Há rankings no dashboard e em unidades. O inventário deve distinguir capacidade existente de exposição efetiva por papel.
- A UI já possui toasts, badges e estados em vários fluxos. O problema a resolver é consistência e cobertura, não ausência universal de feedback. Este plano é transversal por **família de rotas**; uma auditoria autenticada por ação e papel ainda deve confirmar lacunas de cada tela antes de editar.

## 3. Contrato único de feedback

### 3.1 Estados sem ambiguidade

Toda ação mutável relevante deve mapear `pronto → recebido/pendente → confirmado | falhou | conflito`; ações em fila externa acrescentam `agendado → enviado → entregue | falhou`, quando o provedor realmente oferece essas confirmações. “Solicitado”, “salvo”, “enviado”, “entregue” e “lido” jamais são sinônimos. A UI dá resposta visual imediata ao clique, mas só declara sucesso depois da confirmação apropriada. Se a operação for otimista e reversível, indicar “Atualizando…” e reconciliar/voltar o estado diante de falha.

### 3.2 Local de cada resposta

| Situação | Resposta canônica | Exemplo de texto |
|---|---|---|
| Campo inválido | Mensagem ao lado do campo, resumo de erros quando longo, foco no primeiro erro | “Informe a data de início.” |
| Clique simples/local | Estado do próprio controle e alteração do conteúdo | “Filtro aplicado” pode ser dispensado se a lista refletir o filtro imediatamente. |
| Salvamento demorado | Botão em andamento + status persistente na seção | “Salvando escala…” |
| Sucesso de ação local | Novo estado no próprio objeto; toast breve apenas se a confirmação não ficar evidente | “Escala publicada. 8 corretores avisados; 1 envio pendente.” |
| Trabalho assíncrono/externo | Badge de etapa, atualização temporal e ação de tentar novamente | “Convite criado. Aguardando envio pelo WhatsApp.” |
| Falha recuperável | Mensagem junto ao objeto, motivo claro, retry idempotente | “O documento não foi enviado. Tentar novamente.” |
| Erro global ou indisponibilidade | Banner da página, sem esconder dados já disponíveis | “A conexão com a Meta está temporariamente indisponível.” |
| Exclusão/decisão irreversível | Confirmação com impacto e depois recibo do resultado | “Revogar acesso de Ana? Ela perderá acesso à unidade X.” |

Evitar toast duplicado com mensagem inline; não usar verde para requisição apenas aceita. Exibir o próximo passo e, em operações relevantes, link ao objeto afetado. Feedbacks são textos claros em português; nunca depender apenas de cor, ícone, som ou animação. Notificações persistentes servem a eventos posteriores ou que exigem ação, não ao eco de cada clique.

### 3.3 Gramática visual e de conteúdo

Usar os estados semânticos existentes de `src/components/ui/`, `src/components/unlumen-ui/` e foundations. Um único conjunto de variantes compartilhadas para `pending`, `success`, `warning`, `error`, `disabled`, `empty` e `stale`. Rótulos curtos em verbos concretos: “Publicar escala”, “Reenviar convite”, “Tentar de novo”; respostas indicam objeto e resultado: “Escala de outubro publicada”. Em listas, status legível no item; em detalhes, trilha temporal quando há processo de várias etapas. Skeleton mantém geometria da tela; sem porcentagem falsa ou spinner infinito sem explicação.

## 4. Linguagem de microinterações: seis receitas reutilizáveis

Os tempos abaixo são **alvos de design**, a serem ajustados nos tokens existentes, não novos tokens por tela. O movimento nunca atrasa o reconhecimento de uma ação.

| Receita | Onde usar | Comportamento | Alvo e alternativa acessível |
|---|---|---|---|
| Resposta tátil de controle | Botões, chips e toggles | Mudança imediata de cor/pressão, foco visível; sem salto de layout | `micro`/`quick` existentes; sem transformação com movimento reduzido |
| Troca de estado | Salvar, aprovar, concluir | Label/ícone de pendente para confirmado, uma vez; sem confete | `quick`/`fast`; texto e ícone permanecem visíveis estaticamente |
| Continuidade espacial | Tabs, filtros, sheets e menus | Indicador ou painel transita da origem ao destino; foco acompanha | `fast`/`medium`; troca instantânea com movimento reduzido |
| Atualização de lista | Novo lead, reatribuição, nova mensagem | Entrada discreta do item e realce temporário, sem reposicionar violentamente a lista | `fast`; destaque estático no modo reduzido |
| Progresso real | Upload, importação, convite e sincronização | Etapas verificadas; porcentagem só se mensurada | Indicador sem loop chamativo; status textual em qualquer modo |
| Marco excepcional | Primeira escala publicada, meta verificada ou processo longo concluído | Pequeno acento de conquista no contexto, uma vez por marco | `slow` no máximo; versão estática e opção de desativar |

Nada de animar cada mensagem, cada nova linha de tabela, contadores sempre pulsando, parallax em tela de trabalho ou animação de erro que tire o foco. Em operações repetidas dezenas de vezes por dia, prevalece resposta estática rápida. Respeitar `prefers-reduced-motion`, o provedor global existente e uma futura preferência do usuário sem divergir dos controles do Super Admin.

## 5. Experiência ponta a ponta por domínio

Esta matriz é proposta de comportamento. Antes de qualquer mudança, levantar a ação real, endpoint, permissões, falhas e estados atuais em cada rota/aba.

| Domínio e rotas representativas | Interação e feedback propostos | Progresso/reconhecimento apropriado |
|---|---|---|
| Entrada, login e primeiro acesso | Checklist curto só quando há etapas obrigatórias; convite distingue criado, enviado e expirado; erro com recuperação. | Conclusão de configuração da conta, uma vez. |
| `/dashboard` e `/minha-fila` | “Próxima ação” contextual, cards que explicam a mudança de número e horário da última atualização; atualização sem piscar. | Progresso pessoal ancorado em metas válidas, nunca número arbitrário de cliques. |
| `/leads`, detalhe e formulários | Criação, edição, importação, reatribuição e mudança de etapa com estado no item, histórico e autoria; filtros preservados. | Checklist de dados essenciais do lead, sem forçar campos desnecessários. |
| `/conversas` e WhatsApp | Separar composição, fila de envio, aceito pelo canal, entregue e recebido; mensagens inbound aparecem sem depender de toast; reconciliação e retry idempotente. | Reconhecimento só para atendimento resolvido segundo regra validada, não volume de mensagens ou tempo mínimo. |
| `/distribuicao` e plantão | Simulação/revisão antes de publicar; dias cobertos, conflitos, elegíveis e pendências; publicar com recibo, avisos de entrega individuais, histórico de ocorrências. | Progresso de cobertura mensal **por data distinta** e escala publicada; sem “pontos” por alocar mais leads. |
| `/qualificacao` e IA | Estado ativo/pausado e versão salva visíveis; testes de roteiros com resultado e fonte, sem sugerir certeza falsa. | Checklist de configuração completa para gestores; não premiar score do lead. |
| `/vendas`, metas e performance | Confirmação de venda apenas quando persistida; meta mostra numerador, denominador, período e atualização. | Marcos de meta verificada, temporadas existentes e reconhecimento moderado conforme decisão de domínio. |
| `/documentos` | Upload com etapa real, nome, tamanho, falha recuperável, acesso/validação; foco permanece no item enviado. | Checklist documental quando há exigência concreta, não progresso genérico. |
| `/equipe` e unidades | Convites mostram criado/enviado/aceito/expirado; alterações de função/unidade têm resumo do impacto e auditoria. | Conclusão de onboarding da equipe; sem ranking de convites. |
| `/marketing/campanhas`, `/integrations/meta`, `/integrations/whatsapp` | Conexão/assinatura/sync separados; “última sincronização”, erro e próximo passo, sem declarar conectado antes da confirmação externa. | Configuração de canal concluída uma vez; nada por quantidade de formulários. |
| `/relatorios` e exportações | Filtros aplicados em URL; exportação mostra preparada/gerando/pronta/expirada e respeita permissão; recibo e download. | Sem pontos por consultar ou exportar dados. |
| `/settings`, perfil e notificações | Salvar por seção com estado persistente, preferência visível, confirmação de mudanças sensíveis. | Apenas checklist de configuração inicial quando útil. |
| `/super-admin` | Flags por capacidade, escopo, versão e trilha de auditoria; prévia do efeito e rollback; saúde da operação. | Nenhuma mecânica competitiva. |

Para cada família, validar estados: carregando, vazio, parcial, sucesso, atraso, falha, conflito, sem permissão, offline/queda de rede quando aplicável, mobile, teclado, leitor de tela, light/dark. Corretor Lite recebe a mesma semântica com menor densidade visual; sua navegação não é substituída.

## 6. Gamificação responsável, sobre dados reais

### 6.1 Três camadas, liberadas nessa ordem

1. **Clareza de progresso (primeira entrega):** tarefas e metas existentes com status, prazo, critério e próxima ação. Ex.: “3 de 5 documentos obrigatórios validados”; “meta de setembro: 7/10 vendas confirmadas”. Se não há dado confiável, não exibir percentual.
2. **Marcos pessoais (piloto):** reconhecimento discreto de acontecimentos verificáveis e pouco frequentes, como primeiro atendimento concluído, primeira escala publicada e meta batida. Marcos não dão prioridade na distribuição nem alteram comissão.
3. **Reconhecimento social/temporadas (decisão separada):** aproveitar o domínio `performance` existente apenas após definir indicadores, elegibilidade, contestação, escopo de visibilidade, correções históricas e relação com premiações. Ranking público desligado por padrão no piloto. Não ativar prêmio financeiro por efeito visual.

### 6.2 Regras anti-distorção

Não pontuar mensagens enviadas, cliques, leads aceitos sem qualidade, atendimentos encerrados depressa, horas online, plantões a mais, dados sensíveis ou tarefas burocráticas artificiais. Comparar períodos e oportunidades de maneira justa, conforme papel, unidade, carteira e elegibilidade; evitar expor o desempenho individual fora da permissão vigente. Um evento cancelado, duplicado ou revertido não pode manter conquista inválida. Feriados, férias, faltas justificadas, diferenças de volume e metas renegociadas exigem política explícita antes de competição. Experimento mede resultado operacional e bem-estar, não apenas engajamento com badges.

### 6.3 Contrato técnico e governança a definir antes de codificar

- Reutilizar `goals` e `performance`; não criar contador paralelo como fonte de verdade. Candidatos a marco saem de eventos de domínio **confirmados**, com identificador idempotente e versão da regra. Agregações por tenant e escopo derivado no servidor; nenhuma regra aceita `tenant_id` ou papel do cliente.
- Ledger de concessão/revogação somente se a análise das tabelas atuais mostrar gap real; guardar IDs e metadados mínimos, nunca texto de conversa, dados de saúde, telefone ou documento. Reconciliação e recálculo devem ser possíveis. Auditorar mudanças de regra, concessões manuais, premiações e visibilidade.
- Super Admin controla ativação global e versão/configuração; tenant configura o que lhe for permitido; usuário pode reduzir movimento e silenciar celebrações. Desligamento remove superfícies lúdicas sem apagar histórico de negócio, quebrar metas ou mudar roteamento/comissões.
- Registrar em `docs/decision-log.md` decisão aprovada para: eventos elegíveis, valor/regras, visibilidade por papel, opt-in/out, política de correção, retenção, premiações, unidade de comparação e eventual nova tabela. Alinhar o requisito “fora do MVP” com a capacidade já existente antes de construir o piloto.

## 7. Arquitetura de componentes e integração

Evoluir os componentes-base existentes antes de criar variantes. Criar um catálogo de estados, textos e exemplos em `/dev/component-preview` e no painel de motion do design system. `StatefulButton` pode concentrar `idle/pending/success/error` com rótulos em português; foundations/alerts/empty states representam estado local; Sonner/AnimatedToast concentra confirmação transitória. Um adaptador por fluxo traduz resultado do servidor para o contrato de UI, sem refatorar regras de distribuição, vendas, WhatsApp e permissões ao mesmo tempo. Eventos de domínio e eventuais concessões só são produzidos após sucesso real da transação/outbox correspondente.

Definir para cada ação uma ficha: papel, objeto, comando, autoridade, fase assíncrona, resultado, reversão, mensagem, foco, analytics e teste. O inventário de `ACTION_MAP.md` e `UX_FUNCTIONALITY_MATRIX.md` será a lista de cobertura; a matriz acima prioriza, mas não substitui a inspeção das rotas reais. Não adicionar dependências: `motion/react`, CSS, Sonner, tokens e componentes do projeto cobrem a proposta.

## 8. Sequência de entrega e portas de qualidade

| Onda | Entrega | Critério de saída |
|---|---|---|
| 0. Diagnóstico e governança | Concluir QA UX-M1.10 pendente; inventariar ações/feedbacks por papel e rota; medir duplicidade de toast, falhas sem retry, latência e pontos de confusão; aprovar decisões de domínio. | Matriz de cobertura assinada; baseline, riscos e proposta de etapa registrados no controle UX. |
| 1. Fundação | Vocabulário de estados e microcopy, componentes compartilhados e preview; preferências de movimento; testes de acessibilidade. | Os exemplos `pending/success/error/conflict/async` funcionam em teclado, leitor de tela, light/dark e mobile. |
| 2. Piloto comercial | Lead → distribuição/plantão → conversa → documento/venda; aplicar semântica e 2–3 movimentos reutilizáveis; feature flag por capacidade. | Estados verdadeiros e recuperáveis; sem divergência de lead/WhatsApp; rollback testado. |
| 3. Expansão operacional | Equipe, convites, integrações, qualificação, campanhas, relatórios, settings e Super Admin por superfícies coesas. | Mesma linguagem em todas as famílias; auditoria e permissão corretas; QA por papel. |
| 4. Progresso e marcos | Progresso real com metas/checklists; piloto opt-in de marcos não competitivos, pequeno grupo/tenant. | Nenhum incentivo perverso observado; dados reconciliáveis; decisão registrada. |
| 5. Avaliação de temporadas | Só após resultado do piloto: se útil, integrar reconhecimento social às temporadas existentes. | Política de justiça, visibilidade e eventual premiação aprovada; opção de desligar e contestar. |

Cada onda é um PR/superfície coesa ou conjunto pequeno de PRs, com revisão de design e domínio antes de avançar. Não mudar lógica comercial incidentalmente. Se o ganho é apenas visual, o mesmo evento/endpoint deve produzir o mesmo resultado de negócio. Flags por etapa e rollback preservam o produto utilizável.

## 9. Medição, testes e aceitação final

**Métricas de experiência:** tempo até primeira resposta visual, INP p75 móvel e desktop (referência “bom” ≤200 ms), taxa de ações repetidas por dúvida, recuperação de erro, conclusão de fluxos, tempo até próxima ação, feedback de usuários por papel. **Guardrails:** duplicação de mutações, falsos sucessos, notificações excessivas, queda de conversão/qualidade, tempo de atendimento artificialmente reduzido, aumento de reatribuições indevidas e regressões mobile. Telemetria minimizada e agregada; não instrumentar texto de conversa ou dados pessoais.

**Matriz de teste:** contrato de estado da ação; falha/timeout/retry; operação duplicada; race de atualização; permissão e tenant; reversão; entrega externa tardia; URL e filtros; foco/teclado; `aria-live`/status; `prefers-reduced-motion`; dark/light; 320, 360, 375, 390, 412 e 430 px de UX-M1.10, além de desktop. Testes de componente e integração nos fluxos de maior risco; QA visual no preview e nas rotas autenticadas. Medir desempenho em equipamento móvel comum. Para cada implementação, executar o harness (`agent:context`, `agent:verify` fast/full), `npm run build`, registrar evidência em `reports/agent/verification/`, atualizar documento de implementação, controle UX e `/roadmap` conforme `AI_RULES.md`.

**Definição de pronto para o programa:** todas as ações inventariadas têm uma resposta inequívoca ou justificativa documentada; falhas oferecem caminho de recuperação; nenhum sucesso é declarado antes da confirmação correta; movimento reduzido mantém a mesma informação; regras de negócio, permissões e tenant permanecem íntegras; a gamificação pode ser desligada sem alterar a operação; usuários dos quatro papéis entendem o próximo passo em teste real.

## 10. Base externa consultada

- [Nielsen Norman Group — Visibility of System Status](https://www.nngroup.com/articles/visibility-system-status/): feedback de comando e estado rapidamente visível.
- [Atlassian Design — Motion](https://atlassian.design/foundations/motion) e [Applying Motion](https://atlassian.design/foundations/motion/applying-motion): movimento semântico, tokens e atenção ao contexto.
- [Atlassian Design — Designing Messages](https://atlassian.design/foundations/content/designing-messages): escolher mensagem inline, aviso ou confirmação conforme alcance.
- [GOV.UK — Confirmation Pages](https://design-system.service.gov.uk/patterns/confirmation-pages/) e [Complete Multiple Tasks](https://design-system.service.gov.uk/patterns/complete-multiple-tasks/): recibo claro, próximo passo e progresso de tarefas reais.
- [W3C — WCAG 2.2](https://www.w3.org/TR/WCAG22/), [status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages) e [C39 reduced motion](https://www.w3.org/WAI/WCAG22/Techniques/css/C39): estados acessíveis e movimento controlável.
- [web.dev — Interaction to Next Paint](https://web.dev/articles/inp): referência de responsividade p75.

As fontes sustentam feedback, clareza e movimento com propósito. A escolha de marcos, indicadores e regras de gamificação é **proposta de produto para validação no CorreTop**, não uma recomendação universal extraída dessas fontes.

## 11. Validação técnica e viabilidade — 2026-09-27

Inspeção estática do repositório: 104 arquivos `page.tsx`, 140 arquivos TSX que referenciam `toast.success/error/warning/loading/info` e 27 limites `loading.tsx`/`error.tsx`. Essas contagens **não provam** cobertura nem qualidade: uma rota pode ter estados próprios, e um arquivo pode conter vários fluxos. Servem para dimensionar a auditoria por ação. Foi confirmado que o onboarding do Diretor já possui checklist; não duplicá-lo. Metas, temporadas, premiações e ranking já têm modelos separados; unir suas semânticas exige decisão de produto, não só animação.

| Ideia | Viabilidade atual | Evidência/condição | Decisão de execução |
|---|---|---|---|
| Rótulo, estado pendente e recuperação no botão compartilhado | Imediata | `StatefulButton` já existia; estado `error` estava indevidamente desabilitado e os rótulos padrão eram ingleses. | **Piloto implementado** no componente e na confirmação de presença. |
| Movimento governado do botão, toast e badge | Imediata | `feature_interface_motion_enabled` já é editável e auditada pelo Super Admin; `InterfaceMotionProvider` existe. | **Hardening implementado**: esses componentes obedecem ao controle e à preferência de movimento reduzido. Não criar flag concorrente. |
| Recibos verdadeiros para envios externos | Viável por fluxo | WhatsApp, convite e Meta têm fases distintas; confirmação de enqueue não prova entrega. | Mapear estados reais do serviço/outbox antes de alterar o texto de cada rota. |
| Desfazer ação | Viável apenas onde a operação é reversível | Reatribuição, exclusão lógica e alterações de configuração têm contratos diferentes. | Inventariar reversão server-side, janela e auditoria; não prometer “Desfazer” só no cliente. |
| Continuidade entre dispositivos e dados desatualizados | Viável com infraestrutura existente | Há sincronização local-first e refresh; o estado `stale` precisa ser ligado às consultas reais. | Piloto por domínio, sem banner global baseado apenas em conectividade do navegador. |
| Progresso de configuração/documentação | Viável com dados autoritativos | Checklist do Diretor e metas já existem; requisitos documentais variam. | Mostrar apenas etapas reais obrigatórias, com numerador/denominador verificável. |
| Marcos pessoais | Condicional | Requer evento confirmado, idempotência, reversão, permissão e controle por tenant. | Desenhar contrato e testar com usuários; sem contagem de cliques. |
| Ranking público, streak, pontos e premiações automáticas | **Não pronto como nova camada** | A DEC-067 já aprova temporadas e reconhecimento por colocação, mas não autoriza uma pontuação transversal, exposição pública irrestrita, streaks ou pagamento automático. O requisito antigo exclui gamificação do MVP. | Preservar ranking existente; não expandir sem reconciliar requisito e aprovar regras adicionais. |
| Celebração intensa, sons e confete a cada ação | Inadequada para CRM operacional | Ações repetidas e acessibilidade tornam o custo maior que o benefício provável. | Manter fora da linguagem padrão; marcos raros só após validação. |

### Interações adicionais a experimentar sem expandir o domínio

- **Recibo com próxima ação:** depois de publicar escala ou criar convite, mostrar o que foi persistido, o que ainda depende de entrega externa e onde acompanhar; preferir o contexto da própria tela.
- **Aviso preventivo de conflito:** antes de ação importante, explicar indisponibilidade ou pré-requisito com link de resolução; impedir apenas quando o servidor confirma o bloqueio.
- **Resumo de lote:** em importações, envios e alterações múltiplas, separar concluídos, pendentes e falhos com retry apenas dos falhos; nunca transformar sucesso parcial em sucesso total.
- **Rastro de atualização:** horários de última atualização e indicação discreta de dados antigos em painéis que mudam ao vivo, sem polling visual agressivo.
- **Retomada contextual:** preservar aba, filtros e item aberto após erro ou retorno de uma tarefa, usando os parâmetros de URL já adotados.
- **Quiet mode de operação:** manter sucesso rotineiro inline e reservar notificações persistentes para eventos posteriores que exigem decisão; medir volume de mensagens antes de criar preferência nova.

### Piloto concreto e hipótese

Na confirmação pública de presença do plantão, definida pela DEC-119, o corretor tem uma única ação principal. A UI agora mostra “Confirmar presença” em repouso, “Confirmando…” durante a requisição, “Presença confirmada” somente quando a API retorna sucesso e “Tentar novamente” clicável após erro, com motivo visível. A hipótese é reduzir cliques repetidos e dúvida sobre confirmação; isso **não** valida ainda um ganho medido com usuários reais. O estado do servidor, a elegibilidade e a auditoria existentes não foram alterados. O próximo piloto recomendado é uma operação interna de alto uso após QA autenticado UX-M1.10.
