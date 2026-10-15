import { describe, expect, it } from "vitest";

import { publishedAddProblem, publishedRemoveProblem } from "./monthly-duty-published-edit";

const openAdd = { ended: false, brokerIsPlanningBroker: true, alreadyOnPlantao: false, allowedInType: true, force: false, scheduleActive: true, onWeeklyRoster: false };

describe("adicionar corretor num plantão publicado", () => {
  it("allows an active broker of an allowed unit on an open plantão", () => {
    expect(publishedAddProblem(openAdd)).toBeNull();
  });

  it("refuses a plantão that already ended", () => {
    expect(publishedAddProblem({ ...openAdd, ended: true })).toMatch(/já terminou/);
  });

  it("refuses a broker who is not an active broker of the tenant", () => {
    expect(publishedAddProblem({ ...openAdd, brokerIsPlanningBroker: false })).toMatch(/fora da corretora/);
  });

  it("refuses a duplicate on the same plantão", () => {
    expect(publishedAddProblem({ ...openAdd, alreadyOnPlantao: true })).toMatch(/já está neste plantão/);
  });

  it("refuses a broker already on the weekly roster of the plantão", () => {
    expect(publishedAddProblem({ ...openAdd, onWeeklyRoster: true })).toMatch(/escala semanal/);
  });

  it("asks for confirmation for a unit outside the type, and accepts it with force", () => {
    expect(publishedAddProblem({ ...openAdd, allowedInType: false })).toMatch(/Confirme/);
    expect(publishedAddProblem({ ...openAdd, allowedInType: false, force: true })).toBeNull();
  });

  it("refuses when the plantão's schedule is no longer active", () => {
    expect(publishedAddProblem({ ...openAdd, scheduleActive: false })).toMatch(/não está mais ativo/);
  });
});

describe("remover corretor de um plantão publicado", () => {
  it("removes a manual or existing broker from an open plantão", () => {
    expect(publishedRemoveProblem({ entryFound: true, origin: "manual", ended: false, started: false })).toBeNull();
  });

  it("refuses to remove a plantão that is running", () => {
    expect(publishedRemoveProblem({ entryFound: true, origin: "existing", ended: false, started: true })).toMatch(/já começou/);
  });

  it("refuses to change a plantão that ended", () => {
    expect(publishedRemoveProblem({ entryFound: true, origin: "existing", ended: true, started: true })).toMatch(/já terminou/);
  });

  it("refuses a weekly-roster broker and a broker who is not on the plantão", () => {
    expect(publishedRemoveProblem({ entryFound: true, origin: "weekly", ended: false, started: false })).toMatch(/escala semanal/);
    expect(publishedRemoveProblem({ entryFound: false, origin: undefined, ended: false, started: false })).toMatch(/não está neste plantão/);
  });
});
