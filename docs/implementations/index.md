# Índice de Implementações

| Data | Registro | Estado | Resumo |
| 2026-10-07 | `completed/2026-10-07-meta-campaign-routing-single-home.md` | type-check e build passaram | Captura e fila são configuradas no detalhe da campanha; anúncios/formulários herdam a fila ativa e intake sem rota é ignorado. |
| 2026-10-06 | `completed/2026-10-06-meta-sync-and-campaign-capture.md` | concluído no código | Reduzir falhas de sync Meta, separar veiculação de captura e herdar elegibilidade por campanha e seus descendentes. |
| --- | --- | --- | --- |
| 2026-10-06 | `completed/2026-10-06-pos-venda-transfer-bypass.md` | concluído no código | Isenção total da fila Pós Venda (complemento DEC-133): transferências manuais entre unidades e corretores com origem/destino na Pós Venda dispensam rota de campanha, disponibilidade, unidade ativa e estado de atendimento, com auditoria `lead.post_sale_transfer`. |
| 2026-10-05 | `completed/2026-10-05-corretor-multi-plantoes-simultaneos.md` | concluído no código | Corretor pode estar em 2+ plantões no mesmo horário (DEC-132): escala semanal e plano mensal avisam em vez de bloquear, com auditoria; distribuição mantém ocorrência representativa. |
| 2026-09-30 | `completed/2026-09-30-broker-lite-duty-calendar.md` | concluído no código | Área Plantões do corretor Lite com calendário mensal, agenda por data, detalhes somente leitura, escala semanal/publicada e controle global auditável. |
| 2026-09-30 | `completed/2026-09-30-cold-lead-reactivation.md` | concluído no código | Reativação única de lead frio ainda não atribuído, retomada da qualificação em resposta, aviso após atribuição e observação de investigação no drawer compartilhado. |
| 2026-09-21 | `active/2026-09-21-meta-control-consolidation-plan.md` | plano aprovado | Consolidar captura e fila da Meta em `/marketing/campanhas` (drawer por campanha/anúncio) e deixar `/integrations/meta` só com visualização, conexão e sincronização. |
| 2026-09-21 | `active/2026-09-21-distribuicao-redesign-plan.md` | em validação | Plano de redesign da Central de Distribuição (5 áreas, drawer lateral, kit `ds-*` com movimento) e Lote 0 do kit. |
| 2026-09-21 | `active/2026-09-21-dashboard-erp-composition.md` | em validação | Composição ERP premium do `/dashboard` com widgets shadcn reutilizáveis, gráficos, estados de carregamento e motion acessível. |
| 2026-09-21 | `active/2026-09-21-waha-lite-connection-flow.md` | em validação | Conexão WhatsApp Lite: QR renovado em tempo real, sessão nunca recriada ao abrir o diálogo, status por fases e verificação contínua com feedback visual. |
| 2026-09-22 | `active/2026-09-22-broker-bulk-recipient-visibility.md` | em validação | `/conversas?tab=corretores` lista membros ativos e convites pendentes mesmo sem histórico e revalida o lote no servidor. |
| 2026-09-22 | `active/2026-09-22-team-member-edit-persistence.md` | em validação | Edição de equipe atualiza perfil e membership, cobre convites pendentes e evita fallback inválido no campo de e-mail. |
| 2026-09-15 | `completed/2026-09-15-routing-rule-persistence-fix.md` | concluído | Migration idempotente da tabela `lead_routing_rules`, que faltava para salvar regras da Matriz de Roteamento. |
| 2026-09-18 | `active/2026-09-18-team-member-recreation.md` | em validação | Recriação de membro excluído com o mesmo e-mail reutiliza somente uma identidade global ativa sem vínculo no tenant. |
| 2026-09-15 | `completed/2026-09-15-distribution-surface-refinement.md` | concluído | Hierarquia visual, espaçamento, padding, textos e organização refinados na central `/distribuicao`, sem alterar regras de negócio. |
| 2026-09-17 | `active/2026-09-17-distribution-visual-redesign.md` | em validação | Redesign da composição de `/distribuicao`, com abas compactas, campanhas visíveis nos cards de filas e menos duplicação visual. |
| 2026-09-15 | `completed/2026-09-15-waha-qr-rotation-and-phone-reconciliation.md` | concluído | Rotação atômica do QR no WAHA e reconciliação de mensagens pelos 9 últimos dígitos para cobrir DDD divergente. |
| 2026-09-15 | `completed/2026-09-15-waha-dialog-and-dashboard-header.md` | concluído | Rotação automática do QR ao abrir o diálogo, ação explícita de invalidação/reinício e cabeçalho compartilhado no dashboard. |
| 2026-09-15 | `completed/2026-09-15-waha-qr-transient-failure-feedback.md` | concluído | Falhas transitórias do polling não interrompem o pareamento e erros de autenticação do WAHA ficam identificáveis. |
| 2026-09-15 | `completed/2026-09-15-unassigned-leads-and-distribution-surface.md` | concluído | Dataset e paginação independentes para Sem atribuição em `/leads`, pageSize sincronizado pela URL e cards de `/leads/distribuicao` padronizados. |
| 2026-09-15 | `completed/2026-09-15-waha-mobile-history-reconciliation.md` | concluído | Normalização de mensagens móveis, reconciliação autenticada de histórico e instruções do cron Coolify. |
| 2026-09-15 | `completed/2026-09-15-leads-pagination-navigation-performance.md` | concluído | Paginação atômica e troca instantânea das categorias locais em `/leads`, sem RSC duplicado. |
| 2026-09-14 | `completed/2026-09-14-coolify-separated-runtime.md` | concluído | Registro da produção atual no Coolify, com frontend e API em VPSs separadas e sem Vercel. |
| 2026-08-26 | `active/2026-08-26-vps-performance-local-first.md` | ativo | Telemetria segura, redução de refresh duplicado e scheduler VPS desligado por padrão, aguardando corte controlado da Vercel Cron. |
| 2026-08-19 | `completed/2026-08-19-dialogs-action-result-refresh.md` | concluído | Conexão do resultado de Server Actions à UI em dialogs (distribuição, feedback-templates, materiais, documentos, agent-triggers e automações): fim do F5 para refletir mudanças. |
| 2026-08-17 | `completed/2026-08-17-leads-mobile-responsiveness.md` | concluído | Refino da responsividade mobile de /leads: header com menu "Mais ações" abaixo de lg, abas com rolagem e rótulos curtos, lista mobile com seleção em lote, campanha e data, e filtros compactos. |
| 2026-08-13 | `completed/2026-08-13-confirmation-dialog-action-response.md` | concluído | Exclusão de lead redireciona a resposta da Server Action para a lista ativa, evitando diálogo pendente após a exclusão lógica. |
| 2026-07-28 | `completed/2026-07-28-engineering-harness.md` | concluído | Harness de engenharia, scripts diagnósticos e baseline auditado. |
| 2026-07-28 | `completed/2026-07-28-whatsapp-extension-native-panel.md` | concluído | Painel contextual nativo, visibilidade estrita por corretor/unidade e instalação guiada. |
| 2026-07-28 | `completed/2026-07-28-whatsapp-extension-session-and-sidebar-fallback.md` | concluído | Sessão visível no popup, desconexão e resolução segura do telefone no WhatsApp Web. |
| 2026-07-28 | `completed/2026-07-28-ancorahub-assistant-compose-menu.md` | concluído | Menu contextual no compositor, sugestões manuais e abertura confiável do lead no CRM. |
| 2026-07-29 | `completed/2026-07-29-mobile-live-leads.md` | concluído | Navegação móvel segura, atualização de fila sem F5 e correção de reatribuição. |
| 2026-07-29 | `completed/2026-07-29-operational-visual-standardization.md` | concluído | Fundação visual compacta para superfícies operacionais, tabela, cards e kanban de leads. |
| 2026-08-03 | `completed/2026-08-03-broker-workspace.md` | parcial | V1 do cockpit do Corretor, prioridade determinística, rollback global e fluxos operacionais reais. |
| 2026-10-05 | `completed/2026-10-05-plantao-drawer-falta-presencial.md` | concluído | Drawer da ocorrência, falta por corretor/data bloqueada antes do ranking e escala presencial pausada até confirmação do gestor. |
| 2026-10-07 | `completed/2026-10-07-meta-campaign-routing-single-home.md` | concluído | Campanha como fonte única da fila Meta, anúncios/formulários herdam a rota, conta de anúncios tem fila padrão e há reparo auditável de leads sem fila. |
