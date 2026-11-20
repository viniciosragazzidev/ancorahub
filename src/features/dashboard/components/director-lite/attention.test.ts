import { describe, expect, it } from "vitest";

import type { EssentialDashboard } from "@/features/dashboard/essential/essential-data";

import { ATTENTION_LIMIT, attentionItems } from "./attention";

function dashboard(overrides: {
  running?: Array<Partial<EssentialDashboard["duties"]["running"][number]>>;
  waiting?: number;
  rows?: Array<Partial<EssentialDashboard["queues"]["rows"][number]>>;
  whatsapp?: Partial<EssentialDashboard["whatsapp"]>;
} = {}): EssentialDashboard {
  const rows = (overrides.rows ?? []).map((row, index) => ({
    id: `q${index}`, name: `Fila ${index}`, hue: null, arrived: 0, hot: 0, warm: 0, cold: 0, inQualification: 0, qualified: 0, waiting: 0,
    requalification: { attempts: 0, coldLeads: 0, once: 0, twice: 0, threePlus: 0 },
    ...row,
  }));
  return {
    generatedAt: "2026-11-20T12:00:00Z",
    firstName: "Vinicios",
    duties: {
      running: (overrides.running ?? []).map((duty, index) => ({
        scheduleId: `s${index}`, name: `Plantão ${index}`, startsAt: "09:00", endsAt: "12:00", dutyDate: "2026-11-20", brokerCount: 3, minimumBrokers: 2,
        queueId: null, available: 0, distributed: 0, activeBrokers: 3, belowMinimum: false,
        ...duty,
      })),
      next: null,
    },
    queues: {
      since: "2026-11-19T22:00:00Z",
      label: "desde as 19h",
      rows,
      totals: { arrived: 0, hot: 0, warm: 0, cold: 0, inQualification: 0, qualified: 0, waiting: overrides.waiting ?? 0, requalification: { attempts: 0, coldLeads: 0, once: 0, twice: 0, threePlus: 0 } },
    },
    whatsapp: { total: 0, connected: 0, received: 0, responding: 0, active: 0, responseRate: 0, brokers: [], since: "", label: "desde as 19h", ...overrides.whatsapp },
  } as unknown as EssentialDashboard;
}

describe("attentionItems", () => {
  it("sem pendência, lista vazia", () => {
    expect(attentionItems(dashboard())).toEqual([]);
  });

  it("ordem fixa: plantão abaixo do mínimo, aguardando, frios, WhatsApp; no máximo 3", () => {
    const items = attentionItems(dashboard({
      running: [{ name: "Plantão Niterói", belowMinimum: true, activeBrokers: 0, brokerCount: 2, available: 10 }],
      waiting: 4,
      rows: [{ name: "Alessandra", arrived: 10, cold: 5 }],
      whatsapp: { total: 261, connected: 94 },
    }));
    expect(items).toHaveLength(ATTENTION_LIMIT);
    expect(items.map((item) => item.action)).toEqual(["Ver plantão", "Distribuir", "Ver fila"]);
    expect(items[0]).toMatchObject({ title: "Plantão Niterói abaixo do mínimo", detail: "0/2 corretores confirmados · 10 leads esperando", tone: "danger", href: "/leads/distribuicao/plantao/s0" });
    expect(items[1]).toMatchObject({ title: "4 leads aguardando corretor", href: "/leads?view=sem-atribuicao" });
    expect(items[2]).toMatchObject({ title: "Alessandra com 50% de frios", href: "/leads?fila=q0" });
  });

  it("singular e WhatsApp com menos da metade conectada", () => {
    const items = attentionItems(dashboard({ waiting: 1, whatsapp: { total: 10, connected: 4 } }));
    expect(items.map((item) => item.title)).toEqual(["1 lead aguardando corretor", "6 corretores sem WhatsApp conectado"]);
  });

  it("fila pequena ou com poucos frios não entra", () => {
    expect(attentionItems(dashboard({ rows: [{ arrived: 4, cold: 4 }, { arrived: 10, cold: 3 }] }))).toEqual([]);
  });
});
