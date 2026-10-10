# Modo Lite do supervisor

> Pedido do Vinicios em 2026-10-10. Status: S0 (campo de equipe no modo diretor) implementado; o resto é plano.
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
