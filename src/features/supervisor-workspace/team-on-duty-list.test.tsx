// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => <a href={href} {...props}>{children}</a>,
}));
vi.mock("@/components/ui/button", async () => {
  const React = await import("react");
  // The real Button renders its `render` element with the label inside.
  return { Button: ({ render, children }: { render: React.ReactElement; children: React.ReactNode }) => React.cloneElement(render, undefined, children) };
});
vi.mock("@/components/arc/badge/badge", () => ({ Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span> }));
vi.mock("@/components/arc/empty-state/empty-state", () => ({ EmptyState: ({ title }: { title: string }) => <section><strong>{title}</strong></section> }));

import type { TeamDuty } from "./queries";
import { TeamOnDutyList } from "./team-on-duty-list";

afterEach(() => cleanup());

const duty: TeamDuty[] = [
  { brokerId: "maria", brokerName: "Maria", scheduleName: "Manhã", startsAt: "08:00", endsAt: "12:00", paused: false, presence: "confirmed" },
  { brokerId: "carla", brokerName: "Carla", scheduleName: "Tarde", startsAt: "13:00", endsAt: "18:00", paused: true, presence: "pending" },
] as unknown as TeamDuty[];

describe("TeamOnDutyList", () => {
  it("lists who is on duty with the plantão and its presence, and links each to their plantão", () => {
    render(<TeamOnDutyList duty={duty} />);

    expect(screen.getByText("De plantão agora")).toBeTruthy();
    const maria = screen.getByText("Maria").closest("li") as HTMLElement;
    expect(within(maria).getByText(/Manhã · 08:00 às 12:00 · presença confirmada/)).toBeTruthy();
    expect(maria.querySelector("a")?.getAttribute("href")).toBe("/plantoes/corretor/maria");
    expect(screen.getByText("Pausado")).toBeTruthy();
  });

  it("says nobody is on duty when the list is empty", () => {
    render(<TeamOnDutyList duty={[]} />);

    expect(screen.getByText("Ninguém de plantão agora")).toBeTruthy();
  });
});
