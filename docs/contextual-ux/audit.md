# Auditoria de Contextual UX — Âncora CRM (AncoraHub)

Este documento registra a auditoria completa de rotas, perfis, estados e necessidades de orientação contextual do sistema.

---

## Rotas Mapeadas

### 1. Ficha do Lead 360º (`/leads/[id]`)
- **Perfil**: Corretor / Gestor / Diretor
- **Objetivo**: Acompanhar e evoluir a negociação com o cliente do início ao fechamento.
- **Estados Possíveis**:
  - `new` / `distributed`: Lead novo aguardando atendimento.
  - `in_contact`: Em atendimento, qualificação por IA em andamento ou manual.
  - `quote_sent`: Cotação enviada, aguardando retorno.
  - `negotiation`: Em negociação de plano/valores.
  - `documentation_pending`: Documentos solicitados ao cliente.
  - `under_analysis`: Documentos enviados, aguardando análise.
  - `converted`: Venda realizada.
  - `lost`: Lead perdido (com motivo registrado).
- **Próxima Ação Ideal**:
  - `new` / `distributed` → Iniciar atendimento / Realizar 1º contato
  - `in_contact` + qualificação concluída sem cotação → Criar Cotação
  - `quote_sent` → Agendar retorno / Follow-up
  - `documentation_pending` → Revisar/Solicitar documentos
  - `under_analysis` → Avançar para Fechamento de Venda
- **Ações Secundárias**: Agendar Tarefa, Registrar Observação, Abrir WhatsApp/Conversa, Simular Cotação.
- **Informações Necessárias**: Status atual, SLA restante, pontuação de qualificação, última interação, cotações ativas, quantidade de documentos pendentes.
- **Problemas Anteriores**: Botões de ação soltos na tela sem clareza de qual o próximo passo lógico.
- **Sugestão de UX**: Card destacado "Próxima Ação" no topo da ficha com o botão primário correto, explicação do motivo e dropdown de ações secundárias.

---

### 2. Central de Leads / Fila (`/leads` & `/minha-fila`)
- **Perfil**: Corretor / Gestor
- **Objetivo**: Visualizar, filtrar e priorizar leads atribuídos ou da corretora.
- **Estados Possíveis**: Filtros por status, temperatura (quente/morno/frio), responsável e unidade.
- **Próxima Ação Ideal**: Identificar na lista quais leads exigem ação imediata (SLA crítico ou retorno vencido).
- **Ações Secundárias**: Atribuição em massa, mudança de status em lote, busca por telefone/nome.
- **Sugestão de UX**: Incluir pill/badge "Próxima Ação" em cada linha da tabela com tooltip explicativo.

---

### 3. Central de Conversas (`/conversas`)
- **Perfil**: Corretor / Supervisor
- **Objetivo**: Interagir via WhatsApp com leads e clientes em tempo real.
- **Estados Possíveis**: Conversa ativa com IA, conversa assumida por humano, aguardando resposta do cliente.
- **Próxima Ação Ideal**: Se o robô pediu intervenção humana → Assumir conversa. Se a qualificação concluiu → Criar cotação direta da conversa.
- **Sugestão de UX**: Painel lateral fixo sugerindo o próximo passo da negociação direto no chat.

---

### 4. Dashboard do Corretor (`/corretor/resumo` / `/dashboard`)
- **Perfil**: Corretor
- **Objetivo**: Entender as prioridades do dia e atender os leads na ordem correta.
- **Estados Possíveis**: Leads pendentes no plantão, tarefas do dia, SLAs em risco.
- **Próxima Ação Ideal**: Lista orientada por prioridade (SLA em risco > Retorno vencido > Cotação pendente).
- **Sugestão de UX**: Bloco de "Próximas Ações" ordenadas por urgência em vez de apenas quadros estatísticos estáticos.

---

### 5. Dashboard do Gestor (`/gestor` / `/dashboard`)
- **Perfil**: Gestor / Supervisor
- **Objetivo**: Garantir que nenhum lead fique estagnado e que a equipe cumpra os SLAs.
- **Próxima Ação Ideal**:
  - Leads sem atendimento > 15 min → Redistribuir lead.
  - Documentos aguardando aprovação → Aprovar cadastros.
- **Sugestão de UX**: Cards de recomendação de gestão (Capacidade da equipe, Alertas de SLA, Gargalos de qualificação).

---

### 6. Dashboard do Diretor (`/diretor/resume`)
- **Perfil**: Diretor
- **Objetivo**: Visão estratégica de resultados, conversão por filial e custos de qualificação.
- **Próxima Ação Ideal**:
  - Queda de conversão na unidade → Analisar desempenho da filial.
  - Taxa de abandono de IA elevada → Ajustar parâmetros de qualificação.
- **Sugestão de UX**: Recomendações executivas orientadas a métricas de ROI e capacidade de unidades.
