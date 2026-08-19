export const SYSTEM_REPORT_ENABLED_KEY = "feature_system_report_enabled";

export const SYSTEM_REPORT_DESTINATION_KEY = "system_report_whatsapp_destination";

export const SYSTEM_REPORT_TRIGGERS = [
  { id: "bug_erro", label: "Bug ou erro no sistema" },
  { id: "problema_leads", label: "Problema com leads ou distribuição" },
  { id: "falha_whatsapp", label: "Falha no WhatsApp ou envio" },
  { id: "permissao_acesso", label: "Permissão ou acesso incorreto" },
  { id: "outro", label: "Outro assunto ou sugestão" },
] as const;

export type SystemReportTriggerId = (typeof SYSTEM_REPORT_TRIGGERS)[number]["id"];

export function getSystemReportTrigger(triggerId: string) {
  return SYSTEM_REPORT_TRIGGERS.find((trigger) => trigger.id === triggerId) ?? null;
}

export function buildSystemReportMessage(input: {
  cargo: string;
  nome: string;
  titulo: string;
  mensagem: string;
}): string {
  const lines = [
    "*REPORT SISTEMA*",
    `*${input.cargo}*: ${input.nome}`,
    `_${input.titulo}_`,
    input.mensagem.trim(),
  ];
  return lines.join("\n");
}