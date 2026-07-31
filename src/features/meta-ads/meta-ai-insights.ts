import "server-only";

import { aiComplete } from "@/features/ai/engine";
import { getTenantMetaCampaignsPerformance } from "./meta-analytics-service";

export async function aiAnalyzeCampaignPerformance(tenantId: string, question: string): Promise<string> {
  const performance = await getTenantMetaCampaignsPerformance(tenantId);

  const contextText = `
Dados Reais de Campanhas Meta Ads do Tenant:
Total de Leads: ${performance.totals.leads}
Total de Conversas WhatsApp: ${performance.totals.conversations}
Total de Vendas Concluídas: ${performance.totals.sales}
Receita Total Vendida: R$ ${performance.totals.revenue.toLocaleString("pt-BR")}
Taxa de Conversão Geral: ${performance.totals.conversionRate}%

Lista de Campanhas:
${performance.campaigns
  .map(
    (c) =>
      `- Campanha: "${c.name}" | Status: ${c.status} | Leads: ${c.leadsCount} | Conversas: ${c.conversationsCount} | Vendas: ${c.salesCount} | Receita: R$ ${(c.revenueTotal || 0).toLocaleString("pt-BR")} | Conversão: ${c.conversionRate}%`
  )
  .join("\n")}
`;

  try {
    const response = await aiComplete({
      systemPromptOverride:
        "Você é o consultor de Inteligência Comercial e Meta Ads do CorreTop CRM. Responda à pergunta do usuário utilizando estritamente os dados reais fornecidos. Seja analítico, direto e forneça sugestões acionáveis para aumentar as vendas.",
      userMessage: `${contextText}\n\nPergunta do usuário: "${question}"`,
    });

    return response.text;
  } catch (err: any) {
    // Fallback determinístico caso o serviço de IA esteja desativado ou sem API key
    if (performance.campaigns.length === 0) {
      return "Nenhuma campanha Meta Ads encontrada no tenant até o momento.";
    }

    const sortedBySales = [...performance.campaigns].sort((a, b) => (b.salesCount || 0) - (a.salesCount || 0));
    const sortedByConversion = [...performance.campaigns].sort((a, b) => (a.conversionRate || 0) - (b.conversionRate || 0));

    const topSales = sortedBySales[0];
    const worstConv = sortedByConversion[0];

    return `Análise de Campanhas (Modo Determinístico):
• A campanha que trouxe mais vendas foi "${topSales?.name || "N/A"}" com ${topSales?.salesCount || 0} vendas concluídas e R$ ${(topSales?.revenueTotal || 0).toLocaleString("pt-BR")} em receita.
• A campanha com pior conversão foi "${worstConv?.name || "N/A"}" com taxa de conversão de ${worstConv?.conversionRate || 0}%.`;
  }
}
