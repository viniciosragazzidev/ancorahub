# DeskcommCRM: engenharia reversa e comparação com o AncoraHub

Data: 25/11/2026. Fonte: `github.com/melgarafael/DeskcommCRM`, commit `5e03dd7` (25/11/2026), lido em clone raso, sem rodar nada.
Também foi visto o curso público em `deskcomm.com.br/curso` (versão 1.94.0).

Convenção de caminhos:
- **DC:** arquivo do DeskComm (raiz do repositório deles).
- **AH:** arquivo do AncoraHub (raiz deste repositório).

Observação sobre ferramentas: não há skill "reverse engineer" instalada. A ferramenta `reverse-api-engineer` (kalil0321) captura o tráfego de rede de um site ao vivo e gera um cliente de API. Ela não lê repositório. Como o código do DeskComm é aberto, a API foi lida direto das rotas (seção 3.9), o que é mais completo que o tráfego de uma sessão.

---

## 1. Resumo em dez linhas

1. O DeskComm é um CRM de WhatsApp com IA, MIT, auto-hospedado. Ele se vende como alternativa aberta ao Kommo, Octadesk, Intercom e Zendesk (DC `VISION.md`).
2. O mantenedor não cobra nada. A renda vem de parceria de VPS (HostGator). Quem instala pode revender como SaaS próprio, com marca própria, planos, teste grátis, checkout e suspensão por atraso (DC `docs/adr/0004-cobranca-do-revendedor.md`, `lib/cobranca/`).
3. É genérico (clínica, e-commerce, imobiliária, agência). O AncoraHub é vertical: corretora de plano de saúde, plantão de corretor e pós-venda.
4. A navegação é a parte mais madura deles. Um catálogo único gera a sidebar, os hubs "Ver tudo em…", o ⌘K e a barra do celular. Um teste quebra o build quando nasce rota fora do catálogo (DC `lib/navigation/catalogo.ts`).
5. A sidebar deles tem pouco item fixo (cerca de 15) e o resto mora em hubs. A ordem vai do que se opera ao que se ajusta: Atendimento, CRM, Agente de IA, Canais, Análise e, no rodapé, Configurações.
6. A camada de IA é mais profunda que a nossa em operação: versões publicadas com rollback, modelo reserva, guardas antes do envio, casos com humano, central de avisos e log de execuções.
7. A distribuição de leads deles é simples (manual, rodízio, carga). A do AncoraHub é muito mais rica: oferta exclusiva, aceite, SLA duplo, plantões com presença e filas por plantão.
8. O AncoraHub ganha no design (Lite "Conversa", feedback por níveis, Sasá por voz) e no domínio de corretora.
9. Vale trazer, nesta ordem: contadores na sidebar, central de avisos, hubs "Ver tudo", ⌘K com tudo, log de execuções da IA, guardas antes do envio, radar de leads esfriando, curso em imagens gerado das telas.
10. Nesta mesma branch o menu do diretor foi reorganizado na ordem "operar antes de ajustar" (seção 6).

---

## 2. Modelo de negócio do DeskComm

### 2.1 Público e posicionamento
- **Licença:** MIT, "Copyright (c) 2026 Rafael Melgaço" (DC `LICENSE:1-3`).
- **Posição:** "AI Sales OS", CRM aberto e auto-hospedado com agentes de IA no WhatsApp (DC `VISION.md`, seção "Posicionamento").
- **Público:** nasceu para e-commerce (WAHA e Nuvemshop) e hoje mira clínicas, imobiliárias, infoprodutores, agências e serviços. Também mira quem instala para clientes.
- **Vários nichos no mesmo código:** cada funil tem um `vocabulary` (o lead vira Cliente, Paciente ou Comprador).

### 2.2 Como ganham dinheiro
Há três fluxos de dinheiro separados (DC `docs/adr/0004-cobranca-do-revendedor.md`, tabela D1):

| Quem | Cobra de quem | Estado |
|---|---|---|
| Mantenedor | Ninguém. "Não existe feature travada" | Renda vem da parceria de VPS (DC `hostgator-setup-kit/`) |
| Operador de agentes | Mensalidade por cliente operado | Decidido em 13/09/2026, preço em aberto (DC `docs/doctrine/operacao-de-agentes.md`, `lib/agencias/modulo.ts`) |
| Dono da instalação | As empresas dentro da instalação | Pronto: planos, teste, checkout, régua e suspensão |

- **Tentativa recusada:** uma tentativa de SaaS pago com marca única (PR 307, Asaas) foi fechada sem merge em 24/08/2026.
- **White-label explícito:** "modificar, hospedar para terceiros, revender e cobrar o que quiser" (DC `docs/white-label.md:5-7`). Há um guia de 7 passos para montar o próprio SaaS (DC `docs/saas/README.md`).

### 2.3 Cobrança do revendedor
A cobrança vem desligada por padrão e é ligada por instalação (DC `lib/instalacao/modulos.ts:61-111`).

**Provedores** (DC `lib/cobranca/provedores/{stripe,asaas,efi}.ts`):
- Stripe: só cartão recorrente.
- Asaas: Pix, boleto ou cartão, uma fatura por vez.
- Efi: boleto recorrente.

**Planos** (DC `lib/cobranca/planos.ts`, `docs/saas/cobranca.md`):
- Preço mínimo de R$ 5, mensal ou anual.
- Teste grátis de 0 a 90 dias (padrão 14). Zero dias significa empresa suspensa até o primeiro pagamento.
- Três limites por plano: `max_assentos` (pessoas), `max_canais` (números de WhatsApp) e `teto_ia_usd_cents`.
- O teto de IA só vale quando a empresa usa a chave da instalação. Com chave própria (BYOK), não há teto.
- Não há limite de mensagens.

**Limites travados no banco:** os triggers `trg_trava_assentos_do_plano` e `trg_trava_canais_do_plano` disparam `PT402`, que a app traduz em 409 (DC `lib/cobranca/limites.ts:9-25`).

**Régua de atraso** (DC `lib/cobranca/configuracao.ts:16-18`, `regua.ts:25`):
- Tolerância de 5 a 30 dias (padrão 7).
- Aviso no dia 0, aviso final 2 dias antes do fim da tolerância, depois suspensão.
- Pagou, reativa na hora.
- O estado é relido do provedor a cada 6 h. O corpo do webhook nunca é tomado como verdade.

**Troca de plano:**
- Upgrade cobra a diferença proporcional (DC `lib/cobranca/prorata.ts`).
- Downgrade fica para a próxima renovação.
- Em atraso, não troca.

**Suspensão** (`organizations.status`):
- Sem IA e sem envio de mensagens.
- Entrada continua sendo gravada.
- Pedidos de LGPD nunca são bloqueados.

### 2.4 Multi-tenant, cadastro e onboarding

**Isolamento:** `organization_id` em toda tabela, com RLS via `fn_user_org_ids()`. São 195 tabelas com RLS ligada em DC `supabase/baseline.sql`, e há teste de isolamento entre dois tenants.

**Cadastro:**
- Modos `aberto`, `com_aprovacao` e `so_convite` (DC `lib/auth/politica-de-cadastro.ts`).
- API de provisionamento externa, desligada sem segredo (DC `app/api/v1/tenants/provision/route.ts`).

**Onboarding** (DC `lib/onboarding/passos.ts:51-112`): "Seu negócio", "O telefone dele", "Sua loja", "Treinar", "Onde ele organiza", "Ver ele atender", "Quem trabalha com ele". A app só abre depois do onboarding.

**Empresa molde de IA:** uma empresa modelo passa a escolha de modelos por função para toda empresa nova, sem copiar credenciais (DC `lib/ai/molde-de-ia.ts`).

### 2.5 Papéis

**Papéis da empresa** (DC `lib/auth/types.ts:25-32`): `viewer` < `agent` < `ai_operator` < `manager` < `admin`.
- `ai_operator` nunca é pessoa: é o escopo do token do agente publicado.
- Cerca de 229 rotas exigem gerente ou admin.

**Admins de plataforma:** escopo `full` ou `support_readonly`. A sessão de suporte que entra numa empresa dura 1 h e é auditada (DC `docs/support-sessions.md`).

**MFA:** por política, na plataforma e por empresa (DC `lib/auth/politica-mfa.ts`).

### 2.6 Custo de IA
- **Chave própria por empresa:** em Agente de IA › Credenciais. Sem ela, vale a chave da instalação.
- **Orçamento mensal:** com modo "só avisar" ou "parar". Ao estourar, a conversa passa para humano (DC `lib/ai/budget/pode-gastar.ts`).
- **Provedor e modelo por função:** cerca de 37 funções, de `agent_turn` a `transcricao_de_audio` (DC `lib/ai/pontos/registro.ts`).
- **Jev:** uma IA de decisões rápidas que exige consentimento LGPD explícito, porque manda dados para os EUA.

### 2.7 Implantação
- **Processos** (DC `docker-compose.prod.yml`): app, worker, scheduler (crond chamando 54 rotas de cron), WAHA, Redis, Asterisk, voice-agent e Caddy.
- **Variantes:** Traefik (Coolify, Dokploy), Cloudflare Tunnel e Supabase próprio. Há guia de Coolify em DC `docs/saas/coolify.md`.

**Comparação com o AncoraHub:**
- O AncoraHub é multi-tenant (BR-001, `tenantId` em cerca de 554 linhas de AH `src/shared/db/schema.ts`).
- A cobrança aqui é mínima. AH `src/features/billing` está vazio. AH `/assinatura` só mostra "Essencial, até 3 usuários" e "Profissional, até 10", e a regra é "só pago, sem teste" (BR-010).
- Não há gateway de pagamento no AncoraHub.

---

## 3. Sistema de negócios do DeskComm

### 3.1 Entidades principais
O schema real está em DC `supabase/baseline.sql` (90.915 linhas, cerca de 237 tabelas). Há 780 migrations em DC `supabase/migrations/`.

| Área | Tabelas e regras |
|---|---|
| Contato | `contacts` (único por empresa+telefone, CPF cifrado, `carteira_user_id` = dono da carteira), `contact_phones`, `merge_queue` (juntar duplicados) |
| B2B | `companies`, `people`, `company_people` (cargo, decisor, principal) |
| Negócio | `crm_leads` (funil, etapa, status open/won/lost, motivo de perda obrigatório por CHECK, valor e recorrência, dono humano ou agente, `position_in_stage`, campos livres, tags) |
| Linha do tempo | `crm_lead_activities` (barramento de eventos), `crm_lead_links`, `lead_notes`, `crm_lead_scores`, `crm_lead_risk_states` |
| Funil | `crm_pipelines` (vocabulário, motivos de perda), `crm_stages` (`is_won`/`is_lost`, `expected_duration_hours`, `requires_human`) |
| Tarefa | `crm_tasks` (prioridade, prazo, plano e passo do plano) |
| Conversa | `conversations` (status, dono, setor, `awaiting_since`, soneca), `messages`, `conversation_notes`, `passagens_de_atendimento`, `demandas` |
| Canal | `channel_sessions` (1 número, limite diário), saúde, aquecimento, `channel_knobs`, `pacing_ledger`, pausas planejadas |
| Agenda | compromissos, tipos (preço, lembrete), exceções, salas, lista de espera, espelho do Google |
| Venda | propostas e modelos, produtos, comandas, financeiro (contas, lançamentos, recorrentes), metas |
| Campanha | `campaigns` (velocidade gradual/rápida/transmissão), pool de números, supressões; cadências de e-mail |
| Anúncio | regras de conversão Meta e Google, cliques CTWA, links de rastreio |

### 3.2 Funis
- **Ganho e perda:** entrar numa etapa `is_won` ou `is_lost` fecha o negócio pelo trigger `trg_crm_lead_close_on_stage`. Perder sem motivo é recusado pelo banco.
- **Troca de funil:** mover para outro funil não conta como perda (DC migration `0266_transferencia_entre_funis_nao_e_perda.sql`).
- **Automações de etapa:**
  - aviso de etapa;
  - follow-up ao entrar ou sair da etapa;
  - gatilho de "parado na etapa" por `expected_duration_hours`;
  - comanda criada ao ganhar.
  - Arquivos: DC `lib/leads/aviso-de-etapa.handler.ts`, `lib/followup/gatilho-etapa.ts`, `lib/automation/prazos-da-etapa-parada.ts`, `lib/financeiro/comanda-do-ganho.handler.ts`.

### 3.3 Distribuição ("Distribuição de atendimento")
Tela em DC `app/app/settings/atendimento/page.tsx`.
- **Modos:** `manual` (padrão), `round_robin` e `load`. Não há peso. O rodízio ordena por `lastAssignedAt` e depois pela carga (DC `lib/routing/decide.ts`).
- **Por número:** modo próprio, responsável padrão, lista de quem pode receber e espera da IA qualificar antes (DC `lib/routing/channel-policies.ts`).
- **Quem pode receber:** disponível, dentro do horário e abaixo da capacidade (DC `lib/routing/eligibility.ts`).
- **Devoluções:** a conversa volta ao rodízio se ninguém respondeu, e a IA volta depois de um tempo (DC `lib/escalacao/devolucao-ao-rodizio.ts`).
- **Quem vê o quê:** `all`, `own_and_unassigned` (padrão), `own` ou `own_and_sector`, imposto por RLS (`fn_can_view_lead`).
- **Setores como filas**, com horário próprio (módulo `setores`).

**Comparação com o AncoraHub:** aqui a distribuição é bem mais forte. Ver AH `docs/business-rules.md:38-88` e AH `src/features/lead-distribution/` (cerca de 130 arquivos):
- oferta exclusiva sequencial com aceite (BR-023);
- SLA duplo com troca atômica (BR-025, BR-028);
- plantões com escala publicada e presença confirmada (BR-031 a BR-034, BR-029V);
- filas compartilhadas entre plantões (BR-029X);
- Matriz que nunca recebe automático (BR-029L).

### 3.4 Automações
Motor em DC `lib/automation/engine.ts`, alimentado pelo log de eventos.

**Regra:** gatilho, condições e de 1 a 10 ações, com limites por contato.

**23 gatilhos** (DC `lib/schemas/webhooks.ts:44`):
- Negócio: `lead.created`, `stage_changed`, `won`, `lost`, `reopened`, `assigned`, `tag_added`, `updated`, `date_field_due`, `silent_for`, `stage_stale`.
- Mensagem: `message.received`, `message.failed`.
- Contato: `contact.tag_added`, `phone_added`, `birthday`.
- Agenda: `appointment.*` (seis eventos).
- Ligação: `voice_call.missed`.

**Ações** (DC `lib/automation/actions/register-all.ts`):
- Negócio: criar ou mover negócio, atribuir dono (fixo, rodízio ou destino), definir setor, preencher data.
- Etiquetas: adicionar e remover.
- Mensagens: WhatsApp, e-mail, iniciar fluxo.
- Tarefas: criar tarefa, aplicar plano de tarefas.
- Integração: avisar equipe, webhook assinado.
- IA: mensagem de IA e decisão de IA.

**Planos de tarefa:** sequências aplicadas por automação (DC `lib/tarefas/plano.ts`).

**Follow-up em grafo:** nós de espera, condição, resposta, coleta, mover etapa e etiqueta. É versionado e importável (DC `lib/followup/engine.ts`).

**Agendador:** 54 crons, de cada minuto a semanal. A lista completa está em DC `docker/scheduler/entrypoint.sh`.

### 3.5 Canais
**Provedores** (DC `lib/channels/capabilities.ts:290-413`):
- WAHA (padrão, sinalizado como risco de banimento);
- Meta Cloud;
- Zernio (BSP, também redes sociais);
- Datafy;
- Telegram;
- webchat;
- wacalls (só voz).

**Antibanimento** (DC `lib/agent-engine/pacing/defaults.ts`):
- 1,2 s entre envios mais variação aleatória;
- atraso "humano" por caractere;
- janela das 7h às 22h;
- aquecimento por idade do número (20, 50, 100, 200 e depois livre a partir do dia 31);
- teto diário por número.

Resposta a quem escreveu não conta no teto. Uma terceira cópia quase igual é vetada (Jaccard maior ou igual a 0,8).

**Saúde da conexão:** checagem a cada 5 min, "canal mudo", sessão travada iniciando e pausas planejadas (DC `lib/channels/health.ts`, `central-de-pausa.ts`).

**Campanhas:**
- Máquina de estados.
- Ritmo que só pode ser mais rígido que o do canal.
- Rodízio de números: primeiro o número com que a pessoa já fala, depois o de maior folga.
- Supressão rechecada antes de cada envio (DC `lib/campanhas/`).

### 3.6 Radar, Desempenho, Atividades e Anúncios
- **Radar** (DC `lib/leads/risk-radar.ts`, `risk-worker.ts`):
  - Faixas crítico, em risco, em voo e em dia. Esfria em 24 h e fica crítico em 72 h, com ajuste por etapa.
  - O job roda a cada 15 min e só grava quando a faixa muda, já propondo reativação.
- **Desempenho** (DC `app/app/metrics/`): painéis Atrito, Canais, Meta do mês, Perdas, Previsão e Série, sobre `fn_attendant_metrics` (primeira resposta humana com média e mediana).
- **Atividades:** relatório por pessoa, tipo e dia, e relatório de etiquetas (DC `app/app/activities/`).
- **Conversões:**
  - Meta CAPI por etapa e nascimento por clique CTWA (DC `lib/conversoes/`).
  - Google Ads com gclid e categorias por etapa (DC `lib/conversoes/regras-google.ts`).

### 3.7 Inbox
Arquivo central: DC `components/inbox/InboxLayout.tsx`.
- **Três colunas** redimensionáveis, com larguras salvas.
- **Abas:** Automático, Fila, Minhas, Todas, Fechadas, Arquivadas e Pessoal. Dá para personalizar as abas (DC `InboxFilters.tsx:74-86`).
- **Filtros:** não lidos, grupos, número, etiqueta (E/OU), fila e atendente. Ordem "Esperando há mais tempo".
- **Cabeçalho da conversa:** Assumir, Liberar, Devolver ao automático, Transferir, Fechar e Ficha. No menu "Mais": criar tarefa, pausar o automático, IA com o dono, exportar.
- **Ficha lateral:** 17 módulos que se reordenam e escondem (DC `lib/inbox/modulos-da-lateral.ts:64-112`).
- **Composer:**
  - Responder ou Nota interna.
  - Bloqueio "Assuma esta conversa para responder".
  - Anexos, áudio, respostas rápidas na barra, @menção.
  - "Sugerir resposta" com revisão, mensagens agendadas e aviso de janela de 24 h fechada.
- **Atalhos:** j/k, r, a, e e ? (DC `InboxKeyboardShortcuts.tsx:56-71`).

### 3.8 IA
**Registro de toda chamada de modelo** (DC `lib/ai/pontos/registro.ts`):
- Seis papéis: atender, entender, proteger, lembrar, perceber e melhorar.
- Um teste falha se houver chamada fora do registro ou registro sem chamada.

**Agente versionado** (DC `lib/agent-engine/agent/agent-config.ts`):
- Versão publicada imutável mais um ponteiro, relida a cada turno. Publicar vale na próxima mensagem, e voltar é mover o ponteiro.
- Modelo reserva para erro 429, 5xx ou tempo esgotado.
- Janela de atendimento e feriados.
- Picotar mensagens e espera de rajada.
- Modos automático e assistido (rascunho).

**Guardas antes do envio** (DC `lib/agent-engine/guardrails/before-send.ts`), 12 em ordem fixa:
- opt-out, LGPD, ritmo, janela, cópia repetida;
- promessa (determinística e semântica), caso inventado, vocabulário interno;
- horário de agenda só se a ferramenta devolveu nesse turno;
- "já registrei" só se gravou de verdade;
- identificação.

**Teto de respostas por conversa:** criado depois de um loop robô com robô que gerou 216 respostas numa hora (DC `teto-de-respostas.ts`).

**Casos** (DC `lib/agent-engine/agent/human-cases.ts`):
- A IA abre um caso para humano e continua falando com o cliente.
- A equipe responde pelo WhatsApp com `RESPONDER <id> <texto>` (DC `lib/escalacao/resposta-whatsapp-ao-caso.ts`).

**Central de avisos** (DC `lib/ai/agent-inbox-copy.ts`):
- Cada falha tem nome claro: QR caiu, mensagem travada, mídia não lida, canal em teste, orçamento, promessa não cumprida.
- O build falha se faltar rótulo para algum tipo.

**Execuções:** responde "por que o agente parou?" com o rastro de cada turno (DC `app/app/ai/runs`, `traco-do-turno.ts`).

**Propostas de próximo passo:** ficam numa fila com aprovação presa ao número da proposta (DC `app/app/ai/proposals/page.tsx`).

**Uso:** avisa quando o contexto passa de 100 mil tokens e o preço salta (DC `lib/ai/custo-escalonado.ts`).

**Elegibilidade:** canal novo começa em modo teste, só com números de testadores (DC `lib/ai/elegibilidade/pre-go-live.ts`).

**Outros:**
- Roteador entre agentes com passagem silenciosa (DC `lib/agent-engine/agent/router-config.ts`).
- Fluxos de perguntas com validador que grava a resposta limpa (DC `flow-validate.ts`).
- Memória da empresa com validade.
- Skills com revelação progressiva.
- Agente de voz por SIP e Asterisk.

### 3.9 API, MCP e extensões
**API `/api/v1`:**
- Cerca de 60 grupos: contacts 32 rotas, conversations 34, leads 27, ai 93, cron 54, admin 34.
- Autenticação por cookie ou `Bearer dsk_…` com escopos (`contacts:write`, `messages:on_behalf`, `role:manager` e outros) (DC `lib/api/auth-dual.ts`, `lib/api/escopos-do-token.ts`).
- Sem `contacts:write`, a edição vira proposta para revisão.

**MCP interno** (DC `app/api/mcp/route.ts`, `lib/mcp/tools/`):
- Cerca de 100 ferramentas `crm_*`, com OAuth, auditoria e dicas de destrutivo.
- O agente também é cliente de MCPs externos. A liberação de escrita é uma ferramenta por vez, sem curinga.

**Banco externo só leitura:** Postgres e MySQL, com SELECT montado no servidor e receitas para WooCommerce e WordPress (DC `lib/external-db/`).

**Webhooks de saída:** assinados por HMAC, com `delivery_id` estável e 3 tentativas (DC `lib/automation/actions/call-webhook.ts`).

**Extensões:** pacotes JSON declarativos e assinados por sha256, não código (DC `lib/extensions/manifest.ts`).

---

## 4. Interface do DeskComm, começando pela sidebar

### 4.1 Arquitetura da navegação
- **Um catálogo só:** `NAV_CATALOG` (DC `lib/navigation/catalogo.ts:162-1453`) é a única lista de destinos. Ele projeta quatro coisas:
  - a sidebar (`sidebarGroups()`, DC `lib/navigation/registry.ts:165-193`);
  - os hubs (`hubSections()`, `:202-222`);
  - o ⌘K (`searchable()`, `:225-239`);
  - a barra do celular.
- **Teste de completude:** um teste quebra o CI se uma rota nascer fora do catálogo (DC `tests/unit/navegacao-completude.test.ts`).
- **Campos de cada destino:** `minRole`, `modulo`, `capacidade`, `healthDot` e `contador` (`casos`, `fila` ou `tarefas`) (DC `catalogo.ts:47-83`).
- **Regra do hub:** um grupo com mais de 4 telas ganha hub "Ver tudo em…" e só as principais ficam na sidebar (DC `catalogo.ts:94-103`).
- **Teste de altura:** um teste e2e exige que o menu inteiro caiba em 1280×900 sem rolagem (DC `components/shell/Sidebar.tsx:279-332`).

### 4.2 Itens, em ordem
Ícones Phosphor, via DC `lib/ui/icons.ts`.

| Grupo | Item | Rota | Ícone | Papel mínimo | Extra |
|---|---|---|---|---|---|
| Atendimento | Inbox | `/app/inbox` | Tray | leitura | contador da fila |
| Atendimento | Radar | `/app/radar` | ClockCountdown | leitura | |
| Atendimento | Agenda | `/app/agenda` | CalendarBlank | leitura | |
| Atendimento | Respostas rápidas | `/app/templates` | FileText | leitura | |
| CRM | Funis | `/app/kanban` | Kanban | | |
| CRM | Contatos | `/app/contacts` | Users | | |
| CRM | Tarefas | `/app/tasks` | ListChecks | | contador de tarefas |
| CRM | Ver tudo em CRM | `/app/crm` | ArrowRight | | hub |
| Agente de IA | Agentes | `/app/ai/agents` | Robot | gerente | |
| Agente de IA | Follow-ups | `/app/ai/followups` | FlowArrow | gerente | |
| Agente de IA | Casos | `/app/ai/cases` | ClipboardText | atendente | contador de casos |
| Agente de IA | Ver tudo em IA | `/app/ai` | ArrowRight | | hub |
| Canais | Conexões | `/app/connections` | PlugsConnected | admin | ponto de saúde |
| Canais | Webhooks | `/app/webhooks` | WebhooksLogo | gerente | |
| Análise | Desempenho | `/app/metrics` | ChartBar | leitura | |
| Análise | Meta Ads | `/app/ads/meta` | Megaphone | gerente | |
| Análise | Atividades | `/app/activities` | ClockCounterClockwise | | |
| Análise | Ver tudo em Análise | `/app/analise` | ArrowRight | | hub |
| Rodapé fixo | Configurações | `/app/settings` | Gear | | hub da organização |
| Rodapé fixo | Ajuda | `/app/ajuda` | BookOpen | | |
| Rodapé fixo | Versão | | | | "Nova versão disponível" (DC `components/shell/VersionFooter.tsx`) |

Módulos conectados entram no fim, num grupo "Módulos" (DC `registry.ts:133-191`).

### 4.3 Hubs (telas fora da sidebar)
Componente: DC `components/shell/NavHub.tsx:46-104`. Cada hub tem título, subtítulo, seções e uma grade de cartões com ícone, nome e descrição.

**CRM** (DC `catalogo.ts:177-602`):
- "O dia a dia da venda": Prospecção, Lista de espera, Campanhas, Empresas, Pessoas, Planos de tarefa, Chamadas, Cold Call, Comandas, Cadências.
- "Preparar a venda": Produtos, Serviços, Importações, Etapas do funil.
- "Fechar a venda": Propostas.

**IA** (DC `catalogo.ts:644-819`):
- "Montar o agente": Fluxos, Roteadores, Credenciais, Provedores.
- "Ensinar o agente": Conhecimento, Memória, Skills.
- "Acompanhar o agente": Alertas, Aviso no WhatsApp, Propostas, Execuções, Uso e orçamento.

**Análise:**
- "Dinheiro".
- "Os números do período".
- "O histórico que se consulta".

**Configurações** (DC `catalogo.ts:1105-1449`):
- "Sua conta".
- "Sua empresa", com 21 telas.
- "Dados e acesso".

Os subtítulos dizem para que serve cada hub. Exemplo do CRM: "Onde a venda acontece, e o que você define uma vez para ela funcionar" (DC `app/app/crm/page.tsx:66-70`).

### 4.4 Comportamento visual da sidebar
Arquivo: DC `components/shell/Sidebar.tsx`.
- **Larguras:** 240 px aberta e 64 px recolhida.
- **Recolhida:**
  - só ícones, com o nome no tooltip;
  - o título do grupo vira uma linha fina;
  - o contador vira um ponto de 8 px.
- **Memória do estado:**
  - Recolher fica gravado num cookie httpOnly por 1 ano (DC `app/actions/shell/toggleSidebar.ts`).
  - Cada grupo se fecha sozinho e a escolha fica no localStorage `sidebar-grupos-fechados`.
- **Item ativo:** fundo de destaque e ícone preenchido (`weight="fill"`).
- **Contadores:** pílula vermelha que some no zero (DC `components/shell/ContadorDaFila.tsx:18-38`).
- **Pré-carga por intenção:** o link só pré-carrega no hover ou no foco.

### 4.5 Menu personalizável
- **Configuração da empresa:** `interface_settings` (DC `lib/navigation/interface.ts:20-72`), com:
  - perfil "Completa" ou "Simplificada";
  - lista de destinos;
  - tela inicial;
  - "bloquear até assumir".
- **Perfil simplificado:** Inbox, Agenda, Funis, Contatos, Tarefas e Conexões.
- **Portas que nunca somem:** Perfil, Segurança, Notificações e App no celular.
- **Menu por membro:** o menu da empresa e o do membro se cruzam, e o resultado é a interseção (`combinarInterfaces`). Isso só esconde telas; quem libera acesso continua sendo o papel.
- **Onde se edita:** em Organização › Menu lateral e na ficha de cada pessoa da Equipe (DC `components/team/InterfaceEditor.tsx`).

### 4.6 Celular
- **Barra inferior** (DC `components/shell/BarraInferior.tsx`): os 4 primeiros destinos visíveis entre Inbox, Funis, Agenda, Desempenho, Contatos e Casos, mais "Mais".
- **Gaveta lateral:** reaproveita a sidebar com alvos de 44 px (DC `components/shell/MobileSidebar.tsx`).
- **Barra do topo:** busca, central de avisos e menu do usuário (DC `components/shell/TopBar.tsx`).
- **Inbox no celular:** a conversa vira camada de tela cheia e a ficha vira gaveta.

### 4.7 Padrões de página
- **Base:** shadcn sobre Radix, com Tailwind v4.
- **Cabeçalho:** não há componente de cabeçalho genérico. Cada página escreve o próprio `h1` e subtítulo. As subtelas de configuração usam "← Voltar para Configurações" (DC `components/settings/CabecalhoDaSubTela.tsx`, cerca de 29 páginas).
- **Tabelas:**
  - `Table` simples do shadcn, sem TanStack Table.
  - A linha não é clicável inteira: o nome é um link para a página do contato (DC `components/contacts/ContactsTable.tsx:301-306`).
  - Paginação por "Carregar mais".
- **Filtros:** menus suspensos com rádio e checkbox, etiquetas com E/OU e "Limpar filtros". Não há visões salvas.
- **Formulários e confirmações:**
  - Diálogo para criar e editar (89 arquivos usam `dialog`).
  - Gaveta (`sheet`) só em 17 arquivos.
  - Confirmação destrutiva em `alert-dialog`.
- **Vazios:** `EmptyState` com ícone, título, texto e botões, mais 11 variantes por tela (DC `components/empty/variants.tsx`).
- **Carregamento:** esqueletos e barra de progresso de navegação.
- **Toasts:** Sonner no canto inferior direito, em 247 arquivos.
- **⌘K** (DC `components/shell/PaletaDeDestinos.tsx`):
  - Indexa todo destino visível, além de funis, fluxos e agentes.
  - A busca ignora acentos.
- **Tema:**
  - Neutros quentes com acento "Sage" e modo escuro.
  - Dez modelos de aparência por empresa, com fonte, arredondamento e densidade (DC `lib/aparencia/catalogo.ts`).
  - Marca por empresa, com CSS próprio na instalação.
  - O guia deles proíbe fonte Inter, ícone Sparkle para IA e ícones Lucide (DC `docs/design-system/09-anti-patterns.md`).

### 4.8 Ajuda e curso
- **Curso em imagens:** gerado das telas reais.
  - As lições ficam em JSON (85 arquivos em DC `curso/licoes/`).
  - Um Playwright tira as fotos e mede os alvos (DC `curso/capturar.ts`), e outro script desenha setas e caixas (`montar.ts`).
  - Cada lição tem os modos Ler e Simular.
  - Há demonstrações por segmento em DC `curso/demonstracoes/`.
- **`/app/ajuda`:** mostra o que o seu papel pode fazer e liga cada tarefa à tela certa.
- **Tour:** não há biblioteca de tour dentro da app.

---

## 5. Comparação com o AncoraHub

### 5.1 Sidebar e navegação do AncoraHub hoje
- **Fonte única:** AH `src/shared/navigation/nav-registry.ts`.
  - São 11 áreas (`NAV_AREAS`, `:56-202`), cada uma com abas.
  - Os grupos (`NAV_GROUPS`) montam a sidebar do diretor em AH `src/components/corretop-sidebar.tsx:330-377`.
- **Abas da área:** ficam no topo da página (AH `src/components/navigation/area-tabs.tsx`). As abas `inPlace` trocam só a URL.
- **Topo da sidebar:**
  - logo;
  - "Visão" e "Ver como", só para admin de plataforma;
  - atalho "Área de Plantão" com ponto verde (AH `corretop-sidebar.tsx:277-323`).
- **Rodapé:** "Agente IA" (Ctrl+J) e menu do perfil (AH `corretop-sidebar.tsx:412-531`).
- **Recolher:** a barra vira trilho de ícones, a escolha fica num cookie por 7 dias e o atalho é Ctrl/Cmd+B (AH `src/components/ui/sidebar.tsx:34-35`).
- **Celular do diretor:**
  - A sidebar vira gaveta de 18 rem.
  - O avatar abre a folha "Mais" (AH `src/components/light/director-more-sheet.tsx`).
  - Não há barra inferior.
- **Corretor:** não tem sidebar.
  - A navegação é a lista de conversas da Início, com Sasá, Meus Leads, Minha carteira, Plantão, Agenda, Desempenho, Cotação e Call Âncora (AH `src/features/broker-workspace/chat/assistant-scripts.ts:30-44`).
  - O resto fica na folha "Mais" (AH `src/components/light/light-more-sheet.tsx`).
  - É a regra "Sem sidebar, sem barra de abas" (AH `docs/design-system/lite/LITE_CHAT_DESIGN_SYSTEM.md` §1.5).
- **Teste de completude:** já existe. Toda página do grupo `(dashboard)` precisa estar numa área ou numa lista de exceções com motivo (AH `src/shared/navigation/nav-registry.test.ts`, `OUTSIDE_AREAS`).

### 5.2 O que o DeskComm tem e o AncoraHub não tem

| Recurso | Onde está no DC | Situação no AH |
|---|---|---|
| Contadores na sidebar (fila, casos, tarefas) | `catalogo.ts` campo `contador`, `ContadorDaFila.tsx` | `NavItemConfig` aceita `beta` e `statusDot`, mas nenhuma área usa contador (AH `corretop-sidebar.tsx:73-85`) |
| Hubs "Ver tudo em…" com cartões descritos | `components/shell/NavHub.tsx` | Não há. As áreas têm abas, e Atendimento IA chega a 13 abas numa fileira (AH `nav-registry.ts:163-177`) |
| ⌘K que indexa todo destino, funis e agentes | `searchable()`, `PaletaDeDestinos.tsx` | Existe Ctrl+K (`open-command-palette`), mas não lê o `nav-registry` |
| Central de avisos com tipos nomeados | `lib/ai/agent-inbox-copy.ts`, `/app/ai/inbox` | Notificações gerais (AH `/notificacoes`) e autorreparo do WhatsApp (AH `src/features/whatsapp-autorreparo`), sem uma central única de "o que precisa de gente" |
| Log de execuções da IA por turno | `app/app/ai/runs`, `traco-do-turno.ts` | Não há tela que responda "por que a Sasá ou a qualificação não respondeu" |
| Versões publicadas do agente com rollback | `agent-config.ts`, `ai_agent_versions` | O prompt da qualificação é editado no lugar (AH `/qualificacao`) |
| Guardas antes do envio (promessa, horário só com ferramenta, "registrei" só se gravou) | `guardrails/before-send.ts` | Há regras de janela e de silêncio (AH `src/features/ai-agent/silence-follow-up-rules.ts`), mas não uma cadeia de vetos |
| Teto de respostas por conversa (loop robô com robô) | `teto-de-respostas.ts` | Não encontrado |
| Radar de leads esfriando | `lib/leads/risk-radar.ts` | Há SLA de distribuição e recuperação (AH `src/features/lead-recovery`), mas nenhuma tela de "esfriando" por faixa |
| Planos de tarefa e tarefas com prazo | `lib/tarefas/plano.ts`, `/app/tasks` | Não há módulo de tarefas (só AH `/tarefas/dashboard`, marcada como tela morta) |
| Respostas rápidas na barra do composer | `lib/inbox/barra-de-respostas.ts` | Há biblioteca de mensagens (AH `src/features/message-library`), sem barra no composer |
| Atalhos de teclado na Inbox (j/k, a, e) | `InboxKeyboardShortcuts.tsx` | Não encontrado |
| Curso em imagens gerado das telas | `curso/` | Há tour narrado do corretor (AH `src/components/chat/tour/lite-tour.tsx`) e `/guia`. Os tours do diretor estão desligados (AH `src/components/onboarding/onboarding-provider.tsx`) |
| Webhooks de saída assinados e API com escopos | `call-webhook.ts`, `escopos-do-token.ts` | Há guia de webhook de entrada (AH `/guia/webhook`), sem API pública com tokens |
| Cobrança do revendedor | `lib/cobranca/` | AH `src/features/billing` vazio |
| Menu personalizável por empresa e por pessoa | `lib/navigation/interface.ts` | Cargos controlam acesso por rota (AH `src/features/custom-roles`), mas não escolhem o menu |
| Modo teste de canal novo (só testadores) | `elegibilidade/pre-go-live.ts` | Não encontrado para a IA de qualificação |
| Agenda com tipos, lembrete e Google | `lib/agenda/` | Agenda do corretor existe (AH `/agenda`), mais simples |

### 5.3 O que está melhor lá, e por quê
1. **Contadores no menu.** O diretor que passa o dia no sistema precisa saber onde há trabalho esperando sem abrir tela por tela. Lá o número da fila e dos casos está na própria entrada do menu, e some no zero.
2. **Operar antes de ajustar.** A sidebar deles vai de Atendimento a Análise e deixa Configurações fixa no rodapé. No AncoraHub, até hoje, Atendimento IA, Financeiro e Operação ERP moravam dentro de Configurações (AH `nav-registry.ts`, `NAV_GROUPS` antes desta branch). Com isso, coisas de uso diário, como Leads na qualificação e Recuperação, pareciam ajuste. Resolvido na seção 6.
3. **Hub em vez de 13 abas.** Uma fileira de 13 abas não cabe no celular nem se lê de relance. O hub agrupa por intenção ("Montar", "Ensinar", "Acompanhar") e descreve cada tela em uma linha.
4. **Uma fonte para tudo.** Lá o mesmo catálogo alimenta o ⌘K, então toda tela é achável digitando. Aqui o Ctrl+K e o menu são listas separadas.
5. **IA que explica a si mesma.** A central de avisos e as execuções transformam "o robô parou" em uma frase com causa e ação. Isso economiza o tempo do diretor e do suporte.
6. **Guardas que impedem mentira.** "Marquei para as 15h" só sai se a agenda devolveu 15h nesse turno. Numa corretora, prometer cobertura ou preço errado é risco real.
7. **Radar de esfriando.** Ele separa "crítico, em risco, em voo, em dia" sem o gestor montar filtro. O cálculo roda a cada 15 min e só muda quando a faixa muda.
8. **Teste de altura do menu.** O teste garante que a sidebar cabe sem rolagem em 1280×900, o que protege a densidade quando entra item novo.

### 5.4 O que o AncoraHub já faz melhor
1. **Distribuição e plantão.** Oferta exclusiva com aceite, SLA duplo com troca atômica, escala publicada, presença confirmada e filas por plantão (AH `docs/business-rules.md:38-88`). O DeskComm só tem manual, rodízio e carga.
2. **Experiência do corretor.** A Início em conversa, com assistentes, Sasá por voz e "Mais" agrupado (AH `src/components/chat/chat-home.tsx`, `src/features/sasa-voice`), é mais simples que a sidebar com hubs deles para quem atende no celular.
3. **Design e feedback.** O Lite tem tokens escopados, um CTA por tela e níveis de feedback com som e vibração só via `useFeedback` (AH `docs/design-system/FEEDBACK.md`). Lá não há padrão de feedback: são 247 arquivos chamando toast direto.
4. **Lista com gaveta.** O padrão `DataTable` com clique na linha abrindo `Sheet` (AH `CLAUDE.md`, "Densidade") é mais rápido que o deles, onde a linha não abre e editar é diálogo (89 arquivos).
5. **Abas sem ida ao servidor.** As abas `inPlace` trocam a visão só pela URL (AH `nav-registry.ts:33-36`).
6. **Domínio de corretora.** Catálogo de operadoras com perguntas e respostas (AH `src/features/operator-catalog`), cotação compartilhável, validador de comprovante, pós-venda com auditoria, comissões e ERP financeiro.
7. **Cargos com escopo.** Os escopos nenhum, próprio, unidade e empresa por capacidade (AH `src/features/custom-roles/catalog.ts`) são mais finos que os cinco papéis fixos deles.
8. **Laboratório de fluxos.** O AH `/dev/laboratorio` tem 22 fluxos reais com servidor simulado, para testar antes de publicar.

### 5.5 Lista priorizada do que trazer
Critério: o que poupa tempo de quem fica o dia todo no sistema, sem quebrar o Lite.

| # | O quê | Por quê | Esforço | Onde mexe no AH |
|---|---|---|---|---|
| 1 | Menu do diretor na ordem "operar antes de ajustar" | Atendimento IA e Financeiro saem de dentro de Configurações | Feito nesta branch | `nav-registry.ts` `NAV_GROUPS` |
| 2 | Contadores no menu: leads esperando aceite, conversas sem resposta, ofertas vencendo | Mostra onde agir sem abrir telas; some no zero | Baixo | campo `contador` no `NavTab`, render em `corretop-sidebar.tsx` |
| 3 | Ctrl+K lendo o `nav-registry` (áreas, abas, `fullLabel`) e busca sem acento | Toda tela achável digitando, uma fonte só | Baixo | paleta de comando, `visibleNavAreas` |
| 4 | Central de avisos do diretor ("precisa de gente"): canal caiu, oferta sem aceite, mensagem travada, IA sem saldo | Uma fila única com causa e ação, no padrão FEEDBACK | Médio | nova tabela e tela, reusar `whatsapp-autorreparo` e `notifications` |
| 5 | Execuções da qualificação: por turno, o que entrou, que regra barrou, que erro voltou | Responde "por que não respondeu" sem suporte | Médio | `src/features/ai-qualification`, aba em Atendimento IA |
| 6 | Guardas antes do envio da IA: horário e "registrei" só com ferramenta, teto por conversa, opt-out | Evita promessa falsa e loop robô com robô | Médio | `src/features/ai-agent`, `qualification-engine` |
| 7 | Radar de leads esfriando por faixa (crítico, em risco, em dia) | O gestor vê quem está esfriando sem filtro | Médio | `lead-recovery` e `leads`, tabela Lite |
| 8 | Hub de Atendimento IA no lugar das 13 abas: "Configurar", "Ensinar", "Acompanhar" | Cabe no celular e explica cada tela | Médio | página raiz de `/qualificacao` |
| 9 | Versões publicadas do prompt com voltar | Errou o prompt, volta num clique | Médio | schema da qualificação |
| 10 | Respostas rápidas na barra do composer e atalhos j/k na Conversas | Menos digitação para quem atende o dia todo | Baixo | `message-library`, tela de conversas |
| 11 | Curso em imagens gerado do laboratório (Ler e Simular) | Treina corretor novo sem vídeo; acompanha a versão | Alto | `/dev/laboratorio` como fonte das fotos |
| 12 | Modo teste de canal novo (só números de testadores) | Liga a IA num número novo sem risco | Baixo | `ai-qualification` |

Fica de fora por ora: cobrança de revendedor, extensões e banco externo. Não servem a uma corretora operando o próprio CRM.

---

## 6. Reorganização do modo diretor (feita nesta branch)

### 6.1 Regra
- Só regrupar áreas. Nomes, abas, rotas, ícones, permissões e visual ficam iguais (memória "Route reorg keeps design").
- Inspiração: a ordem do DeskComm, do que se opera para o que se ajusta, com Configurações só com ajustes.

### 6.2 Antes e depois (`NAV_GROUPS`, AH `src/shared/navigation/nav-registry.ts`)

| # | Antes (20/11) | Depois (25/11) |
|---|---|---|
| 1 | Início | Início |
| 2 | Conversas | Conversas |
| 3 | Leads: Leads, Distribuição, Marketing | Leads: Leads, Distribuição |
| 4 | Comercial | Comercial: Comercial, Financeiro, Operação ERP |
| 5 | Equipe | Crescimento: Atendimento IA, Marketing |
| 6 | Configurações: Configurações, Atendimento IA, Financeiro, Operação ERP | Equipe |
| 7 | | Configurações: só Configurações |

### 6.3 Por quê
- **Atendimento IA** tem Leads na qualificação, Recuperação e Simulador, que são uso diário. Em Configurações parecia ajuste.
- **Marketing** traz lead, mas é crescimento, não operação do lead. Junto da IA fica a parte "o que gera e aquece lead".
- **Crescimento** já era o nome da seção dessas duas áreas no registro (`section: "Crescimento"`). Não é nome novo.
- **Financeiro e Operação ERP** são dinheiro e venda. Ficam ao lado do Comercial, que já tem Comissões.
- **Configurações** passa a ter só ajustes (Ajustes, WhatsApp, Integrações, Cargos, Recuperações de acesso), como o rodapé do DeskComm.
- Quem só vê uma área do grupo (o cargo marketing, por exemplo) continua vendo o nome da própria área, porque o grupo de um item só mostra o nome do item (AH `corretop-sidebar.tsx:333`).

### 6.4 Teste
- O teste novo em AH `src/shared/navigation/nav-registry.test.ts` fixa a ordem dos grupos para o diretor.
- Ele também garante que cada área está em exatamente um grupo.
- A falha "shows the post-sale workspace only to directors" já existia antes desta mudança (conferida sem a alteração).

### 6.5 Próximos passos sugeridos
- Itens 2, 3 e 4 da lista priorizada.
- Corretor: nada muda. A Início em conversa já é melhor que a sidebar deles.
