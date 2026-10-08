// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const search = vi.hoisted(() => ({ value: "" }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(search.value) }));
vi.mock("@/components/ui/sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
const saveAction = vi.hoisted(() => vi.fn());
vi.mock("@/features/broker-availability/actions", () => ({ saveOwnBrokerAvailabilityAction: saveAction }));
// Arc components drive Motion springs that the global jsdom mock of motion/react does not implement.
vi.mock("@/components/arc/button/button", () => ({
  Button: ({ children, loading: _loading, variant: _variant, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean; variant?: string }) => (
    <button type="button" {...props}>{children}</button>
  ),
}));
vi.mock("@/components/arc/input/input", () => ({
  Input: ({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) => (
    <label>{label}<input {...props} /></label>
  ),
}));
vi.mock("@/components/arc/switch/switch", () => ({
  Switch: ({ checked, onCheckedChange, ...props }: { checked: boolean; onCheckedChange: (value: boolean) => void } & Record<string, unknown>) => (
    <button type="button" role="switch" aria-checked={checked} aria-label={props["aria-label"] as string} onClick={() => onCheckedChange(!checked)} />
  ),
}));

import { LightAvailabilityProvider } from "@/components/light/light-availability-context";
import { LightAvailabilitySection } from "@/features/broker-availability/components/light-availability-section";

import { LightSettings, type LightSettingsSection } from "./light-settings";

const sections: LightSettingsSection[] = [
  { id: "conta", title: "Minha conta", description: "Seus dados", node: <p>conteúdo da conta</p> as ReactNode },
  { id: "seguranca", title: "Segurança", description: "2FA e chaves", node: <p>conteúdo da segurança</p> as ReactNode },
];

afterEach(() => {
  cleanup();
  search.value = "";
  vi.clearAllMocks();
});

describe("LightSettings", () => {
  it("lists the sections as links that open them", () => {
    render(<LightSettings sections={sections} />);

    expect(screen.getByRole("link", { name: /Minha conta/ }).getAttribute("href")).toBe("/settings?tab=conta");
    expect(screen.getByRole("link", { name: /Segurança/ }).getAttribute("href")).toBe("/settings?tab=seguranca");
    expect(screen.queryByText("conteúdo da conta")).toBeNull();
  });

  it("shows only the requested section, and tab=passkey opens the security one", () => {
    search.value = "tab=conta";
    const { unmount } = render(<LightSettings sections={sections} />);
    expect(screen.getByText("conteúdo da conta")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Segurança/ })).toBeNull();
    unmount();

    search.value = "tab=passkey";
    render(<LightSettings sections={sections} />);
    expect(screen.getByText("conteúdo da segurança")).toBeTruthy();
  });
});

describe("LightAvailabilitySection", () => {
  const windows = [{ dayOfWeek: 1, startsAt: "08:00", endsAt: "12:00" }];

  it("pauses through the shared availability state", () => {
    const setStatus = vi.fn();
    render(
      <LightAvailabilityProvider value={{ availability: "available", isPending: false, setStatus }}>
        <LightAvailabilitySection windows={windows} />
      </LightAvailabilityProvider>,
    );

    fireEvent.click(screen.getByRole("switch", { name: "Receber novos leads agora" }));
    expect(setStatus).toHaveBeenCalledWith("paused");
  });

  it("saves the windows with the existing action and confirms in place", async () => {
    saveAction.mockResolvedValue({ windows });
    render(<LightAvailabilitySection windows={windows} />);

    fireEvent.click(screen.getByRole("button", { name: "Salvar disponibilidade" }));

    await waitFor(() => expect(screen.getByText("Agenda salva")).toBeTruthy());
    expect(saveAction).toHaveBeenCalledWith({ windows });
  });

  it("adds a window to a day and sends it on save", async () => {
    saveAction.mockImplementation(async (input: { windows: unknown[] }) => ({ windows: input.windows }));
    render(<LightAvailabilitySection windows={windows} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Adicionar horário" })[2]);
    fireEvent.click(screen.getByRole("button", { name: "Salvar disponibilidade" }));

    await waitFor(() => expect(saveAction).toHaveBeenCalledTimes(1));
    const sent = saveAction.mock.calls[0][0].windows as Array<{ dayOfWeek: number }>;
    expect(sent.map((item) => item.dayOfWeek)).toEqual([1, 2]);
  });

  it("explains when the feature is not ready yet", () => {
    render(<LightAvailabilitySection windows={[]} schemaReady={false} />);
    expect(screen.getByText(/está sendo preparada/)).toBeTruthy();
  });
});
