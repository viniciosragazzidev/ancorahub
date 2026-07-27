export const notificationCapabilities = [
  { id: "lead_assignment", label: "Lead atribuído ou reatribuído", description: "Aviso ao corretor, gestor e diretor quando um lead é distribuído.", channels: "Toast + push" },
  { id: "lead_feedback_overdue", label: "Lead devolvido por SLA", description: "Aviso quando o primeiro contato não acontece dentro do prazo.", channels: "Toast/in-app" },
  { id: "lead_feedback_reminder", label: "Lembrete de feedback", description: "Lembrete recorrente com intervalo configurável para registrar o andamento do atendimento.", channels: "Toast + push" },
  { id: "lead_sla", label: "Alertas de SLA e estagnação", description: "Alertas de lead não trabalhado ou parado na etapa.", channels: "Toast/in-app" },
  { id: "lead_service_started", label: "Atendimento iniciado", description: "Aviso para a gestão quando o corretor inicia um atendimento.", channels: "Toast/in-app" },
  { id: "sale_registered", label: "Venda registrada", description: "Confirmação de conversão e registro da venda.", channels: "Toast/in-app" },
  { id: "client_renewal", label: "Renovação de cliente", description: "Lembretes de aniversário e renovação contratual.", channels: "Toast/in-app" },
  { id: "lead_reengagement", label: "Reengajamento de lead", description: "Avisos de oportunidades de reengajamento.", channels: "Toast/in-app" },
  { id: "lead_converted", label: "Lead convertido", description: "Aviso de mudança do lead para convertido.", channels: "Toast + push" },
  { id: "lead_lost", label: "Lead perdido", description: "Aviso ao corretor e gestão quando um lead é marcado como perdido.", channels: "Toast + push" },
  { id: "document_reviewed", label: "Documento revisado", description: "Notifica o corretor quando um documento é aprovado ou rejeitado.", channels: "Toast + push" },
  { id: "lead_arrived", label: "Lead chegou", description: "Aviso aos gestores e diretores quando um novo lead chega no sistema, antes da distribuição.", channels: "Toast + push" },
  { id: "task_overdue", label: "Tarefa vencida", description: "Lembrete ao responsável quando uma tarefa está com prazo vencido.", channels: "Toast + push" },
  { id: "lead_reassigned", label: "Lead reatribuído", description: "Notifica o corretor anterior quando um lead é reatribuído a outro profissional.", channels: "Toast + push" },
  { id: "manager_note", label: "Nota da gestão", description: "Notifica o corretor quando um gestor ou diretor adiciona uma observação ao seu lead.", channels: "Toast + push" },
  { id: "lead_reopened", label: "Lead reaberto", description: "Notifica o corretor e a gestão quando um lead perdido é reaberto.", channels: "Toast + push" },
  { id: "lead_archived", label: "Lead arquivado", description: "Notifica quando um lead é arquivado (disponível para uso futuro).", channels: "Toast/in-app" },
] as const;

export type NotificationCapabilityId = (typeof notificationCapabilities)[number]["id"];

export function notificationCapabilitySettingKey(id: NotificationCapabilityId) {
  return `notification_capability_${id}_enabled`;
}
