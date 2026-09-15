# Índice de Implementações

| Data | Registro | Estado | Resumo |
| --- | --- | --- | --- |
| 2026-09-15 | `completed/2026-09-15-routing-rule-persistence-fix.md` | concluído | Migration idempotente da tabela `lead_routing_rules`, que faltava para salvar regras da Matriz de Roteamento. |
| 2026-09-15 | `completed/2026-09-15-distribution-surface-refinement.md` | concluído | Hierarquia visual, espaçamento, padding, textos e organização refinados na central `/distribuicao`, sem alterar regras de negócio. |
| 2026-09-15 | `completed/2026-09-15-waha-qr-rotation-and-phone-reconciliation.md` | concluído | Rotação atômica do QR no WAHA e reconciliação de mensagens pelos 9 últimos dígitos para cobrir DDD divergente. |
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
