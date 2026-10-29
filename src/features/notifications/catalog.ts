export const notificationCapabilities = [
  { id: "lead_assignment", label: "Lead atribuído ou reatribuído", description: "Aviso ao corretor, gestor e diretor quando um lead é distribuído; ao corretor, também usa o template oficial aprovado.", channels: "Toast + push + WhatsApp" },
  { id: "lead_feedback_overdue", label: "Lead devolvido por SLA", description: "Aviso quando o primeiro contato não acontece dentro do prazo.", channels: "Toast/in-app" },
  { id: "lead_client_returned", label: "Cliente voltou a chamar", description: "Quando um lead distribuído há 24 h ou mais manda mensagem, o corretor é avisado no app e pelo WhatsApp (canal em Avisos da equipe). Uma vez por lead.", channels: "Toast + push + WhatsApp" },
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
  { id: "quick_reply_human", label: "Quick Reply e atendimento humano", description: "Aviso ao corretor quando uma mensagem foi resolvida automaticamente ou solicita atendimento humano.", channels: "Toast + push" },
  { id: "duty_assignment", label: "Escala de plantão", description: "Avisa o corretor quando a gestão o coloca em um plantão.", channels: "Toast + push" },
  { id: "duty_absence", label: "Falta no plantão", description: "Avisa o corretor quando a gestão marca ou desfaz uma falta dele em um plantão.", channels: "Toast + push" },
  { id: "duty_skip_pause", label: "Pausa por pulos no plantão", description: "No 3º lead sem atender no mesmo plantão, o corretor entra em pausa e o supervisor (ou o gerente da unidade) é avisado para conversar e despausar.", channels: "Toast + push" },
  { id: "duty_presence_photo", label: "Foto do plantão presencial", description: "Avisa o diretor e o gerente do plantão quando o corretor envia a foto do local, para validar e liberar.", channels: "Toast + push" },
  { id: "supervisor_digest", label: "Resumo do dia para o supervisor", description: "Às 19h, o dia da equipe do supervisor em poucas linhas (leads, atrasos, destaque e meta).", channels: "Toast + push" },
  { id: "team_weekly_summary", label: "Resumo semanal da equipe", description: "Na segunda de manha, resume leads, SLA, aceite e conversao da unidade ou equipe no Lite.", channels: "In-app" },
  { id: "journey_near_completion", label: "Missão da equipe quase concluída", description: "Avisa o supervisor uma vez por corretor ao faltar um contato para concluir a missão do dia.", channels: "Toast/in-app" },
  { id: "supervisor_transfer", label: "Pedido de transferência entre equipes", description: "Avisa os gestores sobre pedidos de transferência de corretores entre equipes de supervisão.", channels: "Toast + push" },
  { id: "supervisor_team_invite", label: "Convite para equipe do supervisor", description: "Avisa o corretor quando um supervisor da unidade convida para a equipe e informa o resultado ao supervisor.", channels: "Toast + push" },
  { id: "relationship_message", label: "Mensagens da Central de relacionamento", description: "Avisos, reconhecimentos e pedidos de confirmação que a direção envia aos corretores.", channels: "Toast + push" },
  { id: "ai_budget", label: "Orçamento de IA", description: "Avisa os diretores quando o gasto do mês com a IA chega a 80% e a 100% do orçamento definido no Super-admin.", channels: "Toast + push" },
  { id: "lead_ai_insight", label: "Insight e Diagnóstico de IA na Conversa", description: "Notifica o corretor e a gestão quando a IA identifica sinais de compra, objeções críticas ou sugere avanço no funil.", channels: "Toast + push" },
] as const;

export type NotificationCapabilityId = (typeof notificationCapabilities)[number]["id"];

export function notificationCapabilitySettingKey(id: NotificationCapabilityId) {
  return `notification_capability_${id}_enabled`;
}
