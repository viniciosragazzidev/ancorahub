// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));
vi.mock("@/shared/auth/client", () => ({ signOut: vi.fn() }));
vi.mock("@/features/leads/availability-action", () => ({
  updateBrokerAvailabilityAction: vi.fn(),
}));

import { LightTopNavBar } from "@/components/light-top-nav";

afterEach(() => vi.clearAllMocks());

describe("Corretor Lite experience contract", () => {
  it("resolves the Lite dashboard before entering the shared reporting center", () => {
    const source = readFileSync(
      join(process.cwd(), "src/app/(dashboard)/dashboard/page.tsx"),
      "utf8",
    );

    const modeLookup = source.indexOf("getExperienceMode(context)");
    const lightDashboard = source.indexOf("<LightDashboard");
    const reportingLookup = source.indexOf("getFeatureFlag(FEATURE_FLAGS.REPORTING_CENTER)");

    expect(modeLookup).toBeGreaterThan(-1);
    expect(lightDashboard).toBeGreaterThan(modeLookup);
    expect(reportingLookup).toBeGreaterThan(lightDashboard);
  });

  it("keeps every primary Lite destination available in the mobile menu", () => {
    render(
      <LightTopNavBar
        branding={{ tenantName: "Corretora", brandColor: null, logoUrl: null }}
        user={{ name: "Corretor Teste", email: "corretor@example.test", role: "broker" }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }));

    const mobileMenu = screen.getByRole("navigation", { name: "Menu mobile" });

    for (const href of ["/dashboard", "/minha-fila", "/conversas/broker", "/clientes"]) {
      expect(mobileMenu.querySelector(`a[href="${href}"]`)).not.toBeNull();
    }

    expect(within(mobileMenu).getAllByRole("link")).toHaveLength(5);
  });

  it("uses one overlay sidebar instead of a duplicate mobile bottom bar", () => {
    const shellSource = readFileSync(join(process.cwd(), "src/components/app-shell.tsx"), "utf8");
    const sidebarSource = readFileSync(join(process.cwd(), "src/components/ui/sidebar.tsx"), "utf8");

    expect(shellSource).not.toContain("<MobileBottomNav");
    expect(sidebarSource.indexOf("if (isMobile)")).toBeLessThan(
      sidebarSource.indexOf('if (collapsible === "none")'),
    );
    expect(sidebarSource).toContain('data-mobile="true"');
    expect(sidebarSource).toContain("data-starting-style:-translate-x-full");
    expect(sidebarSource).toContain("max-md:hidden");
  });
});
