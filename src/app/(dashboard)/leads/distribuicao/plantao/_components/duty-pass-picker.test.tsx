// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("@/components/ui/sonner", () => ({ toast }));
vi.mock("@/lib/feedback/use-feedback", () => ({ fireFeedback: vi.fn() }));
vi.mock("@/features/lead-distribution/duty-pass-actions", () => ({
  listDutyPassOptionsAction: vi.fn(),
  passDutySeatAction: vi.fn(),
}));

import { listDutyPassOptionsAction, passDutySeatAction } from "@/features/lead-distribution/duty-pass-actions";
import { DutyPassPicker } from "./duty-pass-picker";

const OCCURRENCE = "sch-1:2026-11-28";

async function choose(name: string) {
  const search = await screen.findByPlaceholderText("Buscar corretor por nome ou código");
  fireEvent.change(search, { target: { value: name.split(" ")[0] } });
  fireEvent.click(screen.getByRole("button", { name: `Passar para ${name}` }));
}

function options(source: "published" | "draft" | "avulso" = "published") {
  return {
    ok: true as const,
    seat: { id: OCCURRENCE, label: "Online Manhã, 28/11, 08:00 às 12:00", source },
    from: { id: "ana", name: "Ana Souza" },
    candidates: [
      { id: "bia", name: "Bia Lima", code: "C2", branchName: "Centro", warnings: [], warningTexts: [] },
      { id: "caio", name: "Caio Reis", code: null, branchName: "Barra", warnings: ["fora_do_tipo" as const], warningTexts: ["A unidade de Caio Reis não participa do tipo de Online Manhã."] },
    ],
  };
}

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("DutyPassPicker", () => {
  it("passa para quem não tem escala e oferece Desfazer", async () => {
    vi.mocked(listDutyPassOptionsAction).mockResolvedValue(options());
    vi.mocked(passDutySeatAction).mockResolvedValue({ ok: true, message: "Online Manhã, 28/11, 08:00 às 12:00: saiu Ana Souza, entrou Bia Lima.", fromName: "Ana Souza", toName: "Bia Lima", undo: { occurrenceId: OCCURRENCE, fromBrokerId: "bia", toBrokerId: "ana" } });
    const onDone = vi.fn();
    render(<DutyPassPicker occurrenceId={OCCURRENCE} fromBrokerId="ana" onDone={onDone} onCancel={() => undefined} />);

    await choose("Bia Lima");
    expect(screen.getByText(/Sai/)).toHaveTextContent("Sai Ana Souza, entra Bia Lima.");
    fireEvent.click(screen.getByRole("button", { name: "Passar o plantão" }));

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(passDutySeatAction).toHaveBeenCalledWith({ occurrenceId: OCCURRENCE, fromBrokerId: "ana", toBrokerId: "bia", acceptOutsideType: undefined, acceptOverlap: undefined });
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("entrou Bia Lima"), { action: expect.objectContaining({ label: "Desfazer" }) });
  });

  it("mostra o aviso de fora do tipo e só passa com o aceite", async () => {
    vi.mocked(listDutyPassOptionsAction).mockResolvedValue(options("avulso"));
    vi.mocked(passDutySeatAction).mockResolvedValue({ ok: true, message: "ok", fromName: "Ana Souza", toName: "Caio Reis", undo: { occurrenceId: OCCURRENCE, fromBrokerId: "caio", toBrokerId: "ana" } });
    render(<DutyPassPicker occurrenceId={OCCURRENCE} fromBrokerId="ana" onDone={() => undefined} onCancel={() => undefined} />);

    fireEvent.change(await screen.findByPlaceholderText("Buscar corretor por nome ou código"), { target: { value: "Caio" } });
    expect(screen.getByText("Fora do tipo")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Passar para Caio Reis" }));
    expect(screen.getByText("A unidade de Caio Reis não participa do tipo de Online Manhã.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Passar mesmo assim" }));

    await waitFor(() => expect(passDutySeatAction).toHaveBeenCalledWith(expect.objectContaining({ toBrokerId: "caio", acceptOutsideType: true })));
  });

  it("avisa que o rascunho só vale depois de publicar", async () => {
    vi.mocked(listDutyPassOptionsAction).mockResolvedValue(options("draft"));
    render(<DutyPassPicker occurrenceId={OCCURRENCE} fromBrokerId="ana" onDone={() => undefined} onCancel={() => undefined} />);
    expect(await screen.findByText(/só no rascunho do mês/)).toBeInTheDocument();
  });

  it("mantém a escala e mostra a causa quando o servidor recusa", async () => {
    vi.mocked(listDutyPassOptionsAction).mockResolvedValue(options());
    vi.mocked(passDutySeatAction).mockResolvedValue({ ok: false, reason: "Bia Lima já está em Online Manhã, 28/11, 08:00 às 12:00." });
    const onDone = vi.fn();
    render(<DutyPassPicker occurrenceId={OCCURRENCE} fromBrokerId="ana" onDone={onDone} onCancel={() => undefined} />);
    await choose("Bia Lima");
    fireEvent.click(screen.getByRole("button", { name: "Passar o plantão" }));
    expect(await screen.findByText("Bia Lima já está em Online Manhã, 28/11, 08:00 às 12:00.")).toBeInTheDocument();
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(onDone).not.toHaveBeenCalled();
  });
});
