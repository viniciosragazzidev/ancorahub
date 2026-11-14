// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("@/components/ui/sonner", () => ({ toast }));
const fire = vi.hoisted(() => vi.fn(() => ({ motion: false, celebrate: false })));
vi.mock("@/lib/feedback/use-feedback", () => ({ useFeedback: () => fire }));
const actions = vi.hoisted(() => ({ updateTenantBrandingAction: vi.fn(async () => ({ success: true })) }));
vi.mock("../../actions", () => actions);
vi.mock("../logo-upload", () => ({ LogoUpload: () => <div data-stub="logo" /> }));
vi.mock("../color-picker", () => ({ ColorPicker: () => <div data-stub="color" /> }));

import { EmpresaLite } from "./empresa-lite";

const tenant = { name: "Âncora", legalName: null, cnpj: null, logoUrl: null, brandColor: null };

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("empresa Lite", () => {
  it("salvar confirma no rodapé depois do servidor, sem toast", async () => {
    render(<EmpresaLite tenant={tenant} canEdit />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" })); });
    expect(actions.updateTenantBrandingAction).toHaveBeenCalledOnce();
    expect(screen.getByRole("status")).toHaveTextContent("Identidade visual salva");
    expect(fire).toHaveBeenCalledWith("confirm");
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("a falha mostra a causa, o que continua valendo e Tentar de novo", async () => {
    actions.updateTenantBrandingAction.mockResolvedValueOnce({ success: false, error: "A cor precisa estar em hexadecimal." } as never);
    render(<EmpresaLite tenant={tenant} canEdit />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" })); });
    expect(screen.getByRole("alert")).toHaveTextContent("A cor precisa estar em hexadecimal. O logo e a cor anteriores continuam valendo.");
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
    expect(fire).toHaveBeenCalledWith("error");
    expect(toast.error).not.toHaveBeenCalled();
  });
});
