// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), setMode: vi.fn(), saveRoute: vi.fn(), saveConversions: vi.fn(), sync: vi.fn(), disconnect: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }), usePathname: () => "/marketing/campanhas" }));
vi.mock("@/components/ui/sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }));
vi.mock("../../actions", () => ({ setMetaGlobalCaptureModeAction: mocks.setMode, triggerManualMetaSync: mocks.sync, disconnectMetaConnection: mocks.disconnect, confirmMetaConnection: vi.fn(), getMetaMarketingAttemptAssets: vi.fn(), recordMetaMarketingOnboardingStep: vi.fn() }));
vi.mock("@/features/lead-distribution/actions", () => ({ saveMetaCampaignQueueRouteAction: mocks.saveRoute }));
vi.mock("../../meta-conversion-actions", () => ({ saveMetaConversionSettingsAction: mocks.saveConversions }));

import { CampaignsDashboardView } from "../campaigns-dashboard-view";
import { CampaignDetailView } from "../campaign-detail-view";
import { CampaignsLite } from "./campaigns-lite";
import { CampaignDetailLite } from "./campaign-detail-lite";
import { CaptureControlLite } from "./capture-control-lite";
import { MetaConversionsLite } from "./meta-conversions-lite";
import { MetaIntegrationLite } from "./meta-integration-lite";
import { buildMetaSyncInfo } from "./meta-lite-shared";
import { META_ASSETS_FIXTURE, META_CAMPAIGNS_FIXTURE, META_CONNECTION_FIXTURE, META_CONVERSIONS_FIXTURE, META_DETAIL_ADS_FIXTURE, META_DETAIL_FORMS_FIXTURE, META_LOGS_FIXTURE, META_QUEUES_FIXTURE, META_TOTALS_FIXTURE } from "./meta-fixtures";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("telas Meta com a chave desligada", () => {
  it("campanhas e detalhe preservam o HTML legado", () => {
    const list = render(<CampaignsDashboardView campaigns={META_CAMPAIGNS_FIXTURE} totals={META_TOTALS_FIXTURE} />);
    expect(list.container.innerHTML).toMatchSnapshot();
    cleanup();
    const detail = render(<CampaignDetailView campaign={META_CAMPAIGNS_FIXTURE[0]!} ads={META_DETAIL_ADS_FIXTURE} forms={META_DETAIL_FORMS_FIXTURE} queues={META_QUEUES_FIXTURE} initialQueueId="queue-pf" initialCaptureEnabled canConfigureCapture canDisableCapture />);
    expect(detail.container.innerHTML).toMatchSnapshot();
  });
});

describe("campanhas no visual Lite", () => {
  it("mesmos números, mesmo filtro (ativas ou com atendimento) e linha que abre o detalhe", () => {
    render(<CampaignsLite campaigns={META_CAMPAIGNS_FIXTURE} totals={META_TOTALS_FIXTURE} />);
    expect(screen.getByText("Leads capturados").nextSibling).toHaveTextContent("2.534");
    expect(screen.getByText("Campanhas ativas").nextSibling).toHaveTextContent("5");
    // A pausada sem atendimento some, como na tela atual; a pausada com atendimento continua.
    expect(screen.getAllByText(/Institucional Âncora Saúde/).length).toBeGreaterThan(0);
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar campanha" }), { target: { value: "bradesco" } });
    const tables = screen.getAllByRole("table");
    expect(tables).toHaveLength(1);
    fireEvent.click(within(tables[0]!).getAllByRole("row")[1]!);
    expect(mocks.push).toHaveBeenCalledWith("/marketing/campanhas/camp-2");
  });

  it("anúncios abrem no painel lateral", () => {
    render(<CampaignsLite campaigns={META_CAMPAIGNS_FIXTURE} totals={META_TOTALS_FIXTURE} />);
    fireEvent.click(within(screen.getAllByRole("table")[0]!).getAllByRole("button", { name: "2 anúncios" })[0]!);
    expect(screen.getByRole("dialog", { name: /Anúncios de/ })).toBeInTheDocument();
  });

  it("controle global chama a mesma action", async () => {
    mocks.setMode.mockResolvedValue({ success: true });
    render(<CaptureControlLite globalMode="selective" canConfigure />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Pausar toda a captura" })); });
    expect(mocks.setMode).toHaveBeenCalledWith({ mode: "disabled" });
    expect(screen.getByText("Captura pausada")).toBeInTheDocument();
  });

  it("resumo da sincronização no fuso de São Paulo", () => {
    const info = buildMetaSyncInfo(META_LOGS_FIXTURE, META_CONNECTION_FIXTURE.lastSyncedAt, true, new Date("2026-10-25T14:40:00.000Z"));
    expect(info.label).toBe("Concluída");
    expect(info.title).toBe("Última sincronização: 25/10/2026, 10:40");
  });
});

describe("detalhe da campanha no visual Lite", () => {
  it("salva fila e captura pela mesma action e trava como a tela atual", async () => {
    mocks.saveRoute.mockResolvedValue({ success: true });
    render(<CampaignDetailLite campaign={META_CAMPAIGNS_FIXTURE[0]!} ads={META_DETAIL_ADS_FIXTURE} forms={META_DETAIL_FORMS_FIXTURE} queues={META_QUEUES_FIXTURE} initialQueueId="queue-pf" initialCaptureEnabled canConfigureCapture canDisableCapture={false} />);
    expect(screen.getByRole("switch", { name: "Pausar captura da campanha" })).toBeDisabled();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Salvar configuração" })); });
    expect(mocks.saveRoute).toHaveBeenCalledWith({ campaignId: META_CAMPAIGNS_FIXTURE[0]!.campaignId, queueId: "queue-pf", enabled: true });
    expect(screen.getByText("Status não sincronizado")).toBeInTheDocument();
  });
});

describe("integração Meta no visual Lite", () => {
  it("sincroniza e pede confirmação antes de desconectar", async () => {
    mocks.sync.mockResolvedValue({ success: true });
    mocks.disconnect.mockResolvedValue(undefined);
    render(<MetaIntegrationLite connection={META_CONNECTION_FIXTURE} assets={META_ASSETS_FIXTURE} sync={null} captureModeLabel="Captura seletiva" canConfigure />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Sincronizar" })); });
    expect(mocks.sync).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Desconectar" }));
    const dialog = screen.getByRole("alertdialog", { name: "Desconectar Marketing da Meta?" });
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Desconectar" })); });
    expect(mocks.disconnect).toHaveBeenCalled();
    // 18 formulários: só a lista de ativos pagina; o mapa só entra no DOM quando aberto.
    expect(screen.queryByLabelText("Mapa de ativos Meta")).not.toBeInTheDocument();
  });

  it("conversões: salvar só com mudança e pela mesma action", async () => {
    mocks.saveConversions.mockResolvedValue({ success: true, backfilled: 0 });
    render(<MetaConversionsLite panel={META_CONVERSIONS_FIXTURE} datasets={[{ id: "556677889900", name: "Conversões CRM Âncora" }]} />);
    const save = screen.getByRole("button", { name: "Salvar" });
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Código de teste (opcional)"), { target: { value: "TEST1" } });
    await act(async () => { fireEvent.click(save); });
    expect(mocks.saveConversions).toHaveBeenCalledWith({ enabled: true, datasetId: "556677889900", testEventCode: "TEST1" });
  });
});
