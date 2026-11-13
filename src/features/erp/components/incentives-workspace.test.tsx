// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps, ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const search = vi.hoisted(() => ({ value: "" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/campanhas-incentivo",
  useSearchParams: () => new URLSearchParams(search.value),
}));
const detail = vi.hoisted(() => ({ value: null as unknown }));
const actions = vi.hoisted(() => ({
  saveIncentiveCampaignAction: vi.fn(),
  approveIncentiveCampaignAction: vi.fn(),
  cancelIncentiveCampaignAction: vi.fn(),
  runIncentiveCalculationAction: vi.fn(async () => ({ ok: true, message: "Apuração prévia registrada." })),
  contestIncentiveResultAction: vi.fn(),
  getIncentiveCampaignAction: vi.fn<(id: string) => Promise<{ ok: true; data: unknown }>>(async () => ({ ok: true, data: detail.value })),
}));
vi.mock("../incentive-actions", () => actions);

import { ErpSkinProvider } from "../ui/skin-context";
import type { ErpSkin } from "../ui/skin";
import { IncentiveCampaignDetail, IncentivesWorkspace } from "./incentives-workspace";

afterEach(() => { cleanup(); search.value = ""; });
const SKINS: ErpSkin[] = ["standard", "lite"];
const mount = (skin: ErpSkin, ui: ReactElement) => render(<ErpSkinProvider skin={skin}>{ui}</ErpSkinProvider>);

const campaign = {
  id: "c1", name: "Campanha Novembro", regulation: "Regulamento sintético da campanha.", metric: "sales_count" as const, startsOn: "2026-11-01",
  endsOn: "2026-11-30", branchIds: [] as string[], prize: "Troféu", showNames: false, status: "approved" as const, reason: "", version: 1,
};
const data: ComponentProps<typeof IncentivesWorkspace>["data"] = {
  filters: { status: "all" as const, q: "", page: 1 }, total: 1, pageSize: 25, canManage: true, today: "2026-11-12", branches: [],
  summary: { running: 1, awaitingApproval: 0, awaitingFinal: 0, closed: 0 },
  rows: [{ ...campaign, lastCalculatedAt: null }],
};
const detailData: ComponentProps<typeof IncentiveCampaignDetail>["data"] = {
  campaign: { ...campaign, branchNames: [], preparedBy: "Ana", approvedBy: "Bruno" }, today: "2026-11-12", canManage: true, branches: [],
  can: { edit: false, approve: false, preliminary: true, final: false, cancel: true, contest: false }, preparedByViewer: false,
  latest: {
    id: "res1", kind: "preliminary", createdAt: "2026-11-11T12:00:00Z", campaignVersion: 1, metric: "sales_count" as const,
    ranking: [{ position: 1, label: "Corretor 1", isViewer: false, value: 3 }, { position: 2, label: "Você", isViewer: true, value: 1 }],
  },
  history: [{ id: "res1", kind: "preliminary", campaignVersion: 1, digest: "abcdef123456", createdAt: "2026-11-11T12:00:00Z", createdBy: "Ana" }],
  historyPage: 1, historyTotal: 1, pageSize: 25, contestations: [],
};
detail.value = detailData;

describe.each(SKINS)("Campanhas de incentivo (%s skin)", (skin) => {
  it("lists campaigns (the CTA lives in the page header) and the row opens the drawer with regulation, actions and ranking", async () => {
    mount(skin, <IncentivesWorkspace data={data} />);
    expect(screen.getAllByText("Campanha Novembro").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1 campanha").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Nova campanha" })).toBeNull();
    act(() => { fireEvent.click(screen.getAllByText("Campanha Novembro")[0]); });
    await waitFor(() => expect(screen.getByText("Regulamento sintético da campanha.")).toBeInTheDocument());
    expect(actions.getIncentiveCampaignAction).toHaveBeenCalledWith("c1");
    expect(screen.getByRole("button", { name: "Apuração prévia" })).toBeInTheDocument();
    expect(screen.getAllByText(/Corretor 1/).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Abrir ficha completa" })).toBeInTheDocument();
  });

  it("opens the create drawer from the header link (?novo=1) only for managers", () => {
    search.value = "novo=1";
    mount(skin, <IncentivesWorkspace data={data} />);
    expect(screen.getByRole("button", { name: "Criar rascunho" })).toBeInTheDocument();
    cleanup();
    mount(skin, <IncentivesWorkspace data={{ ...data, canManage: false }} />);
    expect(screen.queryByRole("button", { name: "Criar rascunho" })).toBeNull();
  });

  it("full view renders ranking and apuração history lists", () => {
    mount(skin, <IncentiveCampaignDetail data={detailData} />);
    expect(screen.getAllByText("Você").length).toBeGreaterThan(0);
    expect(screen.getAllByText("abcdef123456").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Nenhuma contestação").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Participantes no ranking").length).toBeGreaterThan(0);
  });
});
