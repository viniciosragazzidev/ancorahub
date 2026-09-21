import { describe, expect, it } from "vitest";

import type { LeadDistributionStatus } from "./types";
import {
  availabilityStatusUi,
  engineHealthUi,
  leadDistributionStatusUi,
  queueStatusUi,
  slaStatusUi,
} from "./status-ui";

describe("distribution status map", () => {
  it("translates every lead distribution status and keeps the existing labels", () => {
    const all: LeadDistributionStatus[] = [
      "unassigned", "awaiting_unit", "queued", "assigning", "assigned", "distribution_failed", "returned_to_queue",
    ];
    for (const status of all) expect(leadDistributionStatusUi(status).label).not.toBe("Desconhecido");
    // Vocabulário já usado nos filtros do inbox.
    expect(leadDistributionStatusUi("unassigned").label).toBe("Aguardando unidade");
    expect(leadDistributionStatusUi("queued").label).toBe("Aguardando corretor");
    expect(leadDistributionStatusUi("returned_to_queue").label).toBe("Devolvido à fila");
  });

  it("uses the destructive tone only for a real failure and success only when assigned", () => {
    expect(leadDistributionStatusUi("distribution_failed").tone).toBe("destructive");
    expect(leadDistributionStatusUi("assigned").tone).toBe("success");
    expect(leadDistributionStatusUi("queued").tone).toBe("warning");
  });

  it("degrades to a neutral 'Desconhecido' instead of throwing on a new status", () => {
    expect(leadDistributionStatusUi("brand_new_state")).toEqual({ tone: "secondary", label: "Desconhecido" });
    expect(availabilityStatusUi("???")).toEqual({ tone: "secondary", label: "Desconhecido" });
  });

  it("maps queue and broker availability", () => {
    expect(queueStatusUi("active")).toEqual({ tone: "success", label: "Ativa" });
    expect(queueStatusUi("paused")).toEqual({ tone: "secondary", label: "Pausada" });
    expect(availabilityStatusUi("available").tone).toBe("success");
    expect(availabilityStatusUi("paused").tone).toBe("warning");
    expect(availabilityStatusUi("offline").tone).toBe("secondary");
  });

  it("reports engine health with the same wording as before", () => {
    expect(engineHealthUi({ available: true, failed: 0 })).toEqual({ tone: "success", label: "Motor operacional" });
    expect(engineHealthUi({ available: true, failed: 2 })).toEqual({ tone: "warning", label: "Atenção no motor" });
    expect(engineHealthUi({ available: false, failed: 0 }).label).toBe("Motor indisponível");
  });

  it("classifies the SLA by elapsed ratio", () => {
    expect(slaStatusUi(5, 15).tone).toBe("success");
    expect(slaStatusUi(12, 15)).toMatchObject({ tone: "warning", label: "Prazo vencendo" });
    expect(slaStatusUi(15, 15).tone).toBe("destructive");
    expect(slaStatusUi(30, 15).ratio).toBe(2);
    expect(slaStatusUi(-3, 15).ratio).toBe(0);
    expect(slaStatusUi(5, 0).tone).toBe("destructive"); // limite inválido nunca esconde um atraso
  });
});
