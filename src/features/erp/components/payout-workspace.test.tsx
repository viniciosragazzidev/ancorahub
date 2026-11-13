// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
let search = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/financeiro/repasses",
  useSearchParams: () => search,
}));
vi.mock("../payout-actions", () => ({
  preparePayoutAction: vi.fn(async () => ({ ok: true, message: "ok", id: "p-new" })),
  reviewPayoutAction: vi.fn(async () => ({ ok: true, message: "" })),
  registerPayoutPaymentAction: vi.fn(async () => ({ ok: true, message: "" })),
  confirmPayoutPaymentAction: vi.fn(async () => ({ ok: true, message: "" })),
}));
vi.mock("../commission-actions", () => ({ bringScheduleAction: vi.fn(async () => ({ ok: true, message: "" })) }));
vi.mock("../client-file-request", () => ({ submitErpFile: vi.fn(async () => ({ ok: true, message: "" })) }));
vi.mock("./finance-workspace", () => ({ FinanceFeedback: ({ result }: { result: { message: string } }) => result.message ? <p>{result.message}</p> : null }));

import { ErpSkinProvider } from "../ui/skin-context";
import type { ErpSkin } from "../ui/skin";
import { CommissionsList } from "./commission-list";
import { PayoutsList } from "./payout-workspace";
import { ReceiptsList } from "./payout-receipts";
import { ReconciliationList } from "./reconciliation-list";
import type { PayoutDetailData } from "./payout-detail";

afterEach(() => {
  cleanup();
  push.mockClear();
  search = new URLSearchParams();
});

const SKINS: ErpSkin[] = ["standard", "lite"];
const mount = (skin: ErpSkin, ui: ReactElement) => render(<ErpSkinProvider skin={skin}>{ui}</ErpSkinProvider>);
const openRow = (text: string) => act(() => { fireEvent.click(screen.getAllByText(text)[0]); });

const payoutRows = [
  { id: "p1", beneficiaryName: "Ana Souza", competence: "2026-11", status: "prepared", netCents: 15025, grossCents: 15025, receiptNumber: null, occurredOn: null },
  { id: "p2", beneficiaryName: "Bruno Lima", competence: "2026-10", status: "settled", netCents: 5000, grossCents: 5000, receiptNumber: "RP-2026-000001", occurredOn: "2026-11-12" },
];
const payoutList = { filters: { status: "all" as const, competence: undefined, q: "", page: 1 }, agency: true, total: 2, pageSize: 25, canPrepare: true, rows: payoutRows,
  summary: { prepared: 1, approved: 0, paying: 0, settled: 1, settledCents: 5000, openCents: 15025 } };
const detail: PayoutDetailData = {
  id: "p1", status: "prepared", version: 1, competence: "2026-11", beneficiaryName: "Ana Souza", grossCents: 15025, netCents: 15025, occurredOn: null,
  reason: null, receiptNumber: null, agency: true, documents: [], reversedCents: 2000,
  items: [{ entryId: "e1", reference: "cronograma:1", description: "Parcela 1", amountCents: 10000, balanceCents: 10000 }],
  canApprove: true, canCancel: true, canRegisterPayment: false, canConfirmPayment: false,
};

describe.each(SKINS)("ERP payouts screens (%s skin)", (skin) => {
  it("payouts: rows (named month, receipt as second line), no CTA inside the list, drawer with the step and the reversed amount", () => {
    search = new URLSearchParams("repasse=p1");
    mount(skin, <PayoutsList data={payoutList} candidates={null} detail={detail} detailMissing={false} />);
    expect(screen.getAllByText("Bruno Lima").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Recibo RP-2026-000001").length).toBeGreaterThan(0);
    expect(screen.getAllByText("out. 2026").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Preparar repasse" })).toBeNull();
    expect(screen.getByRole("button", { name: "Aprovar repasse" })).toBeInTheDocument();
    expect(screen.getAllByText(/Estornado depois da emissão/).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Abrir ficha completa" })).toBeInTheDocument();
  });

  it("payouts: clicking a row opens the drawer and puts the record in the URL", () => {
    mount(skin, <PayoutsList data={payoutList} candidates={null} detail={null} detailMissing={false} />);
    openRow("Bruno Lima");
    expect(push).toHaveBeenCalledWith("/financeiro/repasses?repasse=p2", { scroll: false });
    expect(screen.getByText("Carregando repasse…")).toBeInTheDocument();
  });

  it("prepare drawer adds commissions by search + and shows the truncated note", () => {
    search = new URLSearchParams("preparar=1");
    const candidates = { competence: null, truncated: true, groups: [{ beneficiaryId: "b1", name: "Ana Souza", items: [
      { id: "11111111-1111-4111-8111-111111111111", reference: "COM-1", description: "Parcela 1", competence: "2026-11", dueOn: "2026-11-10", amountCents: 10000, balanceCents: 10000 },
    ] }] };
    mount(skin, <PayoutsList data={payoutList} candidates={candidates} detail={null} detailMissing={false} />);
    expect(screen.getByText(/primeiras 500 comissões/)).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).toBeNull();
    fireEvent.change(screen.getByPlaceholderText("Buscar comissão por referência ou descrição"), { target: { value: "COM" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar COM-1" }));
    expect(screen.getByRole("button", { name: "Remover COM-1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Preparar para aprovação" })).toBeEnabled();
  });

  it("commissions: rows, row opens drawer with the ERP summary and 'Conferir no ERP' only inside it", () => {
    const row = { id: "c1", saleId: "s1", monthNumber: 1, referenceMonth: "2026-10", percentage: "10.00", amount: "100.00", legacyStatus: "pending" as const,
      clientName: "Cliente Teste", brokerId: "u1", brokerName: "Ana Souza", saleStatus: "active" as const, expectedCents: 10000, entry: null,
      paidCents: 0, offsetCents: 0, divergence: null, divergenceLabel: null };
    const data = { filters: { competence: undefined, q: "", page: 1 }, total: 1, pageSize: 25, agency: true, canBring: true, rows: [row],
      summary: { installments: 1, expectedCents: 10000, conferred: 0, pendingLegacy: 1 } };
    mount(skin, <CommissionsList data={data} />);
    expect(screen.queryByRole("button", { name: "Conferir no ERP" })).toBeNull();
    openRow("Cliente Teste");
    expect(screen.getByRole("button", { name: "Conferir no ERP" })).toBeInTheDocument();
  });

  it("receipts: row opens the preview with print link and reversed amount", () => {
    search = new URLSearchParams("recibo=p2");
    const data = { ...payoutList, canPrepare: false, rows: [payoutRows[1]] };
    const preview = { id: "p2", digest: "a".repeat(64), reversedCents: 1500, receipt: { version: 1 as const, number: "RP-2026-000001", issuedAt: "2026-11-12T12:00:00.000Z",
      competence: "2026-10", occurredOn: "2026-11-12", beneficiary: { id: "u2", name: "Bruno Lima" }, branchName: null, issuer: { id: "u3", name: "Revisor" },
      items: [], grossCents: 5000, offsetCents: 0, netCents: 5000 } };
    mount(skin, <ReceiptsList data={data} preview={preview} previewMissing={false} />);
    expect(screen.getAllByText("RP-2026-000001").length).toBeGreaterThan(0);
    expect(screen.queryByText("2026-10")).toBeNull();
    expect(screen.getByRole("link", { name: "Abrir para imprimir" })).toBeInTheDocument();
    expect(screen.getAllByText(/Estornado depois da emissão/).length).toBeGreaterThan(0);
  });

  it("reconciliation: one list with group badge, counts and drawer with the resolve link", () => {
    const issues = [
      { key: "e-1", group: "evidence" as const, title: "Comissão · REF-1", detail: "Anexe a evidência.", href: "/financeiro/lancamentos/1", amountCents: 100 },
      { key: "v-2", group: "overdue" as const, title: "Recebível · REF-2", detail: "Venceu.", href: "/financeiro/lancamentos/2", amountCents: null },
    ];
    const groups = [
      { key: "evidence" as const, label: "Sem evidência", count: 1 }, { key: "approval" as const, label: "Aguardando aprovação", count: 0 },
      { key: "movement" as const, label: "Movimentos", count: 0 }, { key: "overdue" as const, label: "Vencidos", count: 1 },
      { key: "legacy" as const, label: "Divergências", count: 0 },
    ];
    mount(skin, <ReconciliationList issues={issues} groups={groups} group="all" page={1} total={2} pageSize={25} truncated calculatedAt="2026-11-12T12:00:00.000Z" />);
    expect(screen.getByText(/300 itens mais antigos/)).toBeInTheDocument();
    openRow("Recebível · REF-2");
    expect(screen.getByRole("link", { name: "Abrir para resolver" })).toBeInTheDocument();
  });
});
