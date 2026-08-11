import type { WorkflowNodeDefinition, WorkflowNodeKind } from "./contracts";

const definitions: readonly WorkflowNodeDefinition[] = [
  { kind: "trigger.lead_created", label: "Novo lead", description: "Inicia quando uma oportunidade é recebida.", category: "trigger", editableFields: ["source"], requiredPermissions: ["acessar_leads"] },
  { kind: "trigger.lead_updated", label: "Lead atualizado", description: "Inicia após uma atualização permitida no lead.", category: "trigger", editableFields: ["fields"], requiredPermissions: ["acessar_leads"] },
  { kind: "trigger.manual", label: "Execução manual", description: "Inicia apenas em teste ou por ação autorizada.", category: "trigger", editableFields: [], requiredPermissions: ["acessar_configuracoes"] },
  { kind: "logic.condition", label: "Condição", description: "Encaminha o fluxo conforme regras de dados.", category: "logic", editableFields: ["match", "conditions"], requiredPermissions: [] },
  { kind: "logic.switch", label: "Escolher caminho", description: "Divide o fluxo por um valor conhecido.", category: "logic", editableFields: ["expression", "cases"], requiredPermissions: [] },
  { kind: "control.delay", label: "Aguardar", description: "Pausa uma execução para continuar depois.", category: "control", editableFields: ["duration", "timezone"], requiredPermissions: [] },
  { kind: "crm.create_task", label: "Criar tarefa", description: "Cria uma tarefa rastreável para a equipe.", category: "crm", editableFields: ["title", "dueInMinutes", "assignee"], requiredPermissions: ["acessar_tarefas"] },
  { kind: "crm.add_tag", label: "Adicionar etiqueta", description: "Inclui uma etiqueta autorizada no lead.", category: "crm", editableFields: ["tag"], requiredPermissions: ["acessar_leads"] },
  { kind: "crm.notify_manager", label: "Notificar gestor", description: "Cria um alerta interno para a operação.", category: "crm", editableFields: ["message"], requiredPermissions: ["acessar_notificacoes"] },
  { kind: "ai.classify_lead", label: "Classificar com IA", description: "Propõe uma classificação estruturada; não altera o lead sozinha.", category: "ai", editableFields: ["prompt", "outputSchema"], requiredPermissions: ["acessar_qualificacao_ia"], requiresFeatureFlag: "feature_workflow_ai_nodes_enabled" },
  { kind: "channel.whatsapp_send", label: "Enviar WhatsApp", description: "Canal externo sujeito a consentimento, janela e aprovação de template.", category: "channel", editableFields: ["template", "message"], requiredPermissions: ["configurar_whatsapp_proprio"], requiresFeatureFlag: "feature_workflow_whatsapp_nodes_enabled", requiresHumanConfirmation: true },
];

const byKind = new Map(definitions.map((definition) => [definition.kind, definition]));

export function listWorkflowNodeDefinitions() {
  return definitions;
}

export function getWorkflowNodeDefinition(kind: WorkflowNodeKind) {
  return byKind.get(kind);
}
