// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LightClientDetail, type LightClientDetailData } from "./light-client-detail";

const base: LightClientDetailData = {
  client: {
    id: "c1",
    leadId: "lead-1",
    name: "Marina Alves",
    phone: "11999998888",
    email: "marina@example.com",
    convertedAt: "2026-09-20T12:00:00Z",
    branchName: "Unidade Centro",
    brokerName: "Paulo Dias",
  },
  activeCustomer: {
    status: "active",
    coverageStartDate: "2026-09-20",
    contractAnniversary: "2026-12-01",
    expirationDate: null,
    renewalStatus: "pending_window",
    cancellationDate: null,
    cancellationReason: null,
  },
  sales: [{ id: "s1", planName: "Plano Essencial", carrierName: "Operadora X", saleValue: "350.5", policyNumber: "APL-9", status: "approved", saleDate: "2026-09-20", brokerName: "Paulo Dias" }],
  beneficiaries: [{ id: "b1", name: "Marina Alves", relationship: null, isHolder: true }],
  documents: [{ id: "d1", filename: "rg.pdf", status: "approved", requirementName: "RG" }],
  timeline: [{ id: "t1", tipo: "status_change", conteudo: "Venda concluída", userName: "Paulo Dias", createdAt: "2026-09-20T12:00:00Z" }],
};

afterEach(() => cleanup());

function openSection(name: RegExp) {
  fireEvent.click(screen.getByRole("button", { name }));
}

describe("LightClientDetail", () => {
  it("opens on Dados with the contact, renewal and beneficiaries, and the WhatsApp action", () => {
    render(<LightClientDetail data={base} />);

    expect(screen.getByRole("heading", { level: 1, name: "Marina Alves" })).toBeTruthy();
    expect(screen.getByText("Cliente ativo")).toBeTruthy();
    expect(screen.getByRole("link", { name: "WhatsApp" }).getAttribute("href")).toContain("web.whatsapp.com/send?phone=");
    expect(screen.getByRole("group", { name: "Seções do cliente" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Renovação" })).toBeTruthy();
    expect(screen.getByText("Acompanhar no prazo")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Beneficiários (1)" })).toBeTruthy();
  });

  it("switches sections with the segmented control", () => {
    render(<LightClientDetail data={base} />);

    openSection(/Vendas \(1\)/);
    expect(screen.getByRole("heading", { name: "Vendas (1)" })).toBeTruthy();
    expect(screen.getByText(/Total em vendas/)).toBeTruthy();

    openSection(/Documentos \(1\)/);
    expect(screen.getByRole("heading", { name: "Documentos (1)" })).toBeTruthy();

    openSection(/Histórico/);
    expect(screen.getByRole("heading", { name: "Linha do tempo" })).toBeTruthy();
  });

  it("marks a cancelled client and shows the cancellation reason", () => {
    render(
      <LightClientDetail
        data={{
          ...base,
          activeCustomer: { ...base.activeCustomer!, status: "cancelled", cancellationDate: "2026-10-01", cancellationReason: "Inadimplência" },
        }}
      />,
    );

    expect(screen.getByText("Cliente cancelado")).toBeTruthy();
    expect(screen.getByText(/Inadimplência/)).toBeTruthy();
    expect(screen.queryByText(/Renovação em \d+ dias/)).toBeNull();
  });

  it("explains empty sections instead of leaving them blank", () => {
    render(<LightClientDetail data={{ ...base, client: { ...base.client, phone: null }, activeCustomer: null, sales: [], beneficiaries: [], documents: [], timeline: [] }} />);

    expect(screen.queryByRole("link", { name: "WhatsApp" })).toBeNull();
    expect(screen.getByText("Sem contrato ativo registrado para este cliente.")).toBeTruthy();
    expect(screen.getByText("Nenhum beneficiário cadastrado.")).toBeTruthy();

    openSection(/Vendas/);
    expect(screen.getByText("Nenhuma venda registrada.")).toBeTruthy();
    openSection(/Documentos/);
    expect(screen.getByText("Nenhum documento enviado.")).toBeTruthy();
    openSection(/Histórico/);
    expect(screen.getByText("Nenhum registro na linha do tempo.")).toBeTruthy();
  });
});
