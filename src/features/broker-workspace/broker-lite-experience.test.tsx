// @vitest-environment jsdom
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ pathname: "/minha-fila", search: "", push: vi.fn(), back: vi.fn(), replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useSearchParams: () => new URLSearchParams(navigation.search),
  useRouter: () => ({ push: navigation.push, back: navigation.back, replace: navigation.replace, refresh: vi.fn(), prefetch: vi.fn() }),
}));
// The Arc sheet drives Motion springs that the global jsdom mock of motion/react does not implement.
vi.mock("@/components/arc/bottom-sheet/bottom-sheet", () => ({
  BottomSheet: ({ open, title, children }: { open?: boolean; title: string; children: React.ReactNode }) =>
    open ? <div role="dialog" aria-label={title}>{children}</div> : null,
}));
vi.mock("@/components/arc/segmented-control/segmented-control", () => ({
  default: ({ label, options, value, onValueChange }: { label?: string; options: { value: string; label: string }[]; value: string; onValueChange: (value: string) => void }) => (
    <div role="group" aria-label={label}>
      {options.map((option) => (
        <button key={option.value} type="button" aria-pressed={option.value === value} onClick={() => onValueChange(option.value)}>{option.label}</button>
      ))}
    </div>
  ),
}));
vi.mock("@/components/arc/avatar/avatar", () => ({ Avatar: ({ name }: { name: string }) => <span role="img" aria-label={name} /> }));
vi.mock("@/components/arc/button/button", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button type="button" {...props}>{children}</button>,
}));
vi.mock("@/shared/auth/client", () => ({ signOut: vi.fn() }));
vi.mock("@/features/leads/availability-action", () => ({
  updateBrokerAvailabilityAction: vi.fn(),
}));

import { LightBackButton } from "@/components/light/light-back-button";
import { LightChrome } from "@/components/light/light-chrome";
import { useLightAvailabilityContext } from "@/components/light/light-availability-context";

function renderChrome(props: Partial<Parameters<typeof LightChrome>[0]> = {}, content: ReactNode = <p>conteúdo da tela</p>) {
  return render(
    <LightChrome
      branding={{ tenantName: "Corretora", logoUrl: null }}
      user={{ name: "Corretor Teste", email: "corretor@example.test" }}
      {...props}
    >
      {content}
    </LightChrome>,
  );
}

/** The chat home's avatar button opens the Mais sheet through the shell context. */
function MoreOpener() {
  const shell = useLightAvailabilityContext();
  return <button type="button" onClick={() => shell?.openMore?.()}>Abrir Mais</button>;
}

afterEach(() => {
  cleanup();
  // The home (/dashboard) is a chat screen without the tab bar since the 2026-10-09 redesign.
  navigation.pathname = "/minha-fila";
  navigation.search = "";
  vi.clearAllMocks();
});

describe("Corretor Lite experience contract", () => {
  it("resolves the Lite dashboard before entering the shared reporting center", () => {
    const source = readFileSync(
      join(process.cwd(), "src/app/(dashboard)/dashboard/page.tsx"),
      "utf8",
    );

    const modeLookup = source.indexOf("getExperienceMode(context)");
    const lightDashboard = source.indexOf("<ChatHomeContent");
    const reportingLookup = source.indexOf("getCommandCenterData(context)");

    expect(modeLookup).toBeGreaterThan(-1);
    expect(lightDashboard).toBeGreaterThan(modeLookup);
    expect(reportingLookup).toBeGreaterThan(lightDashboard);
  });

  it("has no side rail or bottom bar on any screen: Início (the conversations) is the navigation", () => {
    renderChrome({ queueBadgeCount: 3 });
    expect(screen.queryByRole("navigation", { name: "Navegação principal" })).toBeNull();
    expect(screen.queryByRole("link", { name: /Fila, 3 pendentes/ })).toBeNull();
  });

  it("opens the Mais sheet (from the chat home avatar) with the destinations, availability and sign out", () => {
    renderChrome({ showQuoteSimulator: true, showDutyCalendar: true }, <MoreOpener />);

    fireEvent.click(screen.getByRole("button", { name: "Abrir Mais" }));

    const dialog = screen.getByRole("dialog");
    const destinations = within(dialog).getByRole("navigation", { name: "Mais destinos" });
    for (const href of ["/cotacao", "/plantoes", "/clientes", "/notificacoes", "/settings"]) {
      expect(destinations.querySelector(`a[href="${href}"]`)).not.toBeNull();
    }
    expect(within(dialog).getByText("Disponibilidade")).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: /Sair da conta/ })).toBeTruthy();
  });

  it("hides Cotação and Plantões from Mais when their capabilities are off", () => {
    renderChrome({}, <MoreOpener />);

    fireEvent.click(screen.getByRole("button", { name: "Abrir Mais" }));

    const destinations = within(screen.getByRole("dialog")).getByRole("navigation", { name: "Mais destinos" });
    expect(destinations.querySelector('a[href="/cotacao"]')).toBeNull();
    expect(destinations.querySelector('a[href="/plantoes"]')).toBeNull();
    expect(destinations.querySelector('a[href="/clientes"]')).not.toBeNull();
  });

  it("shows back and the screen title on internal screens, the queue included", () => {
    // The lead itself is a chat with its own header; its feedback form uses the app header.
    navigation.pathname = "/leads/abc/feedback";
    const internal = renderChrome();
    expect(screen.getByRole("button", { name: "Voltar" })).toBeTruthy();
    expect(screen.getByText("Atualização")).toBeTruthy();
    internal.unmount();

    navigation.pathname = "/minha-fila";
    renderChrome();
    expect(screen.getByRole("button", { name: "Voltar" })).toBeTruthy();
  });

  it("goes to the parent route when there is no in-app history", () => {
    render(<LightBackButton fallbackHref="/minha-fila" />);

    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));

    // Replace, not push: a later back never returns to the screen we left.
    expect(navigation.replace).toHaveBeenCalledWith("/minha-fila");
    expect(navigation.back).not.toHaveBeenCalled();
  });

  it("keeps the Light shell free of the hamburger menu, the bottom bar and the side rail", () => {
    const shellSource = readFileSync(join(process.cwd(), "src/components/app-shell.tsx"), "utf8");
    const topNavSource = readFileSync(join(process.cwd(), "src/components/light-top-nav.tsx"), "utf8");
    const chromeSource = readFileSync(join(process.cwd(), "src/components/light/light-chrome.tsx"), "utf8");

    expect(shellSource).toContain("<LightChrome");
    expect(shellSource).not.toContain("LightTopNavBar");
    expect(topNavSource).not.toContain("Menu mobile");
    expect(chromeSource).not.toContain("<LightBottomNav");
    expect(chromeSource).not.toContain("<LightSideRail");
  });

  it("draws no tab bar or app header on the chat home: the conversation list is the navigation", () => {
    navigation.pathname = "/dashboard";
    renderChrome();
    expect(screen.queryByRole("navigation", { name: "Navegação principal" })).toBeNull();
  });
});
