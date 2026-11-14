// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/features/leads/accept-offer-action", () => ({ acceptLeadOfferAction: vi.fn() }));
import {
  LightAvailabilityProvider,
  type LightAvailabilityValue,
} from "@/components/light/light-availability-context";
import { BrokerHomeOverview } from "./broker-home-overview";
import type { HomeSummary } from "./chat-home";

const summary: HomeSummary = {
  receivedToday: 8,
  acceptedToday: 6,
  inServiceNow: 4,
  slaAtRiskNow: 1,
  duty: null,
  goal: null,
  now: {
    title: "Agora",
    emptyText: "Em dia",
    items: [
      {
        id: "one",
        title: "Cliente de demonstração",
        detail: "Oferta recebida",
        actionLabel: "Aceitar e chamar",
        href: "/leads/one",
        acceptLeadId: "one",
        expiresAt: "2026-11-13T16:08:00Z",
        tone: "urgent",
      },
      {
        id: "two",
        title: "Outro atendimento",
        detail: "Aguardando resposta",
        actionLabel: "Responder",
        href: "/leads/two",
      },
    ],
  },
};
const shell: LightAvailabilityValue = {
  availability: "available",
  isPending: false,
  setStatus: vi.fn(),
  openMore: vi.fn(),
  homeTools: [{ label: "Clientes", href: "/clientes" }],
};
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
function show(value = summary, overrides: Partial<LightAvailabilityValue> = {}) {
  return render(
    <LightAvailabilityProvider value={{ ...shell, ...overrides }}>
      <BrokerHomeOverview
        viewerName="Corretor Demo"
        nowIso="2026-11-13T16:00:00Z"
        summary={value}
        nextLead={null}
        rail={null}
        conversations={null}
        presenceAsks={[]}
        learning={<p>Aprendizagem existente</p>}
        onSearch={vi.fn()} onNew={vi.fn()}
      />
    </LightAvailabilityProvider>,
  );
}
describe("Home operacional do corretor", () => {
  it("mostra um único aceite principal e mantém a outra pendência secundária", async () => {
    show();
    // O aceite principal avisa a oferta pendente no próprio rótulo; só ele.
    expect(await screen.findAllByRole("button", { name: "Oferta pendente: Aceitar e chamar" })).toHaveLength(1);
    expect(screen.queryAllByRole("button", { name: "Aceitar e chamar" })).toHaveLength(0);
    expect(screen.getByRole("heading", { name: "Cliente de demonstração" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Responder/ }).getAttribute("href")).toBe("/leads/two");
    expect(screen.getByText("Aceite em até 8 min")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Cotação" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ferramentas" }));
    expect(shell.openMore).toHaveBeenCalledOnce();
  });
  it("foco: só o próximo passo é primário; aceites da lista ficam secundários", async () => {
    show({
      ...summary,
      now: {
        title: "Agora",
        emptyText: "",
        items: [
          summary.now!.items[0]!,
          { ...summary.now!.items[0]!, id: "three", title: "Segunda oferta", acceptLeadId: "three", actionLabel: "Aceitar segunda" },
        ],
      },
    });
    const main = await screen.findByRole("button", { name: "Oferta pendente: Aceitar e chamar" });
    const listed = await screen.findByRole("button", { name: "Aceitar segunda" });
    expect(main.className).not.toMatch(/secondaryAction/);
    expect(listed.className).toMatch(/secondaryAction/);
    // Só o principal pulsa: o da lista não tem o estado de oferta pendente.
    expect(main.getAttribute("data-offer-pending")).toBe("true");
    expect(listed.hasAttribute("data-offer-pending")).toBe(false);
    expect(screen.getByRole("button", { name: "Ferramentas" }).className).toMatch(/ghost/);
  });
  it("não oferece aceite para oferta expirada", async () => {
    show({
      ...summary,
      now: {
        title: "Agora",
        emptyText: "",
        items: [{ ...summary.now!.items[0]!, expiresAt: "2026-11-13T15:59:00Z" }],
      },
    });
    expect(
      (await screen.findByRole<HTMLButtonElement>("button", { name: "Oferta encerrada" })).disabled,
    ).toBe(true);
    expect(screen.getByRole("link", { name: "Atualizar minha fila" })).toBeTruthy();
  });
  it("explica pausa e esconde aprendizagem quando desativada", () => {
    show(summary, { availability: "paused", showHomeLearning: false });
    fireEvent.click(screen.getByRole("button", { name: "Ficar disponível" }));
    expect(shell.setStatus).toHaveBeenCalledWith("available", { inlineError: true });
    expect(screen.queryByText("Aprendizagem existente")).toBeNull();
  });
  it("confirma no próprio lugar quando o servidor tira a pausa", () => {
    const view = show(summary, { availability: "paused" });
    fireEvent.click(screen.getByRole("button", { name: "Ficar disponível" }));
    view.rerender(
      <LightAvailabilityProvider value={{ ...shell, availability: "available" }}>
        <BrokerHomeOverview viewerName="Corretor Demo" nowIso="2026-11-13T16:00:00Z" summary={summary} nextLead={null} rail={null} conversations={null} presenceAsks={[]} learning={null} onSearch={vi.fn()} onNew={vi.fn()} />
      </LightAvailabilityProvider>,
    );
    expect(screen.getByText("Você está disponível. Novas ofertas voltam a chegar.")).toBeTruthy();
  });
  it("falha ao tirar a pausa mostra a causa e tentar de novo", () => {
    const view = show(summary, { availability: "paused" });
    fireEvent.click(screen.getByRole("button", { name: "Ficar disponível" }));
    view.rerender(
      <LightAvailabilityProvider value={{ ...shell, availability: "paused", error: "Sem conexão agora. Você continua pausado." }}>
        <BrokerHomeOverview viewerName="Corretor Demo" nowIso="2026-11-13T16:00:00Z" summary={summary} nextLead={null} rail={null} conversations={null} presenceAsks={[]} learning={null} onSearch={vi.fn()} onNew={vi.fn()} />
      </LightAvailabilityProvider>,
    );
    expect(screen.getByRole("alert").textContent).toBe("Sem conexão agora. Você continua pausado.");
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeTruthy();
  });
  it("oferece próximo destino útil sem inventar urgência no vazio", () => {
    show({ ...summary, now: { title: "Agora", emptyText: "", items: [] } });
    expect(screen.getByRole("heading", { name: "Tudo em dia por aqui." })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Aceitar e chamar" })).toBeNull();
    expect(screen.getByRole("link", { name: /Abrir minha fila/ }).getAttribute("href")).toBe(
      "/leads?tab=minha-fila",
    );
  });
});
