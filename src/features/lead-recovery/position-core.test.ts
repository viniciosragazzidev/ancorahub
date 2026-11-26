import { describe, expect, it } from "vitest";

import { describeRecoveryPosition, formatNextTouch, recoveryActionScopeFor, segmentForJourney, stepsForSegment } from "./position-core";

const NOW = new Date("2026-11-26T15:00:00.000Z");
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000).toISOString();

describe("onde está agora (recuperação na gaveta do lead)", () => {
  it("etapa da jornada escolhe a cadência", () => {
    expect(segmentForJourney("R1")).toBe("never_replied");
    expect(segmentForJourney("R2")).toBe("stopped_midway");
    expect(segmentForJourney("R3")).toBe("warm");
    expect(segmentForJourney("Q4")).toBeNull();
    expect(stepsForSegment("stopped_midway").map((step) => step.step)).toEqual(["s2", "s3", "s4", "s5", "s6"]);
    expect(stepsForSegment("never_replied").map((step) => step.step)).toEqual(["t1", "t2", "t3", "t4"]);
  });

  it("parou no meio: passo atual, próximo toque com data e as três ações", () => {
    const position = describeRecoveryPosition({
      now: NOW, segment: "stopped_midway", startAt: hoursAgo(5), recovery: null, running: true,
      touches: [{ step: "s2", status: "sent", at: hoursAgo(2) }],
    });
    expect(position.state).toBe("active");
    expect(position.label).toBe("Passo 2 de 5");
    expect(position.current).toMatchObject({ step: "s2", status: "sent" });
    expect(position.next?.step).toBe("s3");
    // S3 sai 20 h depois do início.
    expect(position.next?.at).toBe(new Date(new Date(hoursAgo(5)).getTime() + 20 * 3_600_000).toISOString());
    expect(position).toMatchObject({ canPause: true, canSkip: true, canFinish: true, canResume: false });
  });

  it("passo pulado conta como feito e o seguinte assume", () => {
    const position = describeRecoveryPosition({
      now: NOW, segment: "stopped_midway", startAt: hoursAgo(30), recovery: null, running: true,
      touches: [{ step: "s2", status: "sent", at: hoursAgo(27) }, { step: "s3", status: "skipped", at: hoursAgo(1) }],
    });
    expect(position.current).toMatchObject({ step: "s3", status: "skipped" });
    expect(position.next?.step).toBe("s4");
  });

  it("pausada: sem próximo toque, só retomar ou encerrar", () => {
    const position = describeRecoveryPosition({ now: NOW, segment: "stopped_midway", startAt: hoursAgo(5), recovery: { state: "paused" }, running: true, touches: [] });
    expect(position.state).toBe("paused");
    expect(position.next).toBeNull();
    expect(position).toMatchObject({ canPause: false, canSkip: false, canResume: true, canFinish: true });
  });

  it("encerrada pela equipe ou pela cadência: nada mais a fazer", () => {
    const manual = describeRecoveryPosition({ now: NOW, segment: "stopped_midway", startAt: hoursAgo(5), recovery: { cadenceFinishedAt: hoursAgo(1), finishedBy: "u1" }, running: true, touches: [] });
    expect(manual).toMatchObject({ state: "finished", label: "Encerrada pela equipe", canPause: false, canSkip: false, canFinish: false });
    const turbo = describeRecoveryPosition({ now: NOW, segment: "never_replied", startAt: hoursAgo(5), recovery: null, turboStoppedAt: hoursAgo(1), running: true, touches: [] });
    expect(turbo.state).toBe("finished");
  });

  it("todos os toques já saíram: encerrada sem ações", () => {
    const position = describeRecoveryPosition({
      now: NOW, segment: "warm", startAt: hoursAgo(30), recovery: null, running: true,
      touches: [{ step: "w2", status: "sent", at: hoursAgo(28) }, { step: "w3", status: "failed", at: hoursAgo(10) }],
    });
    expect(position).toMatchObject({ state: "finished", label: "Todos os toques já saíram", next: null, canFinish: false });
  });

  it("marcas manuais (fila de ligação, momento ruim, não contatar) não deixam pausar nem pular", () => {
    const position = describeRecoveryPosition({ now: NOW, segment: "stopped_midway", startAt: hoursAgo(5), recovery: { state: "call_queue" }, running: true, touches: [] });
    expect(position).toMatchObject({ state: "marked", label: "Na fila de ligação", canPause: false, canSkip: false, canFinish: false });
  });

  it("recuperação desligada na empresa: mostra o passo previsto e avisa que nada sai", () => {
    const position = describeRecoveryPosition({ now: NOW, segment: "stopped_midway", startAt: hoursAgo(5), recovery: null, running: false, touches: [] });
    expect(position.state).toBe("off");
    expect(position.next?.step).toBe("s2");
  });

  it("lead fora das cadências", () => {
    expect(describeRecoveryPosition({ now: NOW, segment: null, startAt: null, recovery: null, running: true, touches: [] }))
      .toMatchObject({ state: "none", next: null, canPause: false, canFinish: false });
  });

  it("nunca respondeu: segue os lembretes do turbo", () => {
    const position = describeRecoveryPosition({ now: NOW, segment: "never_replied", startAt: hoursAgo(1), recovery: null, running: true, touches: [{ step: "t1", status: "sent", at: hoursAgo(0.5) }] });
    expect(position.label).toBe("Passo 2 de 4");
    expect(position.next?.step).toBe("t2");
  });

  it("data do próximo toque em palavras", () => {
    expect(formatNextTouch(hoursAgo(1), NOW)).toBe("no próximo horário permitido");
    expect(formatNextTouch(new Date(NOW.getTime() + 2 * 3_600_000).toISOString(), NOW)).toBe("hoje às 14:00");
    expect(formatNextTouch(new Date(NOW.getTime() + 20 * 3_600_000).toISOString(), NOW)).toBe("amanhã às 08:00");
    expect(formatNextTouch(new Date(NOW.getTime() + 3 * 86_400_000).toISOString(), NOW)).toBe("29/11/2026 às 12:00");
  });

  it("escopo das ações: diretor empresa, gestor unidade, supervisor equipe, marketing só sem corretor", () => {
    expect(recoveryActionScopeFor("director")).toBe("tenant");
    expect(recoveryActionScopeFor("manager")).toBe("branch");
    expect(recoveryActionScopeFor("supervisor")).toBe("team");
    expect(recoveryActionScopeFor("broker")).toBe("unassigned");
    expect(recoveryActionScopeFor(null)).toBe("unassigned");
  });
});
