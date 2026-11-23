// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const refresh = vi.hoisted(() => vi.fn());
const fire = vi.hoisted(() => vi.fn(() => ({ celebrate: false })));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/features/broker-phone-change/actions", () => ({ changeOwnPhoneAction: vi.fn() }));
vi.mock("@/lib/feedback/use-feedback", () => ({ useFeedback: () => fire }));
vi.mock("@/components/motion/interface-motion-provider", () => ({ useInterfaceMotionEnabled: () => false }));

import { LightPhoneSection } from "./light-phone-section";

afterEach(() => { cleanup(); vi.clearAllMocks(); vi.useRealTimers(); });

const field = () => screen.getByLabelText("Novo celular") as HTMLInputElement;
const button = () => screen.getByRole("button") as HTMLButtonElement;

describe("LightPhoneSection", () => {
  it("mostra o número atual e só libera a troca com um celular válido e diferente", () => {
    render(<LightPhoneSection currentPhone="71988880000" changeAction={vi.fn()} />);
    expect(screen.getByText("(71) 98888-0000")).toBeTruthy();
    expect(button().disabled).toBe(true);

    fireEvent.change(field(), { target: { value: "71988880000" } });
    expect(screen.getByText("Esse já é o seu número.")).toBeTruthy();
    expect(button().disabled).toBe(true);

    fireEvent.change(field(), { target: { value: "(10) 99999-1234" } });
    expect(screen.getByText("Esse DDD não existe. Confira os dois primeiros números.")).toBeTruthy();
    expect(button().disabled).toBe(true);

    fireEvent.change(field(), { target: { value: "+55 71 99999-1234" } });
    expect(field().value).toBe("(71) 99999-1234");
    expect(screen.getByText("Vai ficar (71) 99999-1234.")).toBeTruthy();
    expect(button().disabled).toBe(false);
  });

  it("manda o número normalizado e só confirma depois da resposta do servidor", async () => {
    let resolve!: (value: { ok: true; phone: string }) => void;
    const changeAction = vi.fn(() => new Promise<{ ok: true; phone: string }>((done) => { resolve = done; }));
    render(<LightPhoneSection currentPhone="71988880000" changeAction={changeAction} />);
    fireEvent.change(field(), { target: { value: "71999991234" } });
    fireEvent.click(button());

    expect(changeAction).toHaveBeenCalledWith("5571999991234");
    expect(button().textContent).toContain("Trocando…");
    expect(button().textContent).not.toContain("Telefone trocado");

    await act(async () => { resolve({ ok: true, phone: "5571999991234" }); });
    expect(button().textContent).toContain("Telefone trocado");
    expect(screen.getByText("(71) 99999-1234")).toBeTruthy();
    expect(field().value).toBe("");
    expect(refresh).toHaveBeenCalled();
  });

  it("no erro mostra a causa, o que continua valendo e Tentar de novo", async () => {
    vi.useFakeTimers();
    const changeAction = vi.fn(async () => ({ ok: false as const, error: "Esse número já está no cadastro de outra pessoa da sua corretora." }));
    render(<LightPhoneSection currentPhone="71988880000" changeAction={changeAction} />);
    fireEvent.change(field(), { target: { value: "71999991234" } });
    await act(async () => { fireEvent.click(button()); });
    await act(async () => { vi.advanceTimersByTime(3000); });

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Esse número já está no cadastro de outra pessoa da sua corretora.");
    expect(alert.textContent).toContain("Seu número continua (71) 98888-0000.");
    expect(button().textContent).toContain("Tentar de novo");
    expect(screen.getByText("(71) 98888-0000")).toBeTruthy();
  });
});
