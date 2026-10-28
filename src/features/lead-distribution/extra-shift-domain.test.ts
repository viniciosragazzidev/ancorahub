import { describe, expect, it } from "vitest";

import {
  extraShiftWindow,
  getExtraShiftConfirmationWindowState,
  isExtraShiftRecord,
  isOvernightLead,
  overnightLeadWindow,
  type DutyWindow,
} from "./duty-presence-domain";

const TZ = "America/Sao_Paulo";
const at = (iso: string) => new Date(iso);
// Terça, 27/10/2026, plantão das 09:00 às 13:30.
const morning: DutyWindow = { dutyDate: "2026-10-27", startsAt: at("2026-10-27T09:00:00-03:00"), endsAt: at("2026-10-27T13:30:00-03:00") };

describe("plantão extra dos leads da noite (DEC-152)", () => {
  it("abre às 07:00 e termina às 08:00, mesmo com o plantão da manhã começando depois", () => {
    expect(extraShiftWindow(morning, TZ)).toEqual({
      dutyDate: "2026-10-27",
      startsAt: at("2026-10-27T07:00:00-03:00"),
      endsAt: at("2026-10-27T08:00:00-03:00"),
    });
    expect(extraShiftWindow(morning, TZ, "07:30")?.startsAt).toEqual(at("2026-10-27T07:30:00-03:00"));
  });

  it("termina quando o plantão começa, se ele começa antes das 08:00", () => {
    const early = { dutyDate: "2026-10-27", startsAt: at("2026-10-27T07:30:00-03:00"), endsAt: at("2026-10-27T12:00:00-03:00") };
    expect(extraShiftWindow(early, TZ)?.endsAt).toEqual(at("2026-10-27T07:30:00-03:00"));
  });

  it("não abre quando o extra está configurado para as 08:00", () => {
    expect(extraShiftWindow(morning, TZ, "08:00")).toBeNull();
  });

  it("não vale para plantão da tarde nem para quem começa antes do extra", () => {
    const afternoon = { dutyDate: "2026-10-27", startsAt: at("2026-10-27T13:30:00-03:00"), endsAt: at("2026-10-27T19:00:00-03:00") };
    expect(extraShiftWindow(afternoon, TZ)).toBeNull();
    const early = { dutyDate: "2026-10-27", startsAt: at("2026-10-27T07:00:00-03:00"), endsAt: at("2026-10-27T12:00:00-03:00") };
    expect(extraShiftWindow(early, TZ)).toBeNull();
  });

  it("leads da noite vão das 19:00 do dia útil anterior até as 08:00", () => {
    expect(overnightLeadWindow("2026-10-27", TZ)).toEqual({ since: at("2026-10-26T19:00:00-03:00"), until: at("2026-10-27T08:00:00-03:00") });
    expect(isOvernightLead(at("2026-10-26T22:15:00-03:00"), "2026-10-27", TZ)).toBe(true);
    expect(isOvernightLead(at("2026-10-27T07:59:00-03:00"), "2026-10-27", TZ)).toBe(true);
    expect(isOvernightLead(at("2026-10-27T08:00:00-03:00"), "2026-10-27", TZ)).toBe(false);
    expect(isOvernightLead(at("2026-10-26T18:59:00-03:00"), "2026-10-27", TZ)).toBe(false);
  });

  it("na segunda, a noite começa na sexta às 19:00", () => {
    expect(overnightLeadWindow("2026-10-26", TZ).since).toEqual(at("2026-10-23T19:00:00-03:00"));
    expect(isOvernightLead(at("2026-10-24T11:00:00-03:00"), "2026-10-26", TZ)).toBe(true);
  });

  it("reconhece a confirmação do extra pelo fim às 08:00 num plantão da manhã", () => {
    expect(isExtraShiftRecord({ shiftEndsAt: at("2026-10-27T08:00:00-03:00"), assignmentStartsAt: "09:00", timezone: TZ })).toBe(true);
    // Um plantão da noite que termina às 08:00 não é extra.
    expect(isExtraShiftRecord({ shiftEndsAt: at("2026-10-27T08:00:00-03:00"), assignmentStartsAt: "22:00", timezone: TZ })).toBe(false);
  });

  it("reconhece a confirmação do extra pelo fim igual ao início do plantão normal (registros até 28/10)", () => {
    expect(isExtraShiftRecord({ shiftEndsAt: at("2026-10-27T09:00:00-03:00"), assignmentStartsAt: "09:00", timezone: TZ })).toBe(true);
    expect(isExtraShiftRecord({ shiftEndsAt: at("2026-10-27T13:30:00-03:00"), assignmentStartsAt: "09:00", timezone: TZ })).toBe(false);
    expect(isExtraShiftRecord({ shiftEndsAt: at("2026-10-27T09:00:00-03:00"), assignmentStartsAt: null, timezone: TZ })).toBe(false);
  });

  it("confirma o extra sem tolerância até as 08:00", () => {
    const window = extraShiftWindow(morning, TZ)!;
    expect(getExtraShiftConfirmationWindowState({ ...window, now: at("2026-10-27T06:00:00-03:00") })).toBe("not_open");
    expect(getExtraShiftConfirmationWindowState({ ...window, now: at("2026-10-27T07:40:00-03:00") })).toBe("available");
    expect(getExtraShiftConfirmationWindowState({ ...window, now: at("2026-10-27T08:00:00-03:00") })).toBe("ended");
  });
});
