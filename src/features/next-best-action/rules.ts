import type { LeadActionContext, NextBestAction, DashboardActionContext } from "./types";

/** Regras determinísticas para contexto de Lead 360º e fila */
export function evaluateLeadRules(ctx: LeadActionContext): NextBestAction | null {
  const leadId = ctx.id;
  const leadHref = `/leads/${leadId}`;

  // 1. SLA Crítico / Prestes a estourar
  if (ctx.hasSlaBreach || (ctx.slaMinutesRemaining !== null && ctx.slaMinutesRemaining !== undefined && ctx.slaMinutesRemaining <= 5)) {
    return {
      key: `critical-sla-${leadId}`,
      title: "Atendimento com SLA Crítico",
      description: "Este lead está prestes a estourar o tempo limite de atendimento.",
      priority: "critical",
      actionType: "start_conversation",
      label: "Iniciar Atendimento Agora",
      href: leadHref,
      iconName: "Zap",
      reason: "SLA de atendimento no limite ou estourado.",
      ruleId: "lead_critical_sla",
      entityType: "lead",
      entityId: leadId,
      permission: "alterar_status_lead",
      secondaryActions: [
        {
          key: `reassign-${leadId}`,
          title: "Redistribuir Lead",
          priority: "high",
          actionType: "navigate",
          label: "Redistribuir",
          href: `/leads/distribuicao`,
          reason: "Encaminhar para outro corretor do plantão.",
          ruleId: "lead_reassign_action",
          entityType: "lead",
          entityId: leadId,
          permission: "leads_reassign",
        },
      ],
    };
  }

  // 2. IA pediu intervenção humana
  if (ctx.humanInterventionRequested) {
    return {
      key: `human-requested-${leadId}`,
      title: "Qualificação IA Solicitou Atendente",
      description: "O robô de qualificação identificou uma pergunta complexa e pediu auxílio humano.",
      priority: "high",
      actionType: "start_conversation",
      label: "Assumir Conversa no WhatsApp",
      href: `/conversas`,
      iconName: "ChatCircleText",
      reason: "Lead pediu suporte humano durante triagem da IA.",
      ruleId: "qualification_requested_human",
      entityType: "lead",
      entityId: leadId,
      permission: "acessar_conversas",
    };
  }

  // 3. Novo / Distribuído sem primeiro contato
  if (ctx.status === "new" || ctx.status === "distributed" || !ctx.firstContactCompleted) {
    return {
      key: `first-contact-${leadId}`,
      title: "Realizar Primeiro Contato",
      description: "Lead aguardando recepção para início de contato comercial.",
      priority: "high",
      actionType: "start_conversation",
      label: "Atender Lead",
      href: leadHref,
      iconName: "UserCheck",
      reason: "Primeiro contato comercial ainda não registrado.",
      ruleId: "lead_no_first_contact",
      entityType: "lead",
      entityId: leadId,
      permission: "acessar_leads",
      secondaryActions: [
        {
          key: `qualify-manual-${leadId}`,
          title: "Iniciar Qualificação Manual",
          priority: "normal",
          actionType: "navigate",
          label: "Qualificar",
          href: leadHref,
          reason: "Preencher dados de perfil manualmente.",
          ruleId: "manual_qualify",
          entityType: "lead",
          entityId: leadId,
          permission: "acessar_leads",
        },
      ],
    };
  }

  // 4. Documentação pendente de solicitação / envio (quando no estágio de docs)
  if (ctx.status === "documentation_pending" || (ctx.documentsPendingCount && ctx.documentsPendingCount > 0)) {
    return {
      key: `request-docs-${leadId}`,
      title: "Solicitar Documentação ao Cliente",
      description: `Faltam ${ctx.documentsPendingCount ?? 1} documento(s) para validação cadastral da proposta.`,
      priority: "high",
      actionType: "navigate",
      label: "Anexar / Solicitar Documentos",
      href: leadHref,
      iconName: "FileText",
      reason: "Documentação do titular/beneficiário pendente.",
      ruleId: "documents_pending_request",
      entityType: "document",
      entityId: leadId,
      permission: "acessar_documentos",
    };
  }

  // 5. Documentos enviados aguardando análise
  if (ctx.status === "under_analysis") {
    return {
      key: `review-docs-${leadId}`,
      title: "Revisar Documentação Enviada",
      description: "Documentos anexados pelo cliente aguardando aprovação cadastral.",
      priority: "high",
      actionType: "navigate",
      label: "Revisar Documentos",
      href: `/documentos`,
      iconName: "ShieldCheck",
      reason: "Documentos na esteira de aprovação.",
      ruleId: "documents_under_review",
      entityType: "document",
      entityId: leadId,
      permission: "aprovar_documentos",
    };
  }

  // 6. Documentos aprovados -> Avançar para fechamento de venda
  if (ctx.documentsApprovedCount && ctx.totalDocumentsRequired && ctx.documentsApprovedCount >= ctx.totalDocumentsRequired && !ctx.hasCompletedSale) {
    return {
      key: `close-sale-${leadId}`,
      title: "Avançar para Fechamento de Venda",
      description: "Toda a documentação foi aprovada. Registre o contrato formalizado.",
      priority: "high",
      actionType: "navigate",
      label: "Registrar Venda",
      href: leadHref,
      iconName: "CheckCircle",
      reason: "Esteira completa pronta para conversão.",
      ruleId: "documents_approved_ready_sale",
      entityType: "sale",
      entityId: leadId,
      permission: "acessar_vendas",
    };
  }

  // 7. Qualificação concluída, sem cotação
  if ((ctx.qualificationStatus === "completed" || ctx.status === "in_contact") && !ctx.hasActiveQuote) {
    return {
      key: `create-quote-${leadId}`,
      title: "Criar Cotação de Saúde",
      description: "A qualificação foi concluída e os dados de perfil estão prontos para simulação.",
      priority: "high",
      actionType: "navigate",
      label: "Criar Cotação",
      href: `/cotacao`,
      iconName: "SlidersHorizontal",
      reason: "Qualificação pronta sem cotação gerada.",
      ruleId: "qualification_completed_no_quote",
      entityType: "quote",
      entityId: leadId,
      permission: "acessar_cotacoes",
      secondaryActions: [
        {
          key: `schedule-followup-${leadId}`,
          title: "Agendar Retorno",
          priority: "normal",
          actionType: "open_modal",
          label: "Agendar Retorno",
          reason: "Combinar horário de contato posterior.",
          ruleId: "schedule_followup",
          entityType: "task",
          entityId: leadId,
          permission: "acessar_tarefas",
        },
      ],
    };
  }

  // 8. Cotação criada, mas não enviada
  if (ctx.hasActiveQuote && !ctx.hasSentQuote) {
    return {
      key: `send-quote-${leadId}`,
      title: "Enviar Cotação ao Cliente",
      description: "Cotação gerada com sucesso. Envie a proposta em PDF para o cliente via WhatsApp.",
      priority: "high",
      actionType: "start_conversation",
      label: "Enviar Cotação por WhatsApp",
      href: `/conversas`,
      iconName: "Send",
      reason: "Cotação elaborada ainda não apresentada.",
      ruleId: "quote_generated_not_sent",
      entityType: "quote",
      entityId: leadId,
      permission: "acessar_cotacoes",
    };
  }

  // 9. Retorno agendado vencido
  if (ctx.followUpOverdue) {
    return {
      key: `followup-overdue-${leadId}`,
      title: "Retorno Comercial Vencido",
      description: "O prazo combinado para retorno com o cliente já expirou.",
      priority: "high",
      actionType: "start_conversation",
      label: "Cobrar Resposta do Cliente",
      href: `/conversas`,
      iconName: "Clock",
      reason: "Retorno comercial com data excedida.",
      ruleId: "followup_overdue",
      entityType: "task",
      entityId: leadId,
      permission: "acessar_tarefas",
    };
  }

  // 10. Cotação enviada sem retorno agendado
  if (ctx.hasSentQuote && !ctx.hasFollowUpScheduled) {
    return {
      key: `schedule-return-${leadId}`,
      title: "Agendar Follow-Up Comercial",
      description: "Proposta enviada. Defina uma data de retorno para cobrar a decisão do cliente.",
      priority: "normal",
      actionType: "open_modal",
      label: "Agendar Data de Retorno",
      href: leadHref,
      iconName: "Calendar",
      reason: "Cotação enviada sem tarefa de acompanhamento.",
      ruleId: "quote_sent_no_followup",
      entityType: "task",
      entityId: leadId,
      permission: "acessar_tarefas",
    };
  }

  // 11. Venda concluída -> Pós-venda
  if (ctx.hasCompletedSale || ctx.status === "converted") {
    return {
      key: `post-sale-${leadId}`,
      title: "Acompanhar Pós-Venda e Vigência",
      description: "Venda formalizada. Acompanhe a emissão e repasse de comissões.",
      priority: "low",
      actionType: "navigate",
      label: "Ver Detalhes da Venda",
      href: `/vendas`,
      iconName: "CurrencyCircleDollar",
      reason: "Contrato emitido e ativo.",
      ruleId: "sale_completed_post_sale",
      entityType: "sale",
      entityId: leadId,
      permission: "acessar_vendas",
    };
  }

  return null;
}

/** Regras determinísticas para Dashboards por Papel (Corretor, Gestor, Diretor) */
export function evaluateDashboardRules(ctx: DashboardActionContext): NextBestAction[] {
  const actions: NextBestAction[] = [];

  if (ctx.role === "manager" || ctx.role === "supervisor") {
    if (ctx.unattendedLeadsCount && ctx.unattendedLeadsCount > 0) {
      actions.push({
        key: "mgr-unattended-leads",
        title: `${ctx.unattendedLeadsCount} Leads Sem Atendimento`,
        description: "Leads acumulados na fila central aguardando atribuição.",
        priority: "critical",
        actionType: "navigate",
        label: "Ver Fila de Distribuição",
        href: "/leads/distribuicao",
        reason: "Fila da equipe com acúmulo de tempo de espera.",
        ruleId: "team_unattended_leads",
        entityType: "team",
        permission: "lead_queues_manage",
      });
    }

    if (ctx.pendingDocumentsCount && ctx.pendingDocumentsCount > 0) {
      actions.push({
        key: "mgr-pending-docs",
        title: `${ctx.pendingDocumentsCount} Documentos para Aprovar`,
        description: "Documentos de propostas aguardando análise de cadastro.",
        priority: "high",
        actionType: "navigate",
        label: "Aprovar Documentos",
        href: "/documentos",
        reason: "Esteira de aprovação com pendências.",
        ruleId: "team_pending_documents",
        entityType: "document",
        permission: "aprovar_documentos",
      });
    }
  }

  if (ctx.role === "director") {
    if (ctx.branchConversionDrop) {
      actions.push({
        key: "dir-conversion-drop",
        title: "Queda na Taxa de Conversão da Unidade",
        description: "Desempenho da semana abaixo da média histórica.",
        priority: "high",
        actionType: "navigate",
        label: "Analisar Relatório da Unidade",
        href: "/dashboard",
        reason: "Indicador de conversão com desvio relevante.",
        ruleId: "branch_conversion_drop",
        entityType: "system",
        permission: "acessar_relatorios",
      });
    }
  }

  return actions;
}
