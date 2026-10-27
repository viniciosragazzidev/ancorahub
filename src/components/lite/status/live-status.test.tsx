// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const motionState = vi.hoisted(() => ({ reduce: false }));
vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  const { captureMotion } = await import("@/components/lite/motion/capture-motion");
  return { ...actual, motion: captureMotion(), useReducedMotion: () => motionState.reduce };
});

import { readMotion } from "@/components/lite/motion/capture-motion";

import { LiteLiveSeal, LiteLiveStatus, LiteLiveStatusStrip } from "./live-status";
import type { LiveSeal, LiveStatus } from "./types";
import { resetCountdownClockForTests } from "./use-countdown";

const GENERATED = "2026-10-27T13:00:00.000Z"; // 10:00 em São Paulo

function status(overrides: Partial<LiveStatus> = {}): LiveStatus {
  return {
    id: "frios",
    label: "Leads frios",
    value: 50,
    emptyText: "Nenhum lead frio agora",
    severity: "ok",
    nextEvent: { at: "2026-10-27T13:15:33.000Z", label: "Próxima requalificação automática", windowStartAt: "2026-10-27T10:15:33.000Z" },
    explanation: "12 já receberam a tentativa; 38 esperam completar 3 h frios.",
    action: { href: "/leads/distribuicao?view=filas", label: "Revisar" },
    breakdown: [{ label: "já tentados", value: 12 }, { label: "esperando", value: 38 }],
    generatedAt: GENERATED,
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(GENERATED));
  motionState.reduce = false;
  resetCountdownClockForTests();
});
afterEach(() => {
  cleanup();
  resetCountdownClockForTests();
  vi.useRealTimers();
});

describe("LiteLiveStatus", () => {
  it("no servidor mostra a hora absoluta, sem relógio (hidratação estável)", () => {
    const html = renderToString(<LiteLiveStatus status={status()} />);
    expect(html).toContain("Próxima requalificação automática às 10:15");
    expect(html).not.toMatch(/em \d\d:\d\d/);
  });

  it("no cliente troca para a contagem compartilhada e o timer não anuncia a cada segundo", () => {
    render(<LiteLiveStatus status={status()} />);
    const timer = screen.getByRole("timer");
    expect(timer).toHaveTextContent("Próxima requalificação automática em 15:33");
    expect(timer).toHaveAttribute("aria-live", "off");
    expect(timer).toHaveAttribute("aria-label", "Próxima requalificação automática às 10:15");
    act(() => { vi.advanceTimersByTime(3_000); });
    expect(screen.getByRole("timer")).toHaveTextContent("em 15:30");
  });

  it("rótulo, número, frase, quebra e ação com o filtro", () => {
    render(<LiteLiveStatus status={status()} />);
    expect(screen.getByRole("heading", { name: "Leads frios" })).toBeInTheDocument();
    expect(screen.getByText("12 já receberam a tentativa; 38 esperam completar 3 h frios.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Revisar/ })).toHaveAttribute("href", "/leads/distribuicao?view=filas");
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(screen.getByText("já tentados")).toBeInTheDocument();
  });

  it("zero vira frase e sem permissão não tem link", () => {
    render(<LiteLiveStatus status={status({ value: 0, nextEvent: undefined, action: undefined, breakdown: undefined })} />);
    expect(screen.getByText("Nenhum lead frio agora")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("chegando a zero: troca para Rodando agora, um pulso único e avisa quem hospeda uma vez", () => {
    const onDue = vi.fn();
    const { container } = render(<LiteLiveStatus status={status({ nextEvent: { at: "2026-10-27T13:00:03.000Z", label: "Próxima rodada" } })} onDue={onDue} />);
    expect(screen.getByRole("timer")).toHaveTextContent("Próxima rodada em 00:03");
    act(() => { vi.advanceTimersByTime(3_000); });
    expect(screen.getByRole("timer")).toHaveTextContent("Rodando agora");
    expect(onDue).toHaveBeenCalledTimes(1);
    const rings = [...container.querySelectorAll('[aria-hidden]')].filter((el) => {
      const motion = readMotion(el);
      return Boolean(motion.animate && (motion.animate as { scale?: number }).scale);
    });
    expect(rings).toHaveLength(1);
    expect((readMotion(rings[0]).transition as { repeat?: number }).repeat).toBeUndefined();
    act(() => { vi.advanceTimersByTime(5_000); });
    expect(onDue).toHaveBeenCalledTimes(1);
  });

  it("gravidade que sobe pulsa uma vez; que desce não pulsa", () => {
    const { container, rerender } = render(<LiteLiveStatus status={status({ severity: "ok", nextEvent: undefined })} />);
    const pulses = () => [...container.querySelectorAll('[aria-hidden]')].filter((el) => readMotion(el).animate).length;
    expect(pulses()).toBe(0);
    rerender(<LiteLiveStatus status={status({ severity: "critico", nextEvent: undefined })} />);
    expect(pulses()).toBe(1);
    expect(container.querySelector("article")).toHaveAttribute("data-severity", "critico");
    rerender(<LiteLiveStatus status={status({ severity: "ok", nextEvent: undefined })} />);
    expect(pulses()).toBe(1);
  });

  it("movimento reduzido: o pulso de zero só some na opacidade, sem crescer", () => {
    motionState.reduce = true;
    const { container } = render(<LiteLiveStatus status={status({ nextEvent: { at: "2026-10-27T13:00:01.000Z", label: "Próxima rodada" } })} />);
    act(() => { vi.advanceTimersByTime(1_000); });
    const ring = [...container.querySelectorAll('[aria-hidden]')].find((el) => readMotion(el).animate);
    expect(ring).toBeTruthy();
    expect(readMotion(ring!).animate).toEqual({ opacity: 0, scale: 1 });
  });

  it("sem próximo evento mostra o último, relativo", () => {
    render(<LiteLiveStatus status={status({ nextEvent: undefined, lastEvent: { at: "2026-10-27T12:59:20.000Z", label: "Última rodada" } })} />);
    expect(screen.getByText("Última rodada há 40 s")).toBeInTheDocument();
  });
});

describe("LiteLiveStatusStrip e selo", () => {
  const seal: LiveSeal = { id: "motor", label: "Motor de distribuição ativo", severity: "ok", lastRunAt: "2026-10-27T12:59:20.000Z", nextRunAt: "2026-10-27T13:02:00.000Z", generatedAt: GENERATED };

  it("sem status nem selo não ocupa espaço", () => {
    const { container } = render(<LiteLiveStatusStrip statuses={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("faixa com título, cartões e selo", () => {
    render(<LiteLiveStatusStrip statuses={[status(), status({ id: "ofertas", label: "Ofertas aguardando aceite", value: 3 })]} seals={[seal]} />);
    expect(screen.getByRole("region", { name: "Agora na operação" })).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(screen.getByText("Motor de distribuição ativo")).toBeInTheDocument();
    expect(screen.getByText("última rodada há 40 s; próxima em 02:00")).toBeInTheDocument();
  });

  it("selo no servidor usa hora absoluta", () => {
    const html = renderToString(<LiteLiveSeal seal={seal} />);
    expect(html).toContain("última rodada às 09:59; próxima às 10:02");
  });
});
