import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/dashboard-header", () => ({
  DashboardHeader: ({ title, rightSlot }: { title: string; rightSlot?: import("react").ReactNode }) => <header>{title}{rightSlot}</header>,
}));

import { OUT_OF_TEAM_PROFILE_MESSAGE, OutOfTeamProfile } from "./out-of-team-profile";

describe("perfil de corretor fora da equipe do supervisor", () => {
  it("explica em português que o corretor não é da equipe e oferece voltar", () => {
    const html = renderToStaticMarkup(<OutOfTeamProfile />);
    expect(OUT_OF_TEAM_PROFILE_MESSAGE).toBe("Este corretor não é da sua equipe.");
    expect(html).toContain(OUT_OF_TEAM_PROFILE_MESSAGE);
    expect(html).toContain('role="alert"');
    expect(html).toContain('href="/equipe"');
  });
});
