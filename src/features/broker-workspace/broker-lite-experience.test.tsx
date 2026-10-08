// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ pathname: "/dashboard", search: "", push: vi.fn(), back: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useSearchParams: () => new URLSearchParams(navigation.search),
  useRouter: () => ({ push: navigation.push, back: navigation.back, replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
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
import { LIGHT_TABS } from "@/components/light/light-routes";

function renderChrome(props: Partial<Parameters<typeof LightChrome>[0]> = {}) {
  return render(
    <LightChrome
      branding={{ tenantName: "Corretora", logoUrl: null }}
      user={{ name: "Corretor Teste", email: "corretor@example.test" }}
      {...props}
    >
      <p>conteúdo da tela</p>
    </LightChrome>,
  );
}

function bottomBar() {
  // The rail (md+) and the floating bar share the landmark name; the bar is the last one in the DOM.
  const bars = screen.getAllByRole("navigation", { name: "Navegação principal" });
  return bars[bars.length - 1];
}

afterEach(() => {
  cleanup();
  navigation.pathname = "/dashboard";
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
    const lightDashboard = source.indexOf("<LightDashboard");
    const reportingLookup = source.indexOf("getDashboardViewModel(context, period)");

    expect(modeLookup).toBeGreaterThan(-1);
    expect(lightDashboard).toBeGreaterThan(modeLookup);
    expect(reportingLookup).toBeGreaterThan(lightDashboard);
  });

  it("shows Início, Fila, Insights and Mais in the floating bottom bar with the active tab marked", () => {
    renderChrome();

    const bar = bottomBar();
    for (const tab of LIGHT_TABS) {
      expect(bar.querySelector(`a[href="${tab.href}"]`)).not.toBeNull();
    }
    expect(within(bar).getByRole("button", { name: "Mais" })).toBeTruthy();
    expect(bar.querySelector('a[aria-current="page"]')?.getAttribute("href")).toBe("/dashboard");
  });

  it("badges the Fila tab with the number of leads waiting for acceptance", () => {
    renderChrome({ queueBadgeCount: 3 });

    expect(within(bottomBar()).getByRole("link", { name: "Fila, 3 pendentes" })).toBeTruthy();
  });

  it("opens the Mais sheet with the secondary destinations, availability and sign out", () => {
    renderChrome({ showQuoteSimulator: true, showDutyCalendar: true });

    fireEvent.click(within(bottomBar()).getByRole("button", { name: "Mais" }));

    const dialog = screen.getByRole("dialog");
    const destinations = within(dialog).getByRole("navigation", { name: "Mais destinos" });
    for (const href of ["/cotacao", "/plantoes", "/clientes", "/notificacoes", "/settings"]) {
      expect(destinations.querySelector(`a[href="${href}"]`)).not.toBeNull();
    }
    expect(within(dialog).getByText("Disponibilidade")).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: /Sair da conta/ })).toBeTruthy();
  });

  it("hides Cotação and Plantões from Mais when their capabilities are off", () => {
    renderChrome();

    fireEvent.click(within(bottomBar()).getByRole("button", { name: "Mais" }));

    const destinations = within(screen.getByRole("dialog")).getByRole("navigation", { name: "Mais destinos" });
    expect(destinations.querySelector('a[href="/cotacao"]')).toBeNull();
    expect(destinations.querySelector('a[href="/plantoes"]')).toBeNull();
    expect(destinations.querySelector('a[href="/clientes"]')).not.toBeNull();
  });

  it("shows back and the screen title on internal screens, and no back on tab roots", () => {
    navigation.pathname = "/leads/abc";
    const internal = renderChrome();
    expect(screen.getByRole("button", { name: "Voltar" })).toBeTruthy();
    expect(screen.getByText("Lead")).toBeTruthy();
    internal.unmount();

    navigation.pathname = "/minha-fila";
    renderChrome();
    expect(screen.queryByRole("button", { name: "Voltar" })).toBeNull();
  });

  it("goes to the parent route when there is no in-app history", () => {
    render(<LightBackButton fallbackHref="/minha-fila" />);

    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));

    expect(navigation.push).toHaveBeenCalledWith("/minha-fila");
    expect(navigation.back).not.toHaveBeenCalled();
  });

  it("replaces the hamburger menu with the bottom bar in the Light shell", () => {
    const shellSource = readFileSync(join(process.cwd(), "src/components/app-shell.tsx"), "utf8");
    const topNavSource = readFileSync(join(process.cwd(), "src/components/light-top-nav.tsx"), "utf8");
    const chromeSource = readFileSync(join(process.cwd(), "src/components/light/light-chrome.tsx"), "utf8");

    expect(shellSource).toContain("<LightChrome");
    expect(shellSource).not.toContain("LightTopNavBar");
    expect(topNavSource).not.toContain("Menu mobile");
    expect(chromeSource).toContain("<LightBottomNav");
    expect(chromeSource).toContain("<LightSideRail");
  });
});
