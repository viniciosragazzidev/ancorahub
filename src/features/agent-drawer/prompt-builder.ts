import type { TenantContext } from "@/shared/auth/types";

export type RoleShortcut = {
  key: string;
  label: string;
  prompt: string;
};

export const ROLE_SHORTCUTS_MAP: Record<TenantContext["role"], RoleShortcut[]> = {
  broker: [
    {
      key: "Ctrl 1",
      label: "Minha fila de prioridades",
      prompt: "Quais leads na minha fila exigem atenção ou retorno agora?",
    },
    {
      key: "Ctrl 2",
      label: "Status do meu plantão",
      prompt: "Qual é o status do meu plantão ao vivo hoje?",
    },
    {
      key: "Ctrl 3",
      label: "Entrar no plantão",
      prompt: "Por favor, ative meu plantão de atendimento ao vivo agora.",
    },
  ],
  supervisor: [
    {
      key: "Ctrl 1",
      label: "Estouro de SLA na equipe",
      prompt: "Existem estouros de SLA ou leads parados na minha filial hoje?",
    },
    {
      key: "Ctrl 2",
      label: "Corretores em plantão",
      prompt: "Quem são os corretores da minha filial ativos em plantão agora?",
    },
    {
      key: "Ctrl 3",
      label: "Reatribuir lead travado",
      prompt: "Qual o resumo da fila sem atendimento e como posso distribuir esses leads?",
    },
  ],
  manager: [
    {
      key: "Ctrl 1",
      label: "Métricas do funil comercial",
      prompt: "Qual a taxa de conversão global do funil de vendas este mês?",
    },
    {
      key: "Ctrl 2",
      label: "Saúde da operação e IA",
      prompt: "Qual o status de saúde da IA, conexões e alertas de qualificação?",
    },
    {
      key: "Ctrl 3",
      label: "Corretores em plantão",
      prompt: "Listar corretores que estão de plantão e volume de atendimentos.",
    },
  ],
  // Agente do diretor (21/11): pedidos do dia a dia que o agente já resolve (plano §12, A14 e A1).
  director: [
    {
      key: "Ctrl 1",
      label: "Plantões agora",
      prompt: "Quem está no plantão agora?",
    },
    {
      key: "Ctrl 2",
      label: "Onde falta gente",
      prompt: "Onde falta gente na escala desta semana?",
    },
    {
      key: "Ctrl 3",
      label: "Dar cadeiras",
      prompt: "Dê 5 cadeiras para ",
    },
  ],
};
