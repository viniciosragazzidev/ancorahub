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
