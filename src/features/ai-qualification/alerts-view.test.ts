import { describe, expect, it } from "vitest";

import { alertLevelView, alertsForTab, alertTitle, alertWhatToDo, canResolveAlert, toAlertRow, type AlertRow } from "./alerts-view";

function row(patch: Partial<AlertRow>): AlertRow {
  return { id: "a", alertType: "queue_no_broker", level: "warning", status: "active", message: "m", suggestedAction: null, createdAt: "2026-11-25T10:00:00.000Z", resolvedAt: null, live: false, href: null, ...patch };
}

describe("alertas da IA na tela /ia/alertas", () => {
  it("gravidade sempre com texto e título por tipo", () => {
    expect(alertLevelView("critical")).toEqual({ label: "Crítico", tone: "danger" });
    expect(alertLevelView("warning")).toEqual({ label: "Atenção", tone: "warning" });
    expect(alertLevelView("info").label).toBe("Informação");
    expect(alertTitle("ai_send_failed")).toBe("IA sem conseguir responder");
    expect(alertTitle("outro")).toBe("Alerta da operação");
  });

  it("Abertos por gravidade e depois os mais recentes; Resolvidos à parte", () => {
    const rows = [
      row({ id: "w-old", level: "warning", createdAt: "2026-11-25T08:00:00.000Z" }),
      row({ id: "c", level: "critical", createdAt: "2026-11-25T07:00:00.000Z" }),
      row({ id: "w-new", level: "warning", createdAt: "2026-11-25T09:00:00.000Z" }),
      row({ id: "done", status: "resolved", resolvedAt: "2026-11-25T11:00:00.000Z" }),
      row({ id: "ack", status: "acknowledged" }),
    ];
    expect(alertsForTab(rows, "open").map((item) => item.id)).toEqual(["c", "w-new", "w-old"]);
    expect(alertsForTab(rows, "resolved").map((item) => item.id)).toEqual(["done", "ack"]);
  });

  it("só o alerta gravado e aberto tem Resolver; o calculado some sozinho", () => {
    expect(canResolveAlert(row({}))).toBe(true);
    expect(canResolveAlert(row({ live: true }))).toBe(false);
    expect(canResolveAlert(row({ status: "resolved" }))).toBe(false);
  });

  it("O que fazer usa a sugestão gravada ou uma orientação", () => {
    expect(alertWhatToDo(row({ suggestedAction: " Confira o plantão. " }))).toBe("Confira o plantão.");
    expect(alertWhatToDo(row({ live: true }))).toContain("some sozinho");
    expect(alertWhatToDo(row({}))).toContain("marque como resolvido");
  });

  it("converte o registro do serviço com datas em texto", () => {
    const converted = toAlertRow({ id: "live:x", tenantId: "t", alertType: "ai_send_failed", level: "critical", status: "active", message: "m", suggestedAction: "s", createdAt: new Date("2026-11-25T10:00:00Z"), resolvedAt: null, resolvedBy: null, live: true, href: "/qualificacao?tab=whatsapp_diag" });
    expect(converted).toMatchObject({ createdAt: "2026-11-25T10:00:00.000Z", resolvedAt: null, live: true, href: "/qualificacao?tab=whatsapp_diag" });
  });
});
