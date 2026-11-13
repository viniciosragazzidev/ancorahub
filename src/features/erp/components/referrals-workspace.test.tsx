// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const search = vi.hoisted(() => ({ value: new URLSearchParams() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/indicacoes",
  useSearchParams: () => search.value,
}));
const actions = vi.hoisted(() => ({
  registerReferralAction: vi.fn(async () => ({ ok: true, message: "ok" })),
  changeReferralStatusAction: vi.fn(async () => ({ ok: true, message: "ok" })),
  linkReferralLeadAction: vi.fn<(previous: unknown, form: FormData) => Promise<{ ok: boolean; message: string }>>(
    async () => ({ ok: true, message: "Negócio vinculado à indicação." }),
  ),
  searchReferralLeadsAction: vi.fn(async () => ({ ok: true, leads: [{ id: "lead-1", name: "Negócio Carla", phoneEnd: "1234", status: "negotiation" }] })),
  getReferralTimelineAction: vi.fn(async () => ({
    ok: true,
    timeline: {
      page: 1, pageSize: 20, total: 1,
      items: [{ id: "ev1", label: "Indicação registrada", status: "Registrada", reason: null, actor: "Ana", createdAt: "2026-11-10T12:00:00Z" }],
    },
  })),
}));
vi.mock("../referral-actions", () => actions);

import { ErpSkinProvider } from "../ui/skin-context";
import type { ErpSkin } from "../ui/skin";
import { ReferralsWorkspace } from "./referrals-workspace";

afterEach(cleanup);
const SKINS: ErpSkin[] = ["standard", "lite"];
const mount = (skin: ErpSkin, ui: ReactElement) => render(<ErpSkinProvider skin={skin}>{ui}</ErpSkinProvider>);

const row = {
  id: "r1", referrerName: "Ana Indicadora", referrerContact: "", channel: "cliente", referredName: "Bruno Indicado", referredPhone: "(21) 99999-0000",
  consent: true, notes: "", branchId: "b1", ownerId: "u1", ownerName: "Ana", leadId: null, leadName: null, status: "validated" as const,
  lostReason: "", version: 2, createdAt: "2026-11-10T12:00:00.000Z", statusLabel: "Validada", channelLabel: "Cliente",
  nextStatuses: [{ value: "contacting" as const, label: "Em contato" }], canLink: true, canOpenLead: false,
};
const workspace = {
  filters: { q: "", status: "all" as const, page: 1, id: undefined }, total: 1, pageSize: 25, summary: { fresh: 1, active: 0, converted: 0, closed: 0 }, canManage: true, canAssignOwner: true,
  members: [{ id: "u1", name: "Ana" }], currentUserId: "u1", statusOptions: [], channelOptions: [{ value: "cliente" as const, label: "Cliente" }], rows: [row],
};

describe.each(SKINS)("Indicações (%s skin)", (skin) => {
  it("renders the numbers and the list, and opens the drawer with the history of that referral only", async () => {
    mount(skin, <ReferralsWorkspace workspace={workspace} />);
    expect(screen.getAllByText("Bruno Indicado").length).toBeGreaterThan(0);
    expect(screen.getByText("Em andamento")).toBeInTheDocument();
    act(() => { fireEvent.click(screen.getAllByText("Bruno Indicado")[0]); });
    await waitFor(() => expect(screen.getByText(/Indicação registrada · Registrada/)).toBeInTheDocument());
    expect(actions.getReferralTimelineAction).toHaveBeenCalledWith("r1", 1);
  });

  it("opens Nova indicação from the URL (?novo=1)", () => {
    search.value = new URLSearchParams("novo=1");
    mount(skin, <ReferralsWorkspace workspace={workspace} />);
    search.value = new URLSearchParams();
    expect(screen.getByRole("button", { name: "Registrar indicação" })).toHaveAttribute("type", "submit");
  });

  it("links a lead by search + add", async () => {
    mount(skin, <ReferralsWorkspace workspace={workspace} />);
    act(() => { fireEvent.click(screen.getAllByText("Bruno Indicado")[0]); });
    fireEvent.change(screen.getByPlaceholderText("Buscar negócio por nome ou telefone"), { target: { value: "Carla" } });
    const add = await screen.findByRole("button", { name: "Adicionar Negócio Carla" }, { timeout: 2000 });
    await act(async () => { fireEvent.click(add); });
    expect(actions.searchReferralLeadsAction).toHaveBeenCalledWith("Carla", true);
    await waitFor(() => expect(actions.linkReferralLeadAction).toHaveBeenCalled());
    const form = actions.linkReferralLeadAction.mock.calls.at(-1)?.[1];
    expect(form?.get("leadId")).toBe("lead-1");
  });
});
