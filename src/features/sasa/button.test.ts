// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { labSasaWorld } from "@/app/dev/laboratorio/sasa-lab";

import { runSasaCommand, sasaArrivedLate, SASA_DROP_VALUE } from "./command-core";
import { isOfflineError, keepQueued, SASA_QUEUE_MAX } from "./offline-queue";
import { sasaReplyFitsToast } from "./voice-client";
import { readSasaVoiceSurface, sasaVoiceRouteHidden } from "./voice-visibility";

const now = new Date("2026-11-19T14:00:00-03:00");
const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000);

afterEach(() => {
  document.body.replaceChildren();
  delete document.documentElement.dataset.leadOffer;
  delete document.documentElement.dataset.liteMoment;
});

describe("regra dos 30 minutos", () => {
  it("só pede confirmação depois de 30 min", () => {
    expect(sasaArrivedLate(null, now)).toBe(false);
    expect(sasaArrivedLate(minutesAgo(29), now)).toBe(false);
    expect(sasaArrivedLate(minutesAgo(31), now)).toBe(true);
  });

  it("pedido gravado há 40 min vira confirmação de um toque, com a hora da gravação", async () => {
    const run = vi.fn();
    const reply = await runSasaCommand({ text: "pausa meu plantão", world: labSasaWorld(now), run, recordedAt: minutesAgo(40), stamp: "t" });
    expect(run).not.toHaveBeenCalled();
    expect(reply.blocks[0]).toMatchObject({ type: "question", prompt: "Você gravou às 13:20, sem internet. Pausar o recebimento de leads?" });
    const choices = reply.blocks[0]?.type === "question" ? reply.blocks[0].choices : [];
    expect(choices.map((choice) => choice.action)).toEqual([
      { kind: "server", name: "duty.pause", payload: {} },
      { kind: "local", value: SASA_DROP_VALUE },
    ]);
  });

  it("\"daqui a 1 hora\" conta da hora em que foi gravado", async () => {
    const run = vi.fn(async () => ({ ok: true, message: "ok" }));
    await runSasaCommand({ text: "marca retorno com a Ana daqui a 1 hora", world: labSasaWorld(now), run, recordedAt: minutesAgo(10), stamp: "t" });
    expect(run).toHaveBeenCalledWith("lead.scheduleReturn", { leadId: "lab-ana", at: new Date(minutesAgo(10).getTime() + 3_600_000).toISOString() });
  });

  it("leituras respondem mesmo atrasadas", async () => {
    const reply = await runSasaCommand({ text: "quem está esperando?", world: labSasaWorld(now), run: vi.fn(), recordedAt: minutesAgo(90), stamp: "t" });
    expect(reply.blocks[1]).toMatchObject({ type: "leads" });
  });
});

describe("fila sem internet", () => {
  it("guarda até 5 áudios de até 24 h, os mais antigos primeiro", () => {
    const items = [5, 300, 2, 60 * 25, 40, 10, 1].map((minutes, index) => ({ id: `a${index}`, recordedAt: minutesAgo(minutes).toISOString() }));
    const kept = keepQueued(items, now);
    expect(kept).toHaveLength(SASA_QUEUE_MAX);
    expect(kept.map((item) => item.id)).toEqual(["a1", "a4", "a5", "a0", "a2"]);
  });

  it("só guarda quando é falta de rede", () => {
    expect(isOfflineError(new TypeError("Failed to fetch"), true)).toBe(true);
    expect(isOfflineError(new Error("500"), false)).toBe(true);
    expect(isOfflineError(new Error("500"), true)).toBe(false);
  });
});

describe("onde o botão aparece", () => {
  it("some nas conversas, na venda e na cotação", () => {
    expect(sasaVoiceRouteHidden("/dashboard", false)).toBe(false);
    expect(sasaVoiceRouteHidden("/minha-fila", false)).toBe(false);
    expect(sasaVoiceRouteHidden("/leads/abc", true)).toBe(true);
    expect(sasaVoiceRouteHidden("/dashboard/c/ancora", false)).toBe(true);
    expect(sasaVoiceRouteHidden("/leads/abc/registrar-venda", false)).toBe(true);
    expect(sasaVoiceRouteHidden("/cotacao", false)).toBe(true);
  });

  it("some com oferta de lead, celebração, diálogo aberto e teclado; sobe com a pílula do pé", () => {
    const surface = () => readSasaVoiceSurface(document);
    expect(surface()).toEqual({ hidden: null, lifted: false });
    document.documentElement.dataset.leadOffer = "1";
    expect(surface().hidden).toBe("offer");
    delete document.documentElement.dataset.leadOffer;
    document.documentElement.dataset.liteMoment = "1";
    expect(surface().hidden).toBe("celebration");
    delete document.documentElement.dataset.liteMoment;

    // jsdom não mede layout: o elemento "aparece" quando tem tamanho.
    const sized = (element: HTMLElement) => { element.getBoundingClientRect = () => ({ width: 100, height: 40 } as DOMRect); return element; };
    const dialog = sized(document.createElement("div"));
    dialog.setAttribute("role", "dialog");
    dialog.dataset.state = "open";
    document.body.append(dialog);
    expect(surface().hidden).toBe("dialog");
    dialog.dataset.state = "closed";
    expect(surface().hidden).toBeNull();

    const input = document.createElement("input");
    document.body.append(input);
    input.focus();
    expect(surface().hidden).toBe("typing");
    input.blur();

    const wrap = document.createElement("div");
    wrap.dataset.sasaLift = "";
    wrap.append(sized(document.createElement("button")));
    document.body.append(wrap);
    expect(surface().lifted).toBe(true);
  });
});

describe("toast ou folha", () => {
  it("texto com Desfazer cabe no toast; escolha ou lista abre a folha", () => {
    expect(sasaReplyFitsToast([{ type: "assistant", id: "a", text: "Pausei." }, { type: "question", id: "q", prompt: "Foi sem querer?", choices: [{ id: "undo", label: "Desfazer", action: { kind: "server", name: "duty.resume", payload: {} } }] }])).toBe(true);
    expect(sasaReplyFitsToast([{ type: "question", id: "q", prompt: "Qual Carlos?", choices: [{ id: "pick-1", label: "Carlos Mendes", action: { kind: "local", value: "sasa:{}" } }] }])).toBe(false);
    expect(sasaReplyFitsToast([{ type: "assistant", id: "a", text: "2 esperando." }, { type: "leads", id: "l", title: "Esperando você", icon: "reply", rows: [], emptyText: "", updatedAt: "" }])).toBe(false);
  });
});
