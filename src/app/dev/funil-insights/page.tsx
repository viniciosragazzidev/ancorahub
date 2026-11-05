import { notFound } from "next/navigation";

import { FunnelInsightsPanel } from "@/features/funnel-insights/components/funnel-insights-panel";
import { campaignRow, rankCounts, QUESTION_LABELS, STAGE_LABELS } from "@/features/funnel-insights/insights-core";

/** Revisão visual do funil profissional (05/11), só em desenvolvimento, com dados de exemplo. */
export default function FunnelInsightsPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  const stoppedAt = rankCounts(new Map([["age", 46], ["numberOfLives", 18], ["planType", 9], ["city", 6], ["customerName", 3]]), QUESTION_LABELS);
  return (
    <main className="mx-auto grid max-w-[1100px] gap-4 bg-background p-6">
      <FunnelInsightsPanel
        steps={[
          { key: "arrived", label: "Chegaram", count: 320 },
          { key: "first_message", label: "1ª mensagem", count: 312 },
          { key: "replied", label: "Respondeu", count: 190 },
          { key: "qualified", label: "Qualificado", count: 104 },
          { key: "with_broker", label: "Com corretor", count: 98 },
          { key: "converted", label: "Venda", count: 21 },
        ]}
        insights={{
          stoppedAt,
          stoppedTotal: stoppedAt.reduce((sum, row) => sum + row.count, 0),
          lostAtStage: rankCounts(new Map([["in_contact", 24], ["quote_sent", 17], ["awaiting_reply", 12], ["negotiation", 6]]), STAGE_LABELS),
          lossReasons: rankCounts(new Map([["sem_contato", 22], ["preco", 15], ["ja_contratou", 9], ["desistiu", 7]]), { sem_contato: "Sem contato", preco: "Preço", ja_contratou: "Já contratou", desistiu: "Desistiu" }),
          campaigns: [
            campaignRow({ key: "c1", name: "PME Rio — Formulário", leads: 140, qualified: 62, sales: 12 }),
            campaignRow({ key: "c2", name: "Familiar 30+ — Reels", leads: 96, qualified: 25, sales: 4 }),
            campaignRow({ key: "c3", name: "Adesão MEI", leads: 51, qualified: 12, sales: 3 }),
            campaignRow({ key: "_none", name: null, leads: 33, qualified: 5, sales: 2 }),
          ],
        }}
      />
    </main>
  );
}
