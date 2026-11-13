// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const url = vi.hoisted(() => ({ search: "" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/financeiro/recebiveis",
  useSearchParams: () => new URLSearchParams(url.search),
}));
const detail = vi.hoisted(() => ({
  entry: {
    id: "e1", kind: "agency_receivable" as const, reference: "REC-1", description: "Recebível sintético", amountCents: 15000, dueOn: "2026-11-30",
    competence: "2026-11", status: "approved", version: 2, evidenceDocumentId: "d1",
  },
  documents: [{ id: "d1", fileName: "comprovante.pdf" }], settledCents: 5000, cashCents: 5000, offsetCents: 0, agency: true,
  canPrepare: true, canApprove: false,
  movements: [
    { id: "m1", kind: "payment", amountCents: 5000, occurredOn: "2026-11-10", status: "confirmed", evidenceDocumentId: "d1", reason: "Pago", canReview: false },
    { id: "m2", kind: "payment", amountCents: 1000, occurredOn: "2026-11-11", status: "pending", evidenceDocumentId: "d1", reason: "Parcial", canReview: true },
  ],
}));
const actions = vi.hoisted(() => ({
  loadFinancialEntryAction: vi.fn(async () => ({ ok: true, data: detail })),
  searchFinanceSalesAction: vi.fn(async () => ({ ok: true, data: [] })),
  searchFinanceBeneficiariesAction: vi.fn(async () => ({ ok: true, data: [] })),
  prepareFinancialEntryAction: vi.fn(async () => ({ ok: true, message: "" })),
  reviewFinancialEntryAction: vi.fn(async () => ({ ok: true, message: "" })),
  prepareSettlementAction: vi.fn(async () => ({ ok: true, message: "" })),
  reviewSettlementAction: vi.fn(async () => ({ ok: true, message: "" })),
  reverseSettlementAction: vi.fn(async () => ({ ok: true, message: "" })),
  prepareOffsetAction: vi.fn(async () => ({ ok: true, message: "" })),
  reviewOffsetAction: vi.fn(async () => ({ ok: true, message: "" })),
  reverseOffsetAction: vi.fn(async () => ({ ok: true, message: "" })),
  prepareClosingAction: vi.fn(async () => ({ ok: true, message: "" })),
  reviewClosingAction: vi.fn(async () => ({ ok: true, message: "" })),
}));
vi.mock("../finance-actions", () => actions);
vi.mock("../client-file-request", () => ({ submitErpFile: vi.fn(async () => ({ ok: true, message: "" })) }));

import { ErpSkinProvider } from "../ui/skin-context";
import type { ErpSkin } from "../ui/skin";
import { FinanceLedger, type EntryDetail } from "./finance-workspace";
import { CashKindsList, ClosingsWorkspace, OffsetPreparePanel, OffsetsList } from "./finance-controls";
import { FinancialEntryDetail } from "./ledger-entry-detail";
import { activeSection } from "./ledger-section-tabs";

afterEach(() => { cleanup(); url.search = ""; });

const SKINS: ErpSkin[] = ["standard", "lite"];
const mount = (skin: ErpSkin, ui: ReactElement) => render(<ErpSkinProvider skin={skin}>{ui}</ErpSkinProvider>);
const openRow = (text: string) => act(() => { fireEvent.click(screen.getAllByText(text)[0]); });

const entries = {
  filters: { kind: "agency_receivable" as const, status: "all" as const, competence: undefined, q: "", page: 1 }, pageSize: 25, total: 2, agency: true, canPrepare: true,
  summary: { toReview: 1, receivableCents: 10000, payableCents: 0, settledCents: 5000, approvedCents: 15000 },
  rows: [
    { id: "e1", kind: "agency_receivable" as const, reference: "REC-1", description: "Recebível sintético", amountCents: 15000, dueOn: "2026-11-30",
      competence: "2026-11", status: "approved", version: 2, settledCents: 5000, beneficiaryName: null },
    { id: "e2", kind: "agency_receivable" as const, reference: "REC-2", description: "Outro recebível", amountCents: 9000, dueOn: "2026-12-10",
      competence: "2026-12", status: "submitted", version: 1, settledCents: 0, beneficiaryName: "Ana Souza" },
  ],
};
const offsets = {
  page: 1, pageSize: 25, total: 2, canPrepare: true, summary: { pending: 1, confirmedCents: 1000 },
  choices: [
    { id: "a1", reference: "ADV-1", kind: "advance", beneficiaryId: "u1", beneficiaryName: "Ana Souza", availableCents: 3000 },
    { id: "c1", reference: "COM-1", kind: "broker_commission", beneficiaryId: "u1", beneficiaryName: "Ana Souza", availableCents: 8000 },
  ],
  rows: [
    { id: "o1", advanceEntryId: "a1", commissionEntryId: "c1", advanceReference: "ADV-1", commissionReference: "COM-1", kind: "allocation",
      amountCents: 2000, occurredOn: "2026-11-05", status: "pending", reason: "Acordo assinado", canReview: true },
    { id: "o2", advanceEntryId: "a1", commissionEntryId: "c2", advanceReference: "ADV-1", commissionReference: "COM-2", kind: "allocation",
      amountCents: 1000, occurredOn: "2026-10-05", status: "confirmed", reason: "Acordo", canReview: false },
  ],
};
const snapshot = {
  version: 1 as const, competence: "2026-10", digest: "x", entryCount: 3, movementCount: 2, offsetCount: 1, cashInCents: 10000, cashOutCents: 4000,
  externalCents: 0, calculatedAt: "2026-11-01T12:00:00.000Z",
};
const closings = {
  canPrepare: true,
  rows: [
    { id: "k1", competence: "2026-10", status: "pending", reason: "Prévia do mês", version: 1, snapshot, canReview: true, canReopen: true },
    { id: "k2", competence: "2026-09", status: "closed", reason: "Fechado", version: 2, snapshot: { ...snapshot, competence: "2026-09" }, canReview: true, canReopen: true },
  ],
};

describe.each(SKINS)("ERP ledger screens (%s skin)", (skin) => {
  it("entries: readable rows (description, formatted month), no CTA inside the list, row opens the drawer", async () => {
    mount(skin, <FinanceLedger data={entries} branches={[{ id: "b1", name: "Centro" }]} title="Recebíveis" defaultKind="agency_receivable" emptyText="Vazio" />);
    expect(screen.getAllByText("Outro recebível").length).toBeGreaterThan(0);
    expect(screen.getAllByText("dez. 2026").length).toBeGreaterThan(0);
    expect(screen.queryByText("2026-12")).toBeNull();
    expect(screen.queryByRole("button", { name: "Novo lançamento" })).toBeNull();
    openRow("Recebível sintético");
    await waitFor(() => expect(screen.getByRole("link", { name: "Abrir ficha completa" })).toHaveAttribute("href", "/financeiro/lancamentos/e1"));
    expect(actions.loadFinancialEntryAction).toHaveBeenCalledWith("e1");
    expect(screen.getByRole("button", { name: "Preparar liquidação para revisão" })).toHaveAttribute("type", "submit");
    expect(screen.getByRole("button", { name: "Enviar evidência" })).toBeInTheDocument();
  });

  it("new entry (?novo=1 from the header CTA) opens the preparation drawer with server search for the sale", () => {
    url.search = "novo=1";
    mount(skin, <FinanceLedger data={entries} branches={[]} title="Recebíveis" defaultKind="agency_receivable" emptyText="Vazio" />);
    expect(screen.getByPlaceholderText("Buscar venda pelo nome do cliente")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /Venda/ })).toBeNull();
  });

  it("entries: empty list and no CTA without preparation rights", () => {
    mount(skin, <FinanceLedger data={{ ...entries, rows: [], total: 0, canPrepare: false }} branches={null} title="Recebíveis"
      defaultKind="agency_receivable" emptyText="Falta de registro não é inadimplência." />);
    expect(screen.getAllByText("Falta de registro não é inadimplência.").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Novo lançamento" })).toBeNull();
  });

  it("entry record: KPIs and movements list, row opens the review drawer", () => {
    mount(skin, <FinancialEntryDetail detail={detail as EntryDetail} />);
    expect(screen.getAllByText("Saldo a liquidar").length).toBeGreaterThan(0);
    expect(document.querySelector("details")).toBeNull();
    act(() => { fireEvent.click(screen.getAllByText("R$ 10,00")[0]); });
    expect(screen.getByRole("button", { name: "Confirmar liquidação" })).toBeInTheDocument();
  });

  it("offsets: rows, row opens the review; ?compensar=1 opens the preparation", () => {
    mount(skin, <><OffsetPreparePanel data={offsets} /><OffsetsList data={offsets} /></>);
    expect(screen.getAllByText("Compensação da comissão COM-2").length).toBeGreaterThan(0);
    expect(screen.queryByPlaceholderText("Buscar adiantamento ou beneficiário")).toBeNull();
    openRow("Compensação da comissão COM-1");
    expect(screen.getByRole("button", { name: "Confirmar compensação" })).toBeInTheDocument();
    cleanup();
    url.search = "compensar=1";
    mount(skin, <><OffsetPreparePanel data={offsets} /><OffsetsList data={offsets} /></>);
    expect(screen.getByPlaceholderText("Buscar adiantamento ou beneficiário")).toBeInTheDocument();
  });

  it("closings: named months, row opens the snapshot with the close form; ?preparar=1 opens the preparation", () => {
    mount(skin, <ClosingsWorkspace data={closings} />);
    expect(screen.getAllByText("Setembro de 2026").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Preparar competência" })).toBeNull();
    openRow("Outubro de 2026");
    expect(screen.getByRole("button", { name: "Aprovar e fechar período" })).toHaveAttribute("type", "submit");
    cleanup();
    url.search = "preparar=1";
    mount(skin, <ClosingsWorkspace data={closings} />);
    expect(screen.getByRole("button", { name: "Preparar prévia" })).toHaveAttribute("type", "submit");
  });

  it("cash: one row per type with direction, and an explicit empty state", () => {
    mount(skin, <CashKindsList monthLabel="novembro de 2026" rows={[{ kind: "expense", cents: 4000, count: 2, incoming: false },
      { kind: "agency_receivable", cents: 9000, count: 1, incoming: true }]} />);
    expect(screen.getAllByText("Recebíveis da corretora").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Saída").length).toBeGreaterThan(0);
    cleanup();
    mount(skin, <CashKindsList monthLabel="novembro de 2026" rows={[]} />);
    expect(screen.getAllByText("Nenhum movimento confirmado neste mês").length).toBeGreaterThan(0);
  });
});

describe("finance section tabs", () => {
  it("marks the longest matching section", () => {
    const sections = [{ href: "/financeiro", label: "Financeiro" }, { href: "/financeiro/recibos", label: "Recibos" }];
    expect(activeSection(sections, "/financeiro/recibos/r1")).toBe("/financeiro/recibos");
    expect(activeSection(sections, "/financeiro/lancamentos/e1")).toBe("/financeiro");
  });
});
