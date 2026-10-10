# Modo Lite do supervisor

> Pedido do Vinicios em 2026-10-10. Status: S0 e S1 em produção, 0189 aplicada (enum com "supervisor"), S2 escrito e em QA. Versão completa: §8 (plano de execução com o time).
> Decisão: **o supervisor só supervisiona.** Não recebe lead, não entra em plantão. Está um nível abaixo do gestor, pertence a uma unidade e acompanha um número limitado de corretores (até 30).

## 1. Como está hoje (levantamento de 2026-10-10)

- `tenant_memberships.supervisor_id` existe no banco, mas **nenhuma tela gravava**. Toda equipe de supervisor está vazia; relatórios e o painel por equipe saem zerados.
- O Lite só serve `role = broker` (layout, rotas, `getBrokerWorkspaceData`). O supervisor cai no modo normal.
- **Inconsistências de escopo:**
  - lista de leads e busca: o supervisor vê **a unidade inteira**;
  - relatórios: vê **só a equipe**;
  - página Equipe: vê **a empresa toda**;
  - metas: **todas**.
- O supervisor não pode reatribuir lead, não gerencia plantão, não recebe as notificações de "lead parado" (só diretor e gestor).
- `/equipe/[id]` bloqueia o supervisor, embora `canViewTeamMemberProfile` permita.

## 2. Princípios

1. **Mesmo Lite, outro elenco.** O app vira conversas com assistentes, só que os assistentes falam da equipe e não dos leads dele.
2. **Escopo único: a equipe dele.** Tudo o que ele vê ou mexe passa por `supervisor_id = eu`, resolvido no servidor. Nunca a unidade inteira por acidente.
3. **Ele orienta, o gestor decide o que é estrutural.**
   - O supervisor pode: chamar o corretor, cobrar, reconhecer, puxar lead parado para outro da equipe (com motivo), pausar quem saiu, ver plantões.
   - Só o gestor ou o diretor pode: criar usuário, mudar unidade, mudar cargo, mexer na escala.
4. **Tudo auditado** e com o mesmo vocabulário do corretor.

## 3. O Lite do supervisor

### 3.1 Início (lista de conversas, igual ao corretor)

| Assistente | O que faz |
|---|---|
| **Equipe** | Quem está online, em plantão, pausado ou ausente agora; quem precisa de atenção (lead parado, SLA estourando, sem etapa) |
| **Leads da equipe** | Leads parados por corretor, sem primeiro contato, sem etapa; ações: cobrar o corretor, repassar dentro da equipe |
| **Plantão da equipe** | Plantões de hoje da equipe: quem confirmou presença, quem faltou, quantos leads cada um recebeu (reusa `/plantoes/agora` por corretor) |
| **Desempenho** | Placar da equipe na semana: aceites, tempo para aceitar, atendimentos, conversão, ranking dentro da equipe (reusa `broker-stats`) |
| **Âncora** | Avisos da empresa (o mesmo de hoje) |
| **Relacionamento** | Atalho para a Central, já limitada à equipe dele (o público "Equipe" já existe) |

No computador, o centro mostra o **dia da equipe**:
- números: leads recebidos, aceitos, em atendimento, SLA em risco;
- cartões por corretor (avatar, status, leads ativos, último contato);
- "Quem precisa de você": os 3 casos mais urgentes.

### 3.2 Telas novas

- **`/equipe` (Lite):**
  - lista dos corretores dele com status ao vivo;
  - tocar em um abre a **ficha do corretor**: plantão, leads ativos, números da semana, ranking, histórico de feedbacks;
  - ações: chamar no WhatsApp, mandar recado, pausar ou retomar o recebimento, ver os leads dele.
- **Adicionar corretor à minha equipe:**
  - lista dos corretores **ativos da unidade dele sem supervisor**, com "Adicionar";
  - corretor que já tem outro supervisor: "pedir transferência", e o gestor aprova (fase S4);
  - criar corretor novo continua com o gestor.
- **Feedback 1 a 1:** nota rápida sobre o corretor ("orientei sobre tempo de resposta"), com histórico na ficha. Tabela nova: `supervisor_notes`.
- **Repassar lead dentro da equipe:**
  - lead parado de um corretor vai para outro da mesma equipe, com motivo obrigatório;
  - usa a ação de reatribuição existente, com uma permissão nova limitada à equipe.

### 3.3 Ferramentas de supervisão

- **Alertas para o supervisor:**
  - lead da equipe sem primeiro contato no SLA;
  - corretor da equipe ausente no plantão;
  - oferta expirada em sequência;
  - hoje esses avisos só vão para diretor e gestor.
- **Meta da equipe:** soma das metas dos corretores dele, com barra no Início. Usa `goals` com escopo `team`; o cálculo hoje é TODO em `goals-service.ts`.
- **Resumo diário automático** às 19h, na conversa Âncora do supervisor: o dia da equipe em 5 linhas.

## 4. Ajustes de escopo e permissão (base de tudo)

- `getSupervisedBrokerIds` como fonte única. Lead scope do supervisor: `corretorId in equipe`, não a unidade inteira (lista, busca, atenção).
- Página Equipe do supervisor: só a equipe. Hoje mostra a empresa toda.
- `/equipe/[id]`: liberar o supervisor para os corretores da equipe dele.
- Metas: o supervisor vê só as da equipe.
- Notificações de lead parado e de SLA: incluir o supervisor do corretor.
- Permissão nova `leads_reassign_team`: o supervisor repassa só dentro da equipe.

## 5. Fases

| Fase | Entrega | Pronto quando |
|---|---|---|
| **S0 (feito)** | Diretor/gestor escolhe os corretores do supervisor em "Editar membro" (até 30, mesma unidade, auditado; trocar de cargo desfaz a equipe) | O supervisor tem equipe gravada em `supervisor_id` |
| S1 | Escopo: leads, busca, Equipe e metas limitados à equipe; `/equipe/[id]` liberado para a equipe | O supervisor só enxerga a equipe dele em qualquer tela |
| S2 | Lite do supervisor: `getSupervisorWorkspaceData`, Início com os assistentes da §3.1, dia da equipe no centro, layout e rotas aceitando `role = supervisor` | O supervisor entra e vê o app no estilo Lite, voltado para a equipe |
| S3 | Ficha do corretor no Lite, adicionar corretor sem supervisor, feedback 1 a 1, repassar lead dentro da equipe | O supervisor orienta e age sem pedir ao gestor |
| S4 | Alertas para o supervisor, meta da equipe, resumo diário, pedido de transferência com aprovação do gestor | O supervisor é avisado antes de virar problema |

## 6. Riscos

- **Escopo:** hoje o supervisor vê leads da unidade inteira. A S1 restringe, e alguém pode reclamar que "sumiu lead". Avisar os supervisores antes do deploy.
- **Repassar lead:** pode virar disputa. Exigir motivo e manter na auditoria. O gestor vê tudo.
- **Equipe vazia:** até o diretor preencher a S0, o Lite do supervisor mostra o estado vazio "peça ao gestor para montar sua equipe".

## 7. Revisão do Vigia (T37, 2026-10-10)

- **S0 aprovado.** O vínculo nunca fica velho:
  - corretor que muda de unidade ou deixa de ser corretor sai da equipe;
  - membro desativado (individual ou em massa) ou excluído sai de qualquer equipe, e um supervisor desativado tem a equipe desfeita;
  - "pegar" um corretor de outro supervisor também fica na auditoria do supervisor antigo.
- **S1** entra atrás de flag e com aviso aos supervisores ("lead some" da lista). Equipe vazia = tela vazia, **nunca** volta a mostrar a unidade inteira.
- **Repassar lead (S3)** passa pela reatribuição existente (eventos, ciclo de vida, fila), nunca por update direto.
- **Distribuição e plantão já excluem `role = supervisor`** (confirmado no levantamento: todas as consultas filtram `role = broker`), coerente com "só supervisiona".
- `supervisor_notes` com `tenant_id`, migração aplicada antes do deploy. O resumo das 19h entra em `docs/runbooks/coolify-scheduled-tasks.md`.


## 8. Versão completa: plano de execução (2026-10-10)

> Pedido do Vinicios: "faça completamente a versão de supervisor e planeje melhor". Cada pacote tem dono, entrega e critério de pronto. Execução com o time do Maestri: **Cinzel** executa e faz QA, o **Maestro** (Claude) executa e integra, o **Vigia** revisa cada pacote antes do commit. Tudo atrás das chaves `feature_supervisor_team_scope_enabled` e `feature_supervisor_lite_enabled`.

### 8.1 Mapa da experiência completa

Início do supervisor, em conversas:

| Conversa | Pergunta que responde | Ações |
|---|---|---|
| **Equipe** | Quem está disponível, quem precisa de mim? | Abrir a ficha do corretor, mandar recado, adicionar corretor |
| **Leads da equipe** | O que está parado e de quem? | Abrir o lead, cobrar o corretor, repassar dentro da equipe |
| **Plantão da equipe** | Quem está de plantão hoje, quem confirmou, quem faltou? | Ver o plantão do corretor, cobrar a confirmação |
| **Desempenho da equipe** | Como a equipe está na semana? | Reconhecer, ver a ficha |
| **Âncora** | O que a empresa avisou? E o resumo do dia da equipe às 19h | Ciente |

Telas:
- **Ficha do corretor (Lite):**
  - status e números da semana;
  - posição dentro da equipe, leads ativos e plantões;
  - feedbacks 1 a 1;
  - ações: WhatsApp, recado, pausar ou retomar, repassar lead.
- **Minha equipe:** lista com status ao vivo e a seção "Corretores da unidade sem supervisor" com "Adicionar".

### 8.2 Pacotes

| # | Pacote | Dono | Banco | Pronto quando |
|---|---|---|---|---|
| S2 | Lite do supervisor (Início, Equipe, Leads da equipe, Desempenho, rail, menu Mais, rotas) | Maestro (feito) + Cinzel (QA) | - | Supervisor entra no Lite e vê só a equipe |
| P1 | Ficha do corretor no Lite (`/equipe/[id]` com audiência supervisor): cabeçalho, números da semana, posição na equipe, leads ativos com link, botões WhatsApp e Recado | Cinzel | - | Da conversa Equipe, tocar no corretor abre a ficha Lite |
| P2 | Adicionar corretor à minha equipe: lista "sem supervisor" da unidade + ação `addBrokerToMyTeam` (só supervisor, mesma unidade, sem supervisor, até 30, auditado) | Maestro | - | Supervisor adiciona um corretor livre da unidade em 1 toque |
| P3 | Feedback 1 a 1: tabela `supervisor_notes` (tenant_id, supervisor_id, broker_id, kind orientação/elogio/alerta, texto, criado em), registrar e listar na ficha; gestor e diretor também veem no perfil | Cinzel | 0190 | Nota registrada aparece na ficha e no perfil do diretor |
| P4 | Repassar lead parado dentro da equipe: permissão nova `leads_reassign_team`, motivo obrigatório, **usando a reatribuição existente** (eventos, ciclo de vida, fila); só para corretor da mesma equipe | Maestro | - | Lead atrasado vai para outro da equipe com motivo na auditoria |
| P5 | Plantão da equipe: conversa com quem está escalado hoje, presença confirmada ou pendente e faltas (lê a escala, nunca edita) | Cinzel | - | Supervisor vê o plantão de hoje da equipe |
| P6 | Alertas para o supervisor: lead da equipe sem contato no SLA, falta no plantão e oferta expirada em sequência vão também para o supervisor do corretor (Âncora + push) | Maestro | - | Supervisor recebe o alerta junto com o gestor |
| P7 | Resumo das 19h: cron `/api/internal/jobs/supervisor-digest` manda ao supervisor o dia da equipe em 5 linhas (na Âncora); entra no runbook do Coolify | Cinzel | - | Às 19h chega o resumo |
| P8 | Meta da equipe: metas com escopo `team` e `scopeId` = supervisor, progresso = soma dos corretores (resolve o TODO de `goals-service.ts`), barra no Início | Maestro | - | Meta da equipe com progresso real |
| P9 | Pedido de transferência: supervisor pede um corretor de outra equipe e o gestor aprova ou recusa (tabela `supervisor_transfer_requests`, notificação ao gestor) | Maestro | 0191 | Transferência só acontece com aprovação |

**Execução P3 (2026-10-10):** implementados tabela/schema e migration 0190, actions de escrita/leitura com escopo tenant/equipe/unidade e auditoria sem conteúdo, formulário e histórico na ficha Lite, além do cartão somente leitura para Diretor/Gestor. Testes focados (8), ESLint e TypeScript passaram. A migration não foi aplicada nesta tarefa. `npm run build` falha antes da compilação por `node_modules` symlink fora da raiz do Turbopack; entrega local mantida como parcial até a aplicação e validação de build.

**Execucao P9 (2026-10-10):** migration 0191 e schema para pedidos pendentes unicos por corretor, script com simulacao padrao, actions tenant-scoped para solicitar/listar/decidir, auditoria transacional, notificacoes governadas pela capability `supervisor_transfer`, limite de 30 e troca condicional de equipe na aprovacao. O Lite ganhou `/equipe/transferencia`; a gestao decide em `/equipe`. Testes focados (10), ESLint focado e TypeScript passaram. A suite completa apontou 6 falhas fora do P9 apos corrigir a expectativa antiga da rota; o lint global aponta 993 ocorrencias de encoding em 2 arquivos. O build para antes da compilacao porque o symlink de node_modules aponta para fora da raiz do worktree. A migration nao foi aplicada. Evidencia: reports/agent/verification/2026-10-10-lite-supervisor-p9.md.

### 8.3 Ordem e paralelismo

1. **Fechar o S2:** QA do Cinzel, revisão do Vigia, commit.
2. **Em paralelo, sem tocar os mesmos arquivos:**
   - **Cinzel:** P1 (ficha) → P3 (feedback) → P5 (plantão) → P7 (resumo);
   - **Maestro:** P2 (adicionar) → P4 (repassar) → P6 (alertas) → P8 (meta) → P9 (transferência).
3. **Cada pacote:** testes, Vigia, commit, e banco aplicado por script (simulação, depois `--apply`) antes do deploy.
4. **Pronto da versão completa:** um supervisor entra no Lite, vê só a equipe, recebe alertas e o resumo, age (recado, repassar, pausar, feedback, adicionar) e o gestor acompanha tudo na auditoria.

### 8.4 Riscos e regras

- **Repassar lead:** sempre pela reatribuição existente, nunca por update direto (Vigia T37).
- **Pausar corretor:** só o recebimento (disponibilidade), registrado na auditoria. Mexer na escala continua com o gestor.
- **Alertas:** respeitam horário e limite dos avisos da equipe (DEC-125), sem duplicar para quem já recebe.
- **Banco:** toda tabela nova com `tenant_id`, e a migração é aplicada antes do deploy, por script.

## 9. P10: Minha equipe (perfil, membros e convites) (2026-10-10)

Pedido do Vinicios: o supervisor cria a própria equipe, convida corretores da unidade dele e tem uma área de equipe onde vê os membros e edita o perfil completo da equipe (nome, imagem, descrição).

**Modelo (migração 0192, script `scripts/apply-0192-supervisor-teams.mjs`, simula por padrão, `--apply` grava):**
- `supervisor_teams`: `id`, `tenant_id`, `supervisor_id` (único por tenant), `branch_id`, `name` (2 a 60), `description` (até 280), `image_url` (data URL `image/png|jpeg|webp`, até 200 KB, sem SVG), `created_at`, `updated_at`. FK `branches(id, tenant_id)`.
- `supervisor_team_invites`: `id`, `tenant_id`, `branch_id`, `supervisor_id`, `broker_id`, `status` (`pending|accepted|declined|cancelled`), `message` (até 280, opcional), `created_at`, `decided_at`. Índice único parcial: um convite `pending` por (tenant, supervisor, broker).
- A ligação corretor ↔ supervisor continua sendo `tenant_memberships.supervisor_id` (fonte única). A equipe é só o perfil.

**Regras (BR-079):**
- Só supervisor com `supervisorTeamScope` e unidade. Convida apenas corretor ativo da mesma unidade e sem supervisor. Corretor de outra equipe: botão leva ao pedido de transferência (P9), não a convite.
- Corretor aceita ou recusa. Ao aceitar: transação com `FOR UPDATE` na linha do supervisor, confere teto de 30, e o `UPDATE` exige `supervisor_id IS NULL`, mesma unidade e ativo (mesma regra do `addBrokerToMyTeamAction`). Se não estiver mais livre, o convite vira `cancelled` com mensagem clara.
- O "Adicionar" direto do P2 continua dispon?vel ao supervisor, inclusive na escolha do chat, e atribui o corretor livre sem exigir aceite. Na tela `/equipe/minha`, corretores livres t?m as op??es "Adicionar" (direto) e "Convidar" (com aceite do corretor). `addBrokerToMyTeamAction` permanece para o fluxo direto; convites usam a??es pr?prias.
- Supervisor pode cancelar convite pendente e remover corretor da equipe (volta a livre; auditoria).
- Notificação ao corretor: `publishNotification` capability `supervisor_team_invite`, título "Convite para a equipe <nome>", pushBody sem nomes. Aceitar/recusar no Lite do corretor (conversa Âncora ou /notificacoes) via ações de chat `team.acceptInvite` e `team.declineInvite`. Supervisor recebe aviso do aceite/recusa.
- Auditoria em `audit_logs` para criar/editar equipe, convidar, cancelar, aceitar, recusar, remover.

**Telas (Lite do supervisor, fundo branco, tokens do Lite, sem travessão):**
- Rota `/equipe/minha` (entra em `LIGHT_SUPERVISOR_ALLOWED_ROUTES`): cabeçalho com imagem, nome e descrição da equipe e botão "Editar perfil" (formulário com upload de imagem redimensionada no navegador para 256x256 webp, nome, descrição). Sem equipe criada: estado vazio "Crie sua equipe" com o mesmo formulário.
- Abaixo: "Membros" (lista com foto/nome, link para `/equipe/<id>`, a??o "Remover da equipe" com confirma??o), "Convites pendentes" (cancelar), "Corretores da sua unidade" (livres: "Adicionar" direto ou "Convidar" com aceite; em outra equipe: "Pedir transfer?ncia").
- Entradas: conversa "Equipe" ganha a escolha "Minha equipe"; tela inicial do supervisor com 0 corretores mostra "Monte sua equipe"; menu Mais ganha "Minha equipe". Nome e imagem da equipe aparecem no cabeçalho da conversa Equipe.
- Corretor vê no perfil dele o nome e a imagem da equipe a que pertence (se houver).

**Pronto quando:** supervisor cria a equipe com nome, imagem e descrição; convida um corretor livre da unidade; o corretor aceita pelo Lite e aparece em Membros; tsc, testes focados e lint de encoding passam.

## 10. P11: tudo do supervisor no estilo novo do Lite (2026-10-10)

Pedido do Vinicios: nenhuma tela do supervisor pode reaproveitar o visual do modo normal. Todas refeitas no estilo novo do Lite (o mesmo do corretor: fundo branco, `arc-venancor`, tokens `--surface`, `--surface-muted`, `--chat-action`, `--radius-panel`, tipografia e espaçamentos do chat, motion/react com reduced motion, sem eyebrow, sem caixa alta, sem travessão, sem tabela de admin). Referências visuais: `light-settings`, `light-leads-list`, `light-lead-detail`, `light-notifications`, `duty-now-view`, `supervisor-broker-profile`, `chat-home`.

**Telas (supervisor com Lite ativo; o modo normal do diretor/gestor não muda):**
1. **Área de equipe** `/equipe/minha` refeita: topo tipo perfil (foto grande da equipe, nome, descrição, contadores: corretores, em atendimento, atrasados), abas em segmented control: Membros (cartões com avatar, status de disponibilidade, números do dia, toque abre o perfil), Convites (pendentes com cancelar), Unidade (livres com Adicionar e Convidar; em outra equipe com Pedir transferência). Estado vazio caprichado ("Monte sua equipe").
2. **Configuração da equipe** nova rota `/equipe/minha/configurar`: tela de ajustes no estilo `light-settings` com prévia ao vivo do cartão da equipe, troca de foto (escolher, prévia redonda, remover), nome, descrição com contador, salvar com estado no próprio botão. Sai do formulário embutido da página.
3. **`/equipe`** para o supervisor no Lite: redireciona para `/equipe/minha` (uma área de equipe só).
4. **Perfil do supervisor** (o "eu" do Lite, `home-me`): tela `/settings` no estilo `LightSettings` para o supervisor: foto e nome dele, unidade, equipe que lidera (atalho para configurar), notificações (push), tour de novo, sair. Sem WhatsApp pessoal e sem disponibilidade (ele não atende).
5. **Leads da equipe** `/leads` e **detalhe** `/leads/[id]`: versões Lite usando `LightLeadsList` e `LightLeadDetail` (ou variantes) com escopo da equipe: cada item mostra o corretor dono; no detalhe o supervisor vê a linha do tempo e tem as ações dele (Repassar dentro da equipe, Cobrar corretor via relacionamento), sem Aceitar/Recusar.
6. **Clientes da equipe** `/clientes`: `LightClientsList` com o corretor de cada cliente.
7. **Repassar lead** `/equipe/repassar` e **Pedir transferência** `/equipe/transferencia`: formulários no estilo Lite (lista de escolha em cartões, motivo, botão com estado), sem `DashboardHeader`.
8. **Relacionamento** `/relacionamento` para o supervisor no Lite: casca Lite (sem `DashboardHeader`), mesma funcionalidade.
9. **Perfil do corretor** `/equipe/[id]` (já Lite): alinhar com o novo topo da área de equipe (foto, números, notas privadas).

**Regras:** só visual e composição; escopo e permissões continuam no servidor (inSupervisorTeam, AuthorizationService). Rotas novas entram em `LIGHT_SUPERVISOR_ALLOWED_ROUTES` (regex exata) com teste. Cada tela com estados vazio, carregando e erro, 390px e desktop em tela dividida (rail à esquerda).

**Pronto quando:** logado como supervisor no Lite, nenhuma rota do menu, das conversas ou do Mais abre visual do modo normal; tsc, testes focados e lint passam.

### 10.1 Adendo do P11: completo e diferenciado (pedido do Vinicios, 2026-10-10)

Não é só trocar a casca: cada tela tem que parecer feita para o supervisor, com dados vivos e uma interação marcante.

**Leads da equipe (`/leads`, supervisor):** um "radar da equipe".
- Topo: mini funil da equipe em uma linha (Novos, 1º contato, Em atendimento, Cotação, Fechando) com contagem; tocar filtra.
- Fila de avatares dos corretores da equipe (chips com foto e número de leads abertos, anel vermelho se tem atrasado); tocar filtra por corretor, tocar de novo limpa.
- Lista agrupada por urgência: Atrasados (sem 1º contato além do SLA), Aguardando 1º contato, Em atendimento, Parados há 3+ dias. Cada cartão: nome do lead, operadora/produto se houver, avatar e primeiro nome do corretor, etapa, e um anel de tempo do SLA (cheio = no prazo, vermelho = estourado) com "há 2 h".
- Ações rápidas no cartão (sem abrir): Repassar (vai para `/equipe/repassar?lead=`), Cobrar (recado ao corretor pela Central de relacionamento, já preenchido com o lead).
- Busca por nome ou telefone no topo. Estados: vazio comemorativo ("Nenhum lead parado na equipe"), carregando com esqueleto do mesmo formato.

**Detalhe do lead (`/leads/[id]`, supervisor):** mesmo `LightLeadDetail` com faixa do corretor dono no topo (avatar, nome, "com ele há 3 dias"), linha do tempo completa, e barra de ações do supervisor: Repassar, Cobrar corretor, Ver corretor. Sem Aceitar/Recusar/registrar contato.

**Perfil do membro (`/equipe/[id]`, supervisor):** uma ficha de jogador.
- Topo: foto grande com anel de status (disponível, em plantão, pausado, ausente), nome, há quanto tempo na equipe, posição no ranking da equipe ("2º da equipe em aceites nesta semana").
- Faixa "Hoje": recebidos, aceitos, em atendimento, atrasados (o atrasado em destaque se > 0).
- "Semana": gráfico pequeno de 7 dias de aceites (barras), tempo mediano para aceitar comparado à média da equipe ("2 min mais rápido que a equipe"), taxa de 1º contato no prazo.
- Funil pessoal por etapa com barras horizontais.
- Leads que precisam de atenção agora (os atrasados dele) com Repassar em um toque.
- Notas privadas do supervisor como uma conversa (balões com data), campo para nova nota no rodapé.
- Ações: Mandar recado, Reconhecer (Central de relacionamento), Repassar leads parados, Remover da equipe (confirmação).

**Área de equipe (`/equipe/minha`):** o cartão de cada membro mostra avatar com anel de status, números do dia e um indicador de "precisa de você" quando tem atrasado; ordenação padrão: quem precisa de atenção primeiro.

Dados: reaproveitar `getSupervisorWorkspaceData`, `getTeamOfferStats`, `getMemberOfferRanking` e consultas com `inSupervisorTeam`; consultas novas só leitura e por tenant. Datas sempre via operador drizzle ou ISO com `::timestamptz` (nunca Date cru dentro de `sql`).
